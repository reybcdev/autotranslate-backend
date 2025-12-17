import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { supabase } from '../config/supabase.js'
import { translationQueue } from '../queues/translationQueue.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Create new translation job
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { fileId, sourceLang, targetLang } = req.body
  const userId = req.user.id
  
  if (!fileId || !targetLang) {
    return res.status(400).json({ error: 'fileId and targetLang are required' })
  }
  
  // Verify file belongs to user
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single()
  
  if (fileError || !file) {
    return res.status(404).json({ error: 'File not found' })
  }
  
  // Check user credits
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()
  
  if (!profile || profile.credits < 1) {
    return res.status(402).json({ error: 'Insufficient credits' })
  }
  
  // Create translation record
  const { data: translation, error: createError } = await supabase
    .from('translations')
    .insert({
      user_id: userId,
      file_id: fileId,
      file_name: file.filename,
      source_language: sourceLang || 'auto',
      target_language: targetLang,
      status: 'pending'
    })
    .select()
    .single()
  
  if (createError) {
    logger.error('Error creating translation:', createError)
    return res.status(500).json({ error: 'Failed to create translation' })
  }
  
  // Add job to queue
  await translationQueue.add('translate', {
    translationId: translation.id,
    userId,
    fileId,
    filePath: file.file_path,
    sourceLang: sourceLang || 'auto',
    targetLang
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  })
  
  logger.info(`Translation job queued: ${translation.id}`)
  
  res.status(201).json({ translation })
}))

// Get translation status
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  const { data, error } = await supabase
    .from('translations')
    .select('*, files(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  
  if (error || !data) {
    return res.status(404).json({ error: 'Translation not found' })
  }
  
  res.json({ translation: data })
}))

// Get all user translations
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  const { status, limit = 20, offset = 0 } = req.query
  
  let query = supabase
    .from('translations')
    .select('*, files(filename, file_size)', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error, count } = await query
  
  if (error) {
    logger.error('Error fetching translations:', error)
    return res.status(500).json({ error: 'Failed to fetch translations' })
  }
  
  res.json({ translations: data, total: count })
}))

export default router
