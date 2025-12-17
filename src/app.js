import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/errorHandler.js'
import { rateLimiter } from './middleware/rateLimiter.js'
import filesRouter from './routes/files.js'
import translationsRouter from './routes/translations.js'
import paymentsRouter from './routes/payments.js'
import webhooksRouter from './routes/webhooks.js'
import healthRouter from './routes/health.js'
import notificationsRouter from './routes/notifications.js'
import languagesRouter from './routes/languages.js'

const app = express()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

// Webhooks need raw body for signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }))

// Parse JSON for other routes
app.use(express.json({ limit: '10mb' }))

// Rate limiting
app.use('/api', rateLimiter)

// Routes
app.use('/api/health', healthRouter)
app.use('/api/files', filesRouter)
app.use('/api/translations', translationsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/webhooks', webhooksRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/languages', languagesRouter)

// Error handling
app.use(errorHandler)

export default app
