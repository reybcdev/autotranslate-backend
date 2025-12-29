import { Router } from 'express'
import { stripe } from '../config/stripe.js'
import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'

const router = Router()

// Stripe webhook handler
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    )
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }
  
  logger.info(`Received webhook event: ${event.type}`)
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        await handleCheckoutComplete(session)
        break
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        logger.info(`Payment succeeded: ${paymentIntent.id}`)
        break
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        logger.warn(`Payment failed: ${paymentIntent.id}`)
        break
      }
      
      default:
        logger.info(`Unhandled event type: ${event.type}`)
    }
    
    res.json({ received: true })
  } catch (error) {
    logger.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

async function handleCheckoutComplete(session) {
  const metadata = session.metadata || {}
  const userId = metadata.userId
  const usageType = metadata.usageType || 'plan'
  
  if (!userId) {
    logger.warn('Checkout session missing userId metadata')
    return
  }
  
  if (usageType === 'one_off') {
    await handleOneOffPayment(session, metadata)
  } else {
    await handlePlanPayment(session, metadata)
  }
}

async function handlePlanPayment(session, metadata) {
  const creditsToAdd = parseInt(metadata.credits || '0', 10)
  const plan = metadata.plan || null
  const userId = metadata.userId
  
  logger.info(`Processing plan checkout for user ${userId}, adding ${creditsToAdd} credits`)
  
  if (!creditsToAdd || creditsToAdd < 1) {
    logger.warn('Plan checkout has no credits to add, skipping credit update')
  } else {
    const { error: updateError } = await supabase.rpc('add_credits', {
      user_id: userId,
      amount: creditsToAdd
    })
    
    if (updateError) {
      logger.error('Error adding credits:', updateError)
      throw updateError
    }
  }
  
  const paymentRecord = {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    amount: session.amount_total,
    currency: session.currency,
    plan,
    credits_added: creditsToAdd,
    status: 'completed',
    usage_type: 'plan',
    metadata
  }
  
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert(paymentRecord, { onConflict: 'stripe_session_id' })
  
  if (paymentError) {
    logger.error('Error recording plan payment:', paymentError)
  }
  
  logger.info(`Plan checkout processed for user ${userId}`)
}

async function handleOneOffPayment(session, metadata) {
  const userId = metadata.userId
  const billingReference = metadata.billingReference
  
  if (!billingReference) {
    logger.error('One-off payment missing billingReference')
    return
  }
  
  const pricingBasis = safeJsonParse(metadata.pricingBasis)
  
  const paymentRecord = {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    amount: session.amount_total,
    currency: session.currency,
    usage_type: 'one_off',
    status: 'completed',
    credits_added: 0,
    pricing_basis: pricingBasis,
    billing_reference: billingReference,
    metadata
  }
  
  const { error: paymentError } = await supabase
    .from('payments')
    .upsert(paymentRecord, { onConflict: 'stripe_session_id' })
  
  if (paymentError) {
    logger.error('Error recording one-off payment:', paymentError)
    throw paymentError
  }
  
  logger.info(`One-off payment ready for billingReference ${billingReference}`)
}

function safeJsonParse(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (error) {
    logger.warn('Failed to parse pricingBasis metadata', { value, error })
    return null
  }
}

export default router
