export function isR2S3Endpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.r2.cloudflarestorage.com') &&
      (url.pathname === '' || url.pathname === '/')
    )
  } catch {
    return false
  }
}
