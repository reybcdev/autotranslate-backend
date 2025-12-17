import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { stripe } from '../config/stripe.js'
import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'

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
    success_url: `${config.frontend.url}/dashboard?payment=success`,
    cancel_url: `${config.frontend.url}/pricing?payment=cancelled`,
    metadata: {
      userId,
      plan,
      credits: selectedPlan.credits.toString()
    }
  })
  
  logger.info(`Checkout session created for user ${userId}, plan: ${plan}`)
  
  res.json({ sessionId: session.id, url: session.url })
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

export default router
