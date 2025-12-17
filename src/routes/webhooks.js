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
  const { userId, plan, credits } = session.metadata
  const creditsToAdd = parseInt(credits, 10)
  
  logger.info(`Processing checkout for user ${userId}, adding ${creditsToAdd} credits`)
  
  // Add credits to user
  const { error: updateError } = await supabase.rpc('add_credits', {
    user_id: userId,
    amount: creditsToAdd
  })
  
  if (updateError) {
    logger.error('Error adding credits:', updateError)
    throw updateError
  }
  
  // Record payment
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      plan,
      credits_added: creditsToAdd,
      status: 'completed'
    })
  
  if (paymentError) {
    logger.error('Error recording payment:', paymentError)
  }
  
  logger.info(`Successfully added ${creditsToAdd} credits to user ${userId}`)
}

export default router
