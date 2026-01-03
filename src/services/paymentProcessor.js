import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

async function isSessionAlreadyProcessed(sessionId) {
  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .limit(1)

  if (error) {
    logger.error('Error checking payment record:', error)
    throw error
  }

  return Array.isArray(data) && data.length > 0
}

export async function processCheckoutSession(session) {
  const metadata = session?.metadata || {}
  const userId = metadata.userId

  if (!userId) {
    logger.warn('Checkout session missing userId metadata', { sessionId: session?.id })
    return false
  }

  if (await isSessionAlreadyProcessed(session.id)) {
    logger.info('Checkout session already processed, skipping', { sessionId: session.id })
    return false
  }

  const usageType = metadata.usageType || 'plan'

  if (usageType === 'one_off') {
    await handleOneOffPayment(session, metadata)
  } else {
    await handlePlanPayment(session, metadata)
  }

  return true
}

async function handlePlanPayment(session, metadata) {
  const creditsToAdd = parseInt(metadata.credits || '0', 10)
  const plan = metadata.plan || null
  const userId = metadata.userId

  logger.info(`Processing plan checkout for user ${userId}, adding ${creditsToAdd} credits`)

  // Map Stripe payment_status to our status values
  const statusMap = {
    'paid': 'completed',
    'unpaid': 'pending',
    'no_payment_required': 'completed'
  }
  const status = statusMap[session.payment_status] || 'completed'

  const paymentRecord = {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    amount: session.amount_total,
    currency: session.currency,
    plan,
    credits_added: creditsToAdd,
    status,
    usage_type: 'plan',
    metadata
  }

  // Insert payment record first - this will fail if already exists due to unique constraint
  const { data: insertedPayment, error: paymentError } = await supabase
    .from('payments')
    .insert(paymentRecord)
    .select()
    .single()

  if (paymentError) {
    // If it's a duplicate key error, the payment was already processed
    if (paymentError.code === '23505') {
      logger.info(`Payment already recorded for session ${session.id}, skipping credit addition`)
      return
    }
    logger.error('Error recording plan payment:', paymentError)
    throw paymentError
  }

  // Only add credits if the payment record was successfully inserted (first time processing)
  if (creditsToAdd > 0) {
    const { error: updateError } = await supabase.rpc('add_credits', {
      user_id: userId,
      amount: creditsToAdd
    })

    if (updateError) {
      logger.error('Error adding credits via RPC:', updateError)
      throw updateError
    }
    logger.info(`Successfully added ${creditsToAdd} credits to user ${userId}`)
  } else {
    logger.warn('Plan checkout has no credits to add')
  }
}

async function handleOneOffPayment(session, metadata) {
  const userId = metadata.userId
  const billingReference = metadata.billingReference

  if (!billingReference) {
    logger.error('One-off payment missing billingReference')
    return
  }

  const pricingBasis = safeJsonParse(metadata.pricingBasis)

  // Map Stripe payment_status to our status values
  const statusMap = {
    'paid': 'completed',
    'unpaid': 'pending',
    'no_payment_required': 'completed'
  }
  const status = statusMap[session.payment_status] || 'completed'

  const paymentRecord = {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    amount: session.amount_total,
    currency: session.currency,
    usage_type: 'one_off',
    status,
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
