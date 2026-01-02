import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDeepLClient, isDeepLConfigured } from '../config/deepl.js'
import { logger } from '../utils/logger.js'

const SUPPORTED_DOCUMENT_EXTENSIONS = ['.docx', '.pptx', '.xlsx', '.pdf', '.htm', '.html', '.txt', '.xlf', '.xliff']

export const translateContent = async (content, sourceLang, targetLang) => {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL API not configured')
  }
  
  const client = getDeepLClient()
  const source = sourceLang === 'auto' ? null : sourceLang.toUpperCase()
  const target = targetLang.toUpperCase()
  
  try {
    const result = await client.translateText(content, source, target)
    return Array.isArray(result) ? result[0].text : result.text
  } catch (error) {
    logger.error('DeepL text translation failed:', error)
    throw new Error(`Translation failed: ${error.message}`)
  }
}

export const translateDocument = async (fileBuffer, filename, sourceLang, targetLang, options = {}) => {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL API not configured')
  }
  
  const client = getDeepLClient()
  const source = sourceLang === 'auto' ? null : sourceLang.toUpperCase()
  const target = targetLang.toUpperCase()
  
  const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported file type: ${extension}. Supported: ${SUPPORTED_DOCUMENT_EXTENSIONS.join(', ')}`)
  }
  
  // Create temp files for input and output
  const tempDir = os.tmpdir()
  const tempInputPath = path.join(tempDir, `deepl_input_${Date.now()}${extension}`)
  const tempOutputPath = path.join(tempDir, `deepl_output_${Date.now()}${extension}`)
  
  try {
    logger.info(`Starting document translation: ${filename} -> ${target}`)
    
    // Write input buffer to temp file
    await fs.promises.writeFile(tempInputPath, fileBuffer)
    
    const translateOptions = {}
    if (options.formality) {
      translateOptions.formality = options.formality
    }
    
    // Translate using file paths
    await client.translateDocument(
      tempInputPath,
      tempOutputPath,
      source,
      target,
      translateOptions
    )
    
    // Read the translated file
    const translatedBuffer = await fs.promises.readFile(tempOutputPath)
    
    logger.info(`Document translation completed: ${filename}`)
    
    return translatedBuffer
  } catch (error) {
    logger.error('DeepL document translation failed:', error)
    
    if (error.documentHandle) {
      logger.error(`Document ID: ${error.documentHandle.documentId}`)
    }
    
    throw new Error(`Document translation failed: ${error.message}`)
  } finally {
    // Clean up temp files
    try {
      await fs.promises.unlink(tempInputPath).catch(() => {})
      await fs.promises.unlink(tempOutputPath).catch(() => {})
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const uploadDocumentForTranslation = async (fileBuffer, filename, sourceLang, targetLang, options = {}) => {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL API not configured')
  }
  
  const client = getDeepLClient()
  const source = sourceLang === 'auto' ? null : sourceLang.toUpperCase()
  const target = targetLang.toUpperCase()
  
  try {
    const inputStream = Readable.from(fileBuffer)
    
    const handle = await client.uploadDocument(inputStream, target, {
      sourceLang: source,
      filename,
      ...options.formality && { formality: options.formality }
    })
    
    logger.info(`Document uploaded: ${handle.documentId}`)
    
    return {
      documentId: handle.documentId,
      documentKey: handle.documentKey
    }
  } catch (error) {
    logger.error('DeepL document upload failed:', error)
    throw new Error(`Document upload failed: ${error.message}`)
  }
}

export const getDocumentStatus = async (documentId, documentKey) => {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL API not configured')
  }
  
  const client = getDeepLClient()
  
  try {
    const handle = { documentId, documentKey }
    const status = await client.getDocumentStatus(handle)
    
    return {
      status: status.status,
      secondsRemaining: status.secondsRemaining,
      billedCharacters: status.billedCharacters,
      errorMessage: status.errorMessage
    }
  } catch (error) {
    logger.error('Failed to get document status:', error)
    throw new Error(`Failed to get status: ${error.message}`)
  }
}

export const downloadTranslatedDocument = async (documentId, documentKey) => {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL API not configured')
  }
  
  const client = getDeepLClient()
  
  try {
    const handle = { documentId, documentKey }
    const outputBuffer = []
    
    const outputStream = new Readable({
      read() {}
    })
    
    outputStream.on('data', chunk => outputBuffer.push(chunk))
    
    await client.downloadDocument(handle, outputStream)
    
    return Buffer.concat(outputBuffer)
  } catch (error) {
    logger.error('Failed to download translated document:', error)
    throw new Error(`Download failed: ${error.message}`)
  }
}

export const getSourceLanguages = async () => {
  if (!isDeepLConfigured()) {
    return getDefaultSourceLanguages()
  }
  
  try {
    const client = getDeepLClient()
    const languages = await client.getSourceLanguages()
    
    return languages.map(lang => ({
      code: lang.code,
      name: lang.name
    }))
  } catch (error) {
    logger.error('Failed to fetch source languages:', error)
    return getDefaultSourceLanguages()
  }
}

export const getTargetLanguages = async () => {
  if (!isDeepLConfigured()) {
    return getDefaultTargetLanguages()
  }
  
  try {
    const client = getDeepLClient()
    const languages = await client.getTargetLanguages()
    
    return languages.map(lang => ({
      code: lang.code,
      name: lang.name,
      supportsFormality: lang.supportsFormality || false
    }))
  } catch (error) {
    logger.error('Failed to fetch target languages:', error)
    return getDefaultTargetLanguages()
  }
}

export const getUsage = async () => {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL API not configured')
  }
  
  try {
    const client = getDeepLClient()
    const usage = await client.getUsage()
    
    return {
      character: usage.character ? {
        count: usage.character.count,
        limit: usage.character.limit,
        limitReached: usage.character.limitReached()
      } : null,
      document: usage.document ? {
        count: usage.document.count,
        limit: usage.document.limit,
        limitReached: usage.document.limitReached()
      } : null
    }
  } catch (error) {
    logger.error('Failed to get usage:', error)
    throw new Error(`Failed to get usage: ${error.message}`)
  }
}

export const getSupportedDocumentTypes = () => {
  return SUPPORTED_DOCUMENT_EXTENSIONS.map(ext => ({
    extension: ext,
    description: getDocumentTypeDescription(ext)
  }))
}

function getDocumentTypeDescription(ext) {
  const descriptions = {
    '.docx': 'Microsoft Word Document',
    '.pptx': 'Microsoft PowerPoint Document',
    '.xlsx': 'Microsoft Excel Document',
    '.pdf': 'Portable Document Format',
    '.htm': 'HTML Document',
    '.html': 'HTML Document',
    '.txt': 'Plain Text Document',
    '.xlf': 'XLIFF Document',
    '.xliff': 'XLIFF Document'
  }
  return descriptions[ext] || 'Document'
}

function getDefaultSourceLanguages() {
  return [
    { code: 'BG', name: 'Bulgarian' },
    { code: 'CS', name: 'Czech' },
    { code: 'DA', name: 'Danish' },
    { code: 'DE', name: 'German' },
    { code: 'EL', name: 'Greek' },
    { code: 'EN', name: 'English' },
    { code: 'ES', name: 'Spanish' },
    { code: 'ET', name: 'Estonian' },
    { code: 'FI', name: 'Finnish' },
    { code: 'FR', name: 'French' },
    { code: 'HU', name: 'Hungarian' },
    { code: 'ID', name: 'Indonesian' },
    { code: 'IT', name: 'Italian' },
    { code: 'JA', name: 'Japanese' },
    { code: 'KO', name: 'Korean' },
    { code: 'LT', name: 'Lithuanian' },
    { code: 'LV', name: 'Latvian' },
    { code: 'NB', name: 'Norwegian' },
    { code: 'NL', name: 'Dutch' },
    { code: 'PL', name: 'Polish' },
    { code: 'PT', name: 'Portuguese' },
    { code: 'RO', name: 'Romanian' },
    { code: 'RU', name: 'Russian' },
    { code: 'SK', name: 'Slovak' },
    { code: 'SL', name: 'Slovenian' },
    { code: 'SV', name: 'Swedish' },
    { code: 'TR', name: 'Turkish' },
    { code: 'UK', name: 'Ukrainian' },
    { code: 'ZH', name: 'Chinese' }
  ]
}

function getDefaultTargetLanguages() {
  return [
    { code: 'BG', name: 'Bulgarian', supportsFormality: false },
    { code: 'CS', name: 'Czech', supportsFormality: false },
    { code: 'DA', name: 'Danish', supportsFormality: false },
    { code: 'DE', name: 'German', supportsFormality: true },
    { code: 'EL', name: 'Greek', supportsFormality: false },
    { code: 'EN-GB', name: 'English (British)', supportsFormality: false },
    { code: 'EN-US', name: 'English (American)', supportsFormality: false },
    { code: 'ES', name: 'Spanish', supportsFormality: true },
    { code: 'ET', name: 'Estonian', supportsFormality: false },
    { code: 'FI', name: 'Finnish', supportsFormality: false },
    { code: 'FR', name: 'French', supportsFormality: true },
    { code: 'HU', name: 'Hungarian', supportsFormality: false },
    { code: 'ID', name: 'Indonesian', supportsFormality: false },
    { code: 'IT', name: 'Italian', supportsFormality: true },
    { code: 'JA', name: 'Japanese', supportsFormality: true },
    { code: 'KO', name: 'Korean', supportsFormality: false },
    { code: 'LT', name: 'Lithuanian', supportsFormality: false },
    { code: 'LV', name: 'Latvian', supportsFormality: false },
    { code: 'NB', name: 'Norwegian', supportsFormality: false },
    { code: 'NL', name: 'Dutch', supportsFormality: true },
    { code: 'PL', name: 'Polish', supportsFormality: true },
    { code: 'PT-BR', name: 'Portuguese (Brazilian)', supportsFormality: true },
    { code: 'PT-PT', name: 'Portuguese (European)', supportsFormality: true },
    { code: 'RO', name: 'Romanian', supportsFormality: false },
    { code: 'RU', name: 'Russian', supportsFormality: true },
    { code: 'SK', name: 'Slovak', supportsFormality: false },
    { code: 'SL', name: 'Slovenian', supportsFormality: false },
    { code: 'SV', name: 'Swedish', supportsFormality: false },
    { code: 'TR', name: 'Turkish', supportsFormality: false },
    { code: 'UK', name: 'Ukrainian', supportsFormality: false },
    { code: 'ZH', name: 'Chinese (simplified)', supportsFormality: false }
  ]
}
