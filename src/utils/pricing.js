const MB = 1024 * 1024

const clampNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const estimateWordsFromFileSize = (fileSizeBytes = 0) => {
  if (!fileSizeBytes) return 0
  const avgBytesPerWord = 5 // rough heuristic
  return Math.floor(fileSizeBytes / avgBytesPerWord)
}

export const calculateOneOffPrice = ({
  wordCount = 0,
  pageCount = 0,
  fileSize = 0
} = {}) => {
  const normalizedWordCount = clampNumber(wordCount) || estimateWordsFromFileSize(fileSize)
  const normalizedPageCount = clampNumber(pageCount)
  const normalizedFileSize = clampNumber(fileSize)

  const basePrice = 500 // $5.00 minimum
  const perWordCents = 2 // $0.02 per word
  const perPageCents = 200 // $2 per page
  const largeFileSurcharge = normalizedFileSize > 10 * MB
    ? 300 // $3 surcharge for files over 10MB
    : normalizedFileSize > 5 * MB
      ? 150 // $1.50 surcharge for files over 5MB
      : 0

  const wordCost = normalizedWordCount * perWordCents
  const pageCost = normalizedPageCount * perPageCents

  const amount = Math.max(basePrice, basePrice + wordCost + pageCost + largeFileSurcharge)

  return {
    amount,
    currency: 'usd',
    breakdown: {
      basePrice,
      wordCost,
      pageCost,
      largeFileSurcharge,
      wordCount: normalizedWordCount,
      pageCount: normalizedPageCount
    }
  }
}
