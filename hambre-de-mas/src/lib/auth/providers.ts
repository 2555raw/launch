/** Proveedores de acceso social activados (Google, Apple), separados por comas en NEXT_PUBLIC_AUTH_PROVIDERS. */
export const authProviders = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is 'google' | 'apple' => p === 'google' || p === 'apple')

export const hasSocialProviders = authProviders.length > 0
