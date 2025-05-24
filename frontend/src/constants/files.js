export const MIME_TYPES = {
  PDF: 'application/pdf',
  TXT: 'text/plain',
  MD: 'text/markdown',
  MD_ALT: 'text/x-markdown',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ODT: 'application/vnd.oasis.opendocument.text'
}

export const FILE_EXTENSIONS = {
  PDF: '.pdf',
  TXT: '.txt',
  MD: '.md',
  DOCX: '.docx',
  ODT: '.odt'
}

export const FILE_TYPE_LABELS = {
  PDF: 'PDF',
  TXT: 'TXT',
  MD: 'MD',
  DOCX: 'DOCX',
  ODT: 'ODT'
}

// For input accept attribute
export const ACCEPTED_FILE_TYPES = Object.values(FILE_EXTENSIONS).join(',')

// For display in UI
export const SUPPORTED_FORMATS = Object.values(FILE_TYPE_LABELS).join(', ')

// Maximum file size in bytes (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024

export function getFileTypeByExtension(filename) {
  const ext = '.' + filename.toLowerCase().split('.').pop()
  return Object.entries(FILE_EXTENSIONS).find(([_, value]) => value === ext)?.[0]
}

export function getFileTypeByMime(mimeType) {
  return Object.entries(MIME_TYPES).find(([_, value]) => value === mimeType)?.[0]
} 