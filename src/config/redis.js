import Redis from 'ioredis'
import { config } from './index.js'
import { logger } from '../utils/logger.js'

let redis = null

export const getRedisConnection = () => {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })
    
    redis.on('connect', () => {
      logger.info('Redis connected')
    })
    
    redis.on('error', (err) => {
      logger.error('Redis error:', err)
    })
  }
  return redis
}

export const closeRedisConnection = async () => {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
