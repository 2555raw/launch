// Servidor SMTP de pega: acepta cualquier correo y lo guarda como .eml para
// que las pruebas puedan leer enlaces de confirmación o recuperación.
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

const port = Number(process.env.SMTP_PORT ?? 54325)
const dir = process.env.MAIL_DIR ?? '/tmp/hdm-mail'
fs.mkdirSync(dir, { recursive: true })

net
  .createServer((socket) => {
    let data = false
    let buffer = ''
    let message = ''
    let rcpt = []
    const reply = (line) => socket.write(line + '\r\n')
    reply('220 localhost ESMTP sink')
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      let idx
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        if (data) {
          if (line === '.') {
            data = false
            const file = path.join(dir, `${Date.now()}-${rcpt.join(',').replace(/[^a-z0-9@.,_-]/gi, '')}.eml`)
            fs.writeFileSync(file, message)
            message = ''
            rcpt = []
            reply('250 OK')
          } else {
            message += (line.startsWith('..') ? line.slice(1) : line) + '\n'
          }
          continue
        }
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'EHLO' || cmd === 'HELO') reply('250 localhost')
        else if (cmd === 'MAIL') reply('250 OK')
        else if (cmd === 'RCPT') {
          rcpt.push(line.replace(/^RCPT TO:\s*/i, '').replace(/[<>]/g, ''))
          reply('250 OK')
        } else if (cmd === 'DATA') {
          data = true
          reply('354 End data with <CR><LF>.<CR><LF>')
        } else if (cmd === 'QUIT') {
          reply('221 Bye')
          socket.end()
        } else reply('250 OK')
      }
    })
  })
  .listen(port, '127.0.0.1', () => console.log(`smtp sink on :${port} -> ${dir}`))
