import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

export const NotificationType = {
  TRANSLATION_COMPLETED: 'translation_completed',
  TRANSLATION_FAILED: 'translation_failed',
  CREDITS_LOW: 'credits_low',
  CREDITS_ADDED: 'credits_added'
}

export const createNotification = async (userId, type, title, message, metadata = {}) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata,
        read: false
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Error creating notification:', error)
      return null
    }
    
    return data
  } catch (err) {
    logger.error('Failed to create notification:', err)
    return null
  }
}

export const notifyTranslationFailed = async (userId, translationId, filename, errorMessage) => {
  return createNotification(
    userId,
    NotificationType.TRANSLATION_FAILED,
    'Translation Failed',
    `Translation of "${filename}" failed: ${errorMessage}`,
    { translationId, filename, errorMessage }
  )
}

export const notifyTranslationCompleted = async (userId, translationId, filename, targetLang) => {
  return createNotification(
    userId,
    NotificationType.TRANSLATION_COMPLETED,
    'Translation Completed',
    `Your file "${filename}" has been translated to ${targetLang}`,
    { translationId, filename, targetLang }
  )
}

export const getUserNotifications = async (userId, { limit = 20, unreadOnly = false } = {}) => {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (unreadOnly) {
    query = query.eq('read', false)
  }
  
  const { data, error } = await query
  
  if (error) {
    logger.error('Error fetching notifications:', error)
    return []
  }
  
  return data
}

export const markNotificationRead = async (notificationId, userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
  
  if (error) {
    logger.error('Error marking notification read:', error)
    return false
  }
  
  return true
}

export const markAllNotificationsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  
  if (error) {
    logger.error('Error marking all notifications read:', error)
    return false
  }
  
  return true
}
