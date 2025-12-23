export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },
  
  translation: {
    googleApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
    deeplApiKey: process.env.DEEPL_API_KEY
  },
  
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    replyTo: process.env.RESEND_REPLY_TO || process.env.RESEND_FROM_EMAIL
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173'
  }
}
