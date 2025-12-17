import { supabase } from '../config/supabase.js'
import { logger } from '../utils/logger.js'

export const createFileRecord = async (userId, filename, filePath, fileSize, mimeType) => {
  const { data, error } = await supabase
    .from('files')
    .insert({
      user_id: userId,
      filename,
      file_path: filePath,
      file_size: fileSize,
      mime_type: mimeType,
      status: 'uploaded'
    })
    .select()
    .single()
  
  if (error) {
    logger.error('Error creating file record:', error)
    throw error
  }
  
  return data
}

export const updateFileStatus = async (fileId, status) => {
  const { error } = await supabase
    .from('files')
    .update({ status })
    .eq('id', fileId)
  
  if (error) {
    logger.error('Error updating file status:', error)
    throw error
  }
}

export const deleteFile = async (fileId, userId) => {
  // Get file info
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single()
  
  if (fetchError || !file) {
    throw new Error('File not found')
  }
  
  // Delete from storage
  await supabase.storage.from('uploads').remove([file.file_path])
  
  // Delete record
  await supabase.from('files').delete().eq('id', fileId)
  
  return true
}
