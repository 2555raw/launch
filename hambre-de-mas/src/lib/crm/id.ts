/** Identificador corto y estable de un cliente a partir de su email (FNV-1a), para no poner el email en la URL. */
export function customerId(email: string): string {
  let h = 0x811c9dc5
  const s = email.trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let h2 = 0x9e3779b9
  for (let i = s.length - 1; i >= 0; i--) {
    h2 ^= s.charCodeAt(i)
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36)
}
