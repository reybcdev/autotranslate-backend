import axios from 'axios'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate'

export const translateContent = async (content, sourceLang, targetLang) => {
  // Try DeepL first if key is available, fallback to Google
  if (config.translation.deeplApiKey) {
    try {
      return await translateWithDeepL(content, sourceLang, targetLang)
    } catch (error) {
      logger.warn('DeepL translation failed, falling back to Google:', error.message)
    }
  }
  
  if (config.translation.googleApiKey) {
    return await translateWithGoogle(content, sourceLang, targetLang)
  }
  
  throw new Error('No translation API configured')
}

async function translateWithDeepL(content, sourceLang, targetLang) {
  const params = {
    text: content,
    target_lang: targetLang.toUpperCase()
  }
  
  if (sourceLang && sourceLang !== 'auto') {
    params.source_lang = sourceLang.toUpperCase()
  }
  
  const response = await axios.post(DEEPL_URL, null, {
    params,
    headers: {
      'Authorization': `DeepL-Auth-Key ${config.translation.deeplApiKey}`
    }
  })
  
  if (response.data?.translations?.[0]?.text) {
    return response.data.translations[0].text
  }
  
  throw new Error('Invalid DeepL response')
}

async function translateWithGoogle(content, sourceLang, targetLang) {
  const response = await axios.post(GOOGLE_TRANSLATE_URL, null, {
    params: {
      key: config.translation.googleApiKey,
      q: content,
      target: targetLang,
      source: sourceLang !== 'auto' ? sourceLang : undefined,
      format: 'text'
    }
  })
  
  if (response.data?.data?.translations?.[0]?.translatedText) {
    return response.data.data.translations[0].translatedText
  }
  
  throw new Error('Invalid Google Translate response')
}

export const detectLanguage = async (content) => {
  if (config.translation.googleApiKey) {
    const response = await axios.post(
      'https://translation.googleapis.com/language/translate/v2/detect',
      null,
      {
        params: {
          key: config.translation.googleApiKey,
          q: content.substring(0, 500) // Sample for detection
        }
      }
    )
    
    return response.data?.data?.detections?.[0]?.[0]?.language
  }
  
  return null
}

export const getSupportedLanguages = async () => {
  // Return commonly supported languages
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' }
  ]
}
