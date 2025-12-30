import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { supabase } from '../config/supabase.js'
import { translationQueue } from '../queues/translationQueue.js'
import { logger } from '../utils/logger.js'
import { getSourceLanguages, getTargetLanguages } from '../services/translationService.js'

const router = Router()

// Create new translation job
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    fileId,
    sourceLang,
    targetLang,
    formality,
    billingMode = 'plan',
    billingReference = null
  } = req.body
  const userId = req.user.id
  
  if (!fileId || !targetLang) {
    return res.status(400).json({ error: 'fileId and targetLang are required' })
  }
  
  // Validate formality if provided
  const validFormalities = ['default', 'more', 'less', 'prefer_more', 'prefer_less']
  if (formality && !validFormalities.includes(formality)) {
    return res.status(400).json({ error: `Invalid formality. Must be one of: ${validFormalities.join(', ')}` })
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
  
  if (!['plan', 'one_off'].includes(billingMode)) {
    return res.status(400).json({ error: 'Invalid billing mode' })
  }
  
  let paymentRecord = null
  
  if (billingMode === 'plan') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single()
    
    if (!profile || profile.credits < 1) {
      return res.status(402).json({ error: 'Insufficient credits' })
    }
  } else {
    if (!billingReference) {
      return res.status(400).json({ error: 'billingReference is required for one-off payments' })
    }
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('billing_reference', billingReference)
      .eq('user_id', userId)
      .eq('usage_type', 'one_off')
      .eq('status', 'completed')
      .eq('consumed', false)
      .single()
    
    if (paymentError || !payment) {
      return res.status(402).json({ error: 'Payment not found or already used' })
    }
    
    paymentRecord = payment
  }
  
  // Get language names
  const [sourceLanguages, targetLanguages] = await Promise.all([
    getSourceLanguages(),
    getTargetLanguages()
  ])
  
  const sourceCode = (sourceLang || 'auto').toUpperCase()
  const targetCode = targetLang.toUpperCase()
  
  const sourceLangData = sourceLanguages.find(l => l.code.toUpperCase() === sourceCode)
  const targetLangData = targetLanguages.find(l => l.code.toUpperCase() === targetCode)
  
  const sourceLangName = sourceCode === 'AUTO' ? 'Auto-detect' : (sourceLangData?.name || sourceCode)
  const targetLangName = targetLangData?.name || targetCode
  
  // Create translation record
  const { data: translation, error: createError } = await supabase
    .from('translations')
    .insert({
      user_id: userId,
      file_id: fileId,
      file_name: file.filename,
      source_language: sourceLang || 'auto',
      target_language: targetLang,
      source_language_name: sourceLangName,
      target_language_name: targetLangName,
      status: 'pending',
      billing_mode: billingMode,
      payment_id: paymentRecord?.id || null
    })
    .select()
    .single()
  
  if (createError) {
    logger.error('Error creating translation:', createError)
    return res.status(500).json({ error: 'Failed to create translation' })
  }
  
  if (paymentRecord) {
    const { error: paymentLinkError } = await supabase
      .from('payments')
      .update({
        translation_id: translation.id,
        consumed: true
      })
      .eq('id', paymentRecord.id)
    
    if (paymentLinkError) {
      logger.error('Error linking payment to translation:', paymentLinkError)
      return res.status(500).json({ error: 'Failed to link payment to translation' })
    }
  }
  
  // Add job to queue
  await translationQueue.add('translate', {
    translationId: translation.id,
    userId,
    fileId,
    filename: file.filename,
    filePath: file.file_path,
    sourceLang: sourceLang || 'auto',
    targetLang,
    targetLangName,
    formality: formality || null,
    billingMode,
    paymentId: paymentRecord?.id || null
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
  const isAdmin = req.userRole === 'admin'
  
  const { data, error } = await supabase
    .from('translations')
    .select('*, files(*)')
    .eq('id', id)
    .single()
  
  if (error || !data) {
    return res.status(404).json({ error: 'Translation not found' })
  }

  if (!isAdmin && data.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  res.json({ translation: data })
}))

// Retry failed translation
router.post('/:id/retry', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  // Get the failed translation
  const { data: translation, error: fetchError } = await supabase
    .from('translations')
    .select('*, files(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  
  if (fetchError || !translation) {
    return res.status(404).json({ error: 'Translation not found' })
  }
  
  if (translation.status !== 'failed') {
    return res.status(400).json({ error: 'Only failed translations can be retried' })
  }
  
  const billingMode = translation.billing_mode || 'plan'
  
  if (billingMode === 'plan') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single()
    
    if (!profile || profile.credits < 1) {
      return res.status(402).json({ error: 'Insufficient credits' })
    }
  } else {
    if (!translation.payment_id) {
      return res.status(402).json({ error: 'Payment not linked to translation' })
    }
  }
  
  // Reset translation status
  const { error: updateError } = await supabase
    .from('translations')
    .update({
      status: 'pending',
      error_message: null
    })
    .eq('id', id)
  
  if (updateError) {
    logger.error('Error resetting translation:', updateError)
    return res.status(500).json({ error: 'Failed to retry translation' })
  }
  
  // Re-queue the job
  await translationQueue.add('translate', {
    translationId: translation.id,
    userId,
    fileId: translation.file_id,
    filePath: translation.files.file_path,
    sourceLang: translation.source_language,
    targetLang: translation.target_language,
    targetLangName: translation.target_language_name,
    billingMode,
    paymentId: translation.payment_id || null
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  })
  
  logger.info(`Translation retry queued: ${id}`)
  
  res.json({ success: true, message: 'Translation retry queued' })
}))

// Cancel pending translation
router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  
  const { data: translation, error } = await supabase
    .from('translations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  
  if (error || !translation) {
    return res.status(404).json({ error: 'Translation not found' })
  }
  
  if (translation.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending translations can be cancelled' })
  }
  
  const { error: updateError } = await supabase
    .from('translations')
    .update({ status: 'cancelled' })
    .eq('id', id)
  
  if (updateError) {
    logger.error('Error cancelling translation:', updateError)
    return res.status(500).json({ error: 'Failed to cancel translation' })
  }
  
  logger.info(`Translation cancelled: ${id}`)
  
  res.json({ success: true })
}))

// Get all user translations
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  const isAdmin = req.userRole === 'admin'
  const { status, limit = 20, offset = 0, userId: queryUserId, filename } = req.query
  
  let query = supabase
    .from('translations')
    .select('*, files(filename, file_size)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!isAdmin) {
    query = query.eq('user_id', userId)
  } else if (queryUserId) {
    query = query.eq('user_id', queryUserId)
  }
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const sanitizedFilename = typeof filename === 'string' ? filename.trim() : ''

  if (sanitizedFilename) {
    const escaped = sanitizedFilename.replace(/[%_]/g, (char) => `\\${char}`)
    const pattern = `%${escaped}%`
    query = query.ilike('file_name', pattern)
  }
  const { data, error, count } = await query
  
  if (error) {
    logger.error('Error fetching translations:', error)
    return res.status(500).json({ error: 'Failed to fetch translations' })
  }
  
  res.json({ translations: data, total: count })
}))

export default router
