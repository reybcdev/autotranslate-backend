import { Queue } from 'bullmq'
import { getRedisConnection } from '../config/redis.js'

export const translationQueue = new Queue('translations', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50
  }
})
