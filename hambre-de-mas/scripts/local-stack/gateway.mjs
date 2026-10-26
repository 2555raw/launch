// Pasarela mínima que imita la URL única de Supabase:
//   /auth/v1/*    -> GoTrue
//   /rest/v1/*    -> PostgREST
//   /storage/v1/* -> Storage API
// Solo para el entorno local de pruebas.
import http from 'node:http'

const port = Number(process.env.GATEWAY_PORT ?? 54321)
const routes = [
  ['/auth/v1', Number(process.env.AUTH_PORT ?? 54331)],
  ['/rest/v1', Number(process.env.REST_PORT ?? 54330)],
  ['/storage/v1', Number(process.env.STORAGE_PORT ?? 54332)],
]

http
  .createServer((req, res) => {
    const route = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix + '/') || req.url.startsWith(prefix + '?'))
    if (!route) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end('{"message":"no route"}')
      return
    }
    const [prefix, target] = route
    const path = req.url.slice(prefix.length) || '/'
    const upstream = http.request(
      { host: '127.0.0.1', port: target, method: req.method, path, headers: { ...req.headers, host: `127.0.0.1:${target}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      },
    )
    upstream.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: err.message }))
    })
    req.pipe(upstream)
  })
  .listen(port, '127.0.0.1', () => console.log(`gateway on :${port}`))
