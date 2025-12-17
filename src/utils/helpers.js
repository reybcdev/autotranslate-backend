export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}
