import * as deepl from 'deepl-node'
import { config } from './index.js'
import { logger } from '../utils/logger.js'

let deeplClient = null

export const getDeepLClient = () => {
  if (!deeplClient && config.translation.deeplApiKey) {
    try {
      deeplClient = new deepl.DeepLClient(config.translation.deeplApiKey)
      logger.info('DeepL client initialized')
    } catch (error) {
      logger.error('Failed to initialize DeepL client:', error)
      throw error
    }
  }
  return deeplClient
}

export const isDeepLConfigured = () => {
  return !!config.translation.deeplApiKey
}
