import { Router } from 'express'
import { asyncHandler } from '../utils/helpers.js'
import { 
  getSourceLanguages, 
  getTargetLanguages, 
  getUsage,
  getSupportedDocumentTypes 
} from '../services/translationService.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// Get source languages (public)
router.get('/source', asyncHandler(async (req, res) => {
  const languages = await getSourceLanguages()
  res.json({ languages })
}))

// Get target languages (public)
router.get('/target', asyncHandler(async (req, res) => {
  const languages = await getTargetLanguages()
  res.json({ languages })
}))

// Get all languages (public)
router.get('/', asyncHandler(async (req, res) => {
  const [sourceLanguages, targetLanguages] = await Promise.all([
    getSourceLanguages(),
    getTargetLanguages()
  ])
  
  res.json({ 
    source: sourceLanguages, 
    target: targetLanguages 
  })
}))

// Get supported document types (public)
router.get('/document-types', asyncHandler(async (req, res) => {
  const documentTypes = getSupportedDocumentTypes()
  res.json({ documentTypes })
}))

// Get DeepL API usage (authenticated)
router.get('/usage', authenticate, asyncHandler(async (req, res) => {
  const usage = await getUsage()
  res.json({ usage })
}))

export default router
