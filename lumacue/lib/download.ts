/** Saves a Blob as a file download in the browser. */
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  // Some browsers start the download after click() returns: free the URL a moment later.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** A show name as a safe file name. */
export function safeFileName(name: string) {
  return name.replace(/[^\w-]+/g, '_') || 'show'
}
