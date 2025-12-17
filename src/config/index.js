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
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173'
  }
}
