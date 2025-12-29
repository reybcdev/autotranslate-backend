import { Worker } from 'bullmq'
import { getRedisConnection } from '../config/redis.js'
import { supabase } from '../config/supabase.js'
import { translateContent, translateDocument } from '../services/translationService.js'
import { notifyTranslationCompleted, notifyTranslationFailed } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'

const DOCUMENT_EXTENSIONS = ['.docx', '.pptx', '.xlsx', '.pdf', '.htm', '.html', '.xlf', '.xliff']
const TEXT_EXTENSIONS = ['.txt', '.json', '.md', '.csv']

function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : ''
}

function getMimeType(extension) {
  const mimeTypes = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pdf': 'application/pdf',
    '.htm': 'text/html',
    '.html': 'text/html',
    '.txt': 'text/plain',
    '.xlf': 'application/xliff+xml',
    '.xliff': 'application/xliff+xml',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.csv': 'text/csv'
  }
  return mimeTypes[extension] || 'application/octet-stream'
}

export const createTranslationWorker = () => {
  const worker = new Worker(
    'translations',
    async (job) => {
      const { translationId, userId, fileId, filePath, sourceLang, targetLang, targetLangName, formality } = job.data
      
      logger.info(`Processing translation job ${job.id}: ${translationId}`)
      
      const filename = filePath.split('/').pop()
      const extension = getFileExtension(filename)
      
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
        
        let translatedContent
        let contentType = getMimeType(extension)
        
        // Check if it's a document or text file
        if (DOCUMENT_EXTENSIONS.includes(extension)) {
          // Document translation via DeepL Document API
          const fileBuffer = Buffer.from(await fileData.arrayBuffer())
          translatedContent = await translateDocument(
            fileBuffer, 
            filename, 
            sourceLang, 
            targetLang,
            { formality }
          )
        } else if (TEXT_EXTENSIONS.includes(extension)) {
          // Text translation via DeepL Text API
          const content = await fileData.text()
          const translatedText = await translateContent(content, sourceLang, targetLang)
          translatedContent = Buffer.from(translatedText, 'utf-8')
        } else {
          // Try as text for unknown extensions
          const content = await fileData.text()
          const translatedText = await translateContent(content, sourceLang, targetLang)
          translatedContent = Buffer.from(translatedText, 'utf-8')
          contentType = 'text/plain'
        }
        
        // Generate translated file path
        const translatedPath = filePath.replace(/(\.[^.]+)$/, `_${targetLang}$1`)
        
        // Upload translated file
        const { error: uploadError } = await supabase.storage
          .from('translations')
          .upload(translatedPath, translatedContent, {
            contentType,
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
        await notifyTranslationCompleted(
          userId,
          translationId,
          filename,
          targetLangName || targetLang,
          translatedPath,
          targetLang
        )
        logger.info(`Translation completed: ${translationId}`)
        
        return { success: true, translatedPath }
      } catch (error) {
        logger.error(`Translation job ${job.id} failed:`, error)
        
        await updateTranslationStatus(translationId, 'failed', error.message)
        await notifyTranslationFailed(userId, translationId, filename, error.message)
        
        // Notify user of failure
        await notifyTranslationFailed(userId, translationId, filename, error.message)
        
        throw error
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3 // Reduced concurrency for document processing
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
