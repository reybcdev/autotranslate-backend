import { Worker } from 'bullmq'
import { getRedisConnection } from '../config/redis.js'
import { supabase } from '../config/supabase.js'
import { translateContent } from '../services/translationService.js'
import { notifyTranslationCompleted, notifyTranslationFailed } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'

export const createTranslationWorker = () => {
  const worker = new Worker(
    'translations',
    async (job) => {
      const { translationId, userId, fileId, filename, filePath, sourceLang, targetLang } = job.data
      
      logger.info(`Processing translation job ${job.id}: ${translationId}`)
      
      try {
        // Update status to processing
        await updateTranslationStatus(translationId, 'processing')
        
        // Download original file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('uploads')
          .download(filePath)
        
        if (downloadError) {
          throw new Error(`Failed to download file: ${downloadError.message}`)
        }
        
        // Get file content
        const content = await fileData.text()
        
        // Perform translation
        const translatedContent = await translateContent(content, sourceLang, targetLang)
        
        // Generate translated file path
        const translatedPath = filePath.replace(/(\.[^.]+)$/, `_${targetLang}$1`)
        
        // Upload translated file
        const { error: uploadError } = await supabase.storage
          .from('translations')
          .upload(translatedPath, translatedContent, {
            contentType: 'text/plain',
            upsert: true
          })
        
        if (uploadError) {
          throw new Error(`Failed to upload translated file: ${uploadError.message}`)
        }
        
        // Update translation record
        await supabase
          .from('translations')
          .update({
            status: 'completed',
            translated_file_url: translatedPath,
            completed_at: new Date().toISOString()
          })
          .eq('id', translationId)
        
        // Deduct credit from user
        await supabase.rpc('deduct_credit', { user_id: userId })
        
        // Notify user of completion
        await notifyTranslationCompleted(userId, translationId, filename, targetLang, translatedPath)
        logger.info(`Translation completed: ${translationId}`)
        
        return { success: true, translatedPath }
      } catch (error) {
        logger.error(`Translation job ${job.id} failed:`, error)
        
        await updateTranslationStatus(translationId, 'failed', error.message)
        await notifyTranslationFailed(userId, translationId, filename, error.message)
        
        throw error
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3
    }
  )
  
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`)
  })
  
  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err.message)
  })
  
  return worker
}

async function updateTranslationStatus(translationId, status, errorMessage = null) {
  const update = { status }
  if (errorMessage) {
    update.error_message = errorMessage
  }
  
  await supabase
    .from('translations')
    .update(update)
    .eq('id', translationId)
}
