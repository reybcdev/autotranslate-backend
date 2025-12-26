import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Get signed URL for file upload
router.post('/upload-url', authenticate, asyncHandler(async (req, res) => {
  const { filename, contentType } = req.body
  const userId = req.user.id
  
  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType are required' })
  }
  
  const filePath = `${userId}/${Date.now()}-${filename}`
  
  const { data, error } = await supabase.storage
    .from('uploads')
    .createSignedUploadUrl(filePath)
  
  if (error) {
    logger.error('Error creating upload URL:', error)
    return res.status(500).json({ error: 'Failed to create upload URL' })
  }
  
  res.json({
    uploadUrl: data.signedUrl,
    filePath,
    token: data.token
  })
}))

// Get user's files with translation status
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  const isAdmin = req.userRole === 'admin'
  const { userId: queryUserId, limit = 20, offset = 0 } = req.query

  let query = supabase
    .from('files')
    .select(`
      *,
      translations (
        id,
        status,
        target_language,
        created_at,
        completed_at
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1)

  if (!isAdmin) {
    query = query.eq('user_id', userId)
  } else if (queryUserId) {
    query = query.eq('user_id', queryUserId)
  }

  const { data, error, count } = await query
  
  if (error) {
    logger.error('Error fetching files:', error)
    return res.status(500).json({ error: 'Failed to fetch files' })
  }
  
  // Add latest translation status summary
  const filesWithStatus = data.map(file => {
    const latestTranslation = file.translations?.[0] || null
    return {
      ...file,
      latest_translation: latestTranslation,
      translation_count: file.translations?.length || 0
    }
  })
  
  res.json({ files: filesWithStatus, total: count })
}))

// Get single file
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  const isAdmin = req.userRole === 'admin'
  
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !data) {
    return res.status(404).json({ error: 'File not found' })
  }

  if (!isAdmin && data.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  res.json({ file: data })
}))

// Confirm file upload (called after pre-signed URL upload completes)
router.post('/confirm-upload', authenticate, asyncHandler(async (req, res) => {
  const { filePath, filename, fileSize, mimeType } = req.body
  const userId = req.user.id
  
  if (!filePath || !filename) {
    return res.status(400).json({ error: 'filePath and filename are required' })
  }
  
  // Verify file exists in storage
  const { data: fileExists, error: checkError } = await supabase.storage
    .from('uploads')
    .list(userId, {
      search: filePath.replace(`${userId}/`, '')
    })
  
  if (checkError || !fileExists?.length) {
    logger.error('File not found in storage:', checkError)
    return res.status(404).json({ error: 'File not found in storage' })
  }
  
  // Create file record in database
  const { data: file, error: insertError } = await supabase
    .from('files')
    .insert({
      user_id: userId,
      filename,
      file_path: filePath,
      file_size: fileSize || 0,
      mime_type: mimeType || 'application/octet-stream',
      status: 'uploaded'
    })
    .select()
    .single()
  
  if (insertError) {
    logger.error('Error creating file record:', insertError)
    return res.status(500).json({ error: 'Failed to register file' })
  }
  
  logger.info(`File confirmed: ${file.id} for user ${userId}`)
  
  res.status(201).json({ file })
}))

// Delete a file
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  // Get file info
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  
  if (fetchError || !file) {
    return res.status(404).json({ error: 'File not found' })
  }
  
  // Check if file has pending translations
  const { data: pendingTranslations } = await supabase
    .from('translations')
    .select('id')
    .eq('file_id', id)
    .in('status', ['pending', 'processing'])
  
  if (pendingTranslations?.length > 0) {
    return res.status(409).json({ error: 'Cannot delete file with pending translations' })
  }
  
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('uploads')
    .remove([file.file_path])
  
  if (storageError) {
    logger.error('Error deleting from storage:', storageError)
  }
  
  // Delete file record (cascades to translations)
  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .eq('id', id)
  
  if (deleteError) {
    logger.error('Error deleting file record:', deleteError)
    return res.status(500).json({ error: 'Failed to delete file' })
  }
  
  logger.info(`File deleted: ${id}`)
  
  res.json({ success: true })
}))

// Get download URL for translated file
router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  const isAdmin = req.userRole === 'admin'
  
  // Get translation with file info
  const { data: translation, error } = await supabase
    .from('translations')
    .select('*, files(*)')
    .eq('file_id', id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !translation || !translation.translated_file_url) {
    return res.status(404).json({ error: 'Translated file not found' })
  }

  if (!isAdmin && translation.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  const { data, error: urlError } = await supabase.storage
    .from('translations')
    .createSignedUrl(translation.translated_file_url, 3600) // 1 hour expiry
  
  if (urlError) {
    return res.status(500).json({ error: 'Failed to generate download URL' })
  }
  
  res.json({ downloadUrl: data.signedUrl })
}))

export default router
