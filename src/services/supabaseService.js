import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) {
    logger.error('Error fetching user profile:', error)
    return null
  }
  
  return data
}

export const updateUserCredits = async (userId, credits) => {
  const { error } = await supabase
    .from('profiles')
    .update({ credits })
    .eq('id', userId)
  
  if (error) {
    logger.error('Error updating credits:', error)
    throw error
  }
}

export const addCredits = async (userId, amount) => {
  const { error } = await supabase.rpc('add_credits', {
    user_id: userId,
    amount
  })
  
  if (error) {
    logger.error('Error adding credits:', error)
    throw error
  }
}

export const deductCredit = async (userId) => {
  const { error } = await supabase.rpc('deduct_credit', {
    user_id: userId
  })
  
  if (error) {
    logger.error('Error deducting credit:', error)
    throw error
  }
}
