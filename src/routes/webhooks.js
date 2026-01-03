import { Router } from 'express'
import { stripe } from '../config/stripe.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'
import { processCheckoutSession } from '../services/paymentProcessor.js'

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
      case 'checkout.session.completed':
        await processCheckoutSession(event.data.object)
        break
      
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

export default router
