import { createTranslationWorker } from './translationWorker.js'
import { logger } from '../utils/logger.js'

let translationWorker = null

export const startWorkers = () => {
  logger.info('Starting background workers...')
  
  translationWorker = createTranslationWorker()
  
  logger.info('Translation worker started')
}

export const stopWorkers = async () => {
  logger.info('Stopping workers...')
  
  if (translationWorker) {
    await translationWorker.close()
  }
  
  logger.info('Workers stopped')
}
