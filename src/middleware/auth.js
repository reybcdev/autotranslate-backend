import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }
    
    const token = authHeader.split(' ')[1]
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      logger.warn('Authentication failed:', error?.message)
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Fetch profile to determine role (defaults to "user")
    let role = 'user'
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single()

      if (profileError) {
        logger.warn('Failed to load profile for user', user.id, profileError.message)
      } else {
        role = profile?.role || 'user'
        req.profile = profile
      }
    } catch (profileErr) {
      logger.warn('Profile lookup failed:', profileErr?.message)
    }
    
    req.user = user
    req.userRole = role
    next()
  } catch (error) {
    logger.error('Auth middleware error:', error)
    return res.status(500).json({ error: 'Authentication error' })
  }
}

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { data: { user } } = await supabase.auth.getUser(token)
      req.user = user || null
    } else {
      req.user = null
    }
    
    next()
  } catch (error) {
    req.user = null
    next()
  }
}
