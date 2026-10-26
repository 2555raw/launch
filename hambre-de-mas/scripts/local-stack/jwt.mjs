// Firma las claves anon y service_role con el secreto JWT local (HS256).
import { createHmac } from 'node:crypto'

const secret = process.argv[2]
const role = process.argv[3]
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const header = b64({ alg: 'HS256', typ: 'JWT' })
const payload = b64({ iss: 'supabase-local', role, iat: 1700000000, exp: 2000000000 })
const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
process.stdout.write(`${header}.${payload}.${sig}`)
