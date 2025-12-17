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

// Get user's files
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    logger.error('Error fetching files:', error)
    return res.status(500).json({ error: 'Failed to fetch files' })
  }
  
  res.json({ files: data })
}))

// Get single file
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  
  if (error || !data) {
    return res.status(404).json({ error: 'File not found' })
  }
  
  res.json({ file: data })
}))

// Get download URL for translated file
router.get('/:id/download', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  // Get translation with file info
  const { data: translation, error } = await supabase
    .from('translations')
    .select('*, files(*)')
    .eq('file_id', id)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !translation || !translation.translated_file_url) {
    return res.status(404).json({ error: 'Translated file not found' })
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
