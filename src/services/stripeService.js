import { stripe } from '../config/stripe.js'
import { logger } from '../utils/logger.js'

export const createCustomer = async (email, userId) => {
  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  })
  
  logger.info(`Created Stripe customer: ${customer.id}`)
  return customer
}

export const getCustomerByEmail = async (email) => {
  const customers = await stripe.customers.list({
    email,
    limit: 1
  })
  
  return customers.data[0] || null
}

export const createPortalSession = async (customerId, returnUrl) => {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  })
  
  return session.url
}

export const getPaymentIntent = async (paymentIntentId) => {
  return await stripe.paymentIntents.retrieve(paymentIntentId)
}
