import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { stripe } from '../config/stripe.js'
import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'
import { calculateOneOffPrice } from '../utils/pricing.js'
import { processCheckoutSession } from '../services/paymentProcessor.js'

const router = Router()

// Pricing plans
const PLANS = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER,
    credits: 10,
    amount: 999 // $9.99
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO,
    credits: 50,
    amount: 3999 // $39.99
  },
  enterprise: {
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    credits: 200,
    amount: 9999 // $99.99
  }
}

// Create checkout session
router.post('/checkout', authenticate, asyncHandler(async (req, res) => {
  const { plan } = req.body
  const userId = req.user.id
  const userEmail = req.user.email
  
  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Invalid plan selected' })
  }
  
  const selectedPlan = PLANS[plan]
  
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    payment_method_types: ['card'],
    line_items: [
      {
        price: selectedPlan.priceId,
        quantity: 1
      }
    ],
    mode: 'payment',
    success_url: `${config.frontend.url}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend.url}/billing?payment=cancelled`,
    metadata: {
      userId,
      plan,
      credits: selectedPlan.credits.toString()
    }
  })
  
  logger.info(`Checkout session created for user ${userId}, plan: ${plan}`)
  
  res.json({ sessionId: session.id, url: session.url })
}))

// Create checkout session for per-translation payment
router.post('/translation/checkout', authenticate, asyncHandler(async (req, res) => {
  const { fileId, wordCount, pageCount } = req.body
  const userId = req.user.id
  const userEmail = req.user.email

  if (!fileId) {
    return res.status(400).json({ error: 'fileId is required' })
  }

  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, filename, file_size')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single()

  if (fileError || !file) {
    return res.status(404).json({ error: 'File not found' })
  }

  const pricing = calculateOneOffPrice({
    wordCount,
    pageCount,
    fileSize: file.file_size || 0
  })

  const billingReference = randomUUID()
  const pricingBasis = {
    wordCount: pricing.breakdown.wordCount,
    pageCount: pricing.breakdown.pageCount,
    fileSize: file.file_size || 0
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: pricing.currency,
          product_data: {
            name: `Translation for ${file.filename}`
          },
          unit_amount: pricing.amount
        },
        quantity: 1
      }
    ],
    mode: 'payment',
    success_url: `${config.frontend.url}/checkout?payment=success&ref=${billingReference}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend.url}/checkout?payment=cancelled`,
    metadata: {
      userId,
      usageType: 'one_off',
      billingReference,
      fileId,
      pricingBasis: JSON.stringify(pricingBasis)
    }
  })

  logger.info(`One-off translation checkout for user ${userId}, file ${fileId}, amount ${pricing.amount}`)

  res.json({
    sessionId: session.id,
    url: session.url,
    billingReference,
    amount: pricing.amount,
    currency: pricing.currency,
    pricing: pricing.breakdown
  })
}))

// Get payment history
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    logger.error('Error fetching payment history:', error)
    return res.status(500).json({ error: 'Failed to fetch payment history' })
  }
  
  res.json({ payments: data })
}))

// Get user credits
router.get('/credits', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id
  
  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()
  
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch credits' })
  }
  
  res.json({ credits: data?.credits || 0 })
}))

// Confirm payment session (client-side fallback)
router.post('/confirm', authenticate, asyncHandler(async (req, res) => {
  const { sessionId } = req.body
  const userId = req.user.id
  
  logger.info(`Payment confirmation request from user ${userId} for session ${sessionId}`)
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' })
  }
  
  try {
    // Retrieve the session from Stripe
    logger.info(`Retrieving Stripe session: ${sessionId}`)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    logger.info(`Session retrieved: ${session.id}, payment_status: ${session.payment_status}, metadata:`, session.metadata)
    
    // Verify this session belongs to the authenticated user
    if (session.metadata?.userId !== userId) {
      logger.warn(`Session ${sessionId} userId mismatch: expected ${userId}, got ${session.metadata?.userId}`)
      return res.status(403).json({ error: 'Session does not belong to this user' })
    }
    
    // Only process if payment was successful
    if (session.payment_status !== 'paid') {
      logger.warn(`Session ${sessionId} payment not completed: ${session.payment_status}`)
      return res.status(400).json({ error: 'Payment not completed' })
    }
    
    // Process the session (adds credits, records payment)
    logger.info(`Processing checkout session ${sessionId}`)
    const processed = await processCheckoutSession(session)
    logger.info(`Session ${sessionId} processed: ${processed}`)
    
    res.json({ 
      success: true, 
      processed,
      message: processed ? 'Payment confirmed and processed' : 'Payment already processed'
    })
  } catch (error) {
    logger.error('Error confirming payment session:', {
      error: error.message,
      stack: error.stack,
      sessionId,
      userId
    })
    res.status(500).json({ error: 'Failed to confirm payment', details: error.message })
  }
}))

export default router
