export class DomainError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export function assert(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message)
}

export function assertQty(value: number, label = 'La cantidad') {
  assert(Number.isFinite(value), 'QTY_INVALID', `${label} no es un número válido.`)
  assert(Number.isInteger(value), 'QTY_INVALID', `${label} debe ser un número entero.`)
  assert(value > 0, 'QTY_NOT_POSITIVE', `${label} debe ser mayor que cero.`)
}
