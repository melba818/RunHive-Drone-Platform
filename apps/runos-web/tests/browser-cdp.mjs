import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

// Chrome DevTools uses a private container-loopback listener, never a host port.
export async function launchBrowser({ executable, env, noSandbox = false, commandTimeout = 8000 }) {
  const args = ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--disable-gpu', '--disable-software-rasterizer',
    '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--disable-crash-reporter', '--disable-breakpad', '--password-store=basic',
    '--user-data-dir=/tmp/b03-profile-' + Date.now(), '--lang=en-US', 'about:blank']
  if (noSandbox) args.unshift('--no-sandbox')
  const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let sequence = 0, stderr = '', stdout = '', socket
  const pending = new Map(), events = [], listeners = new Map()
  child.stderr.on('data', b => { stderr += b; if (stderr.length > 1000000) child.kill() })
  child.stdout.on('data', b => { stdout += b; if (stdout.length > 1000000) child.kill() })
  function receive(line) {
      const message = JSON.parse(line)
      if (message.id) {
        const item = pending.get(message.id); if (!item) return
        clearTimeout(item.timer); pending.delete(message.id)
        message.error ? item.reject(Error(JSON.stringify(message.error))) : item.resolve(message.result)
      } else {
        if (events.length < 15000) events.push(message)
        for (const callback of listeners.get(message.method) || []) callback(message)
      }
  }
  child.on('error', error => { for (const item of pending.values()) item.reject(error) })
  child.on('exit', () => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Browser exited: ' + stderr.slice(-1600))) }
    pending.clear()
  })
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method + '; ' + stderr.slice(-1600))) }, commandTimeout)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }
  const on = (method, callback) => listeners.set(method, [...(listeners.get(method) || []), callback])
  on('Fetch.requestPaused', message => {
    const url = new URL(message.params.request.url)
    const allowed = url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '3000'
    void send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest',
      allowed ? { requestId: message.params.requestId } : { requestId: message.params.requestId, errorReason: 'BlockedByClient' }, message.sessionId).catch(() => {})
  })
  async function page(cookie) {
    const { browserContextId } = await send('Target.createBrowserContext')
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await send(domain + '.enable', {}, sessionId)
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId)
    if (cookie) await send('Network.setCookie', { name: 'runos_session', value: cookie, url: 'http://127.0.0.1:3000', httpOnly: true, sameSite: 'Lax' }, sessionId)
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
      if (result.exceptionDetails) throw Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description)
      return result.result.value
    }
    const navigate = async pathname => {
      if (!pathname.startsWith('/') || pathname.startsWith('//')) throw Error('Only local application paths permitted')
      await send('Page.navigate', { url: 'http://127.0.0.1:3000' + pathname }, sessionId)
    }
    const waitFor = async (expression, timeout = 7000) => {
      const start = Date.now(); let value
      while (Date.now() - start < timeout) {
        try { value = await evaluate(expression); if (value) return value } catch {}
        await new Promise(r => setTimeout(r, 100))
      }
      throw Error('Observable browser condition not met: ' + expression.slice(0, 200))
    }
    return { browserContextId, sessionId, targetId, evaluate, navigate, waitFor,
      screenshot: async filename => {
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
        if (data.length > 3 * 1024 * 1024) throw Error('Screenshot bound exceeded')
        writeFileSync(filename, Buffer.from(data, 'base64'))
      },
      close: () => send('Target.disposeBrowserContext', { browserContextId }) }
  }
  try {
    let endpoint
    for (let i = 0; i < 80; i++) {
      endpoint = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/)?.[1]
      if (endpoint) break
      if (child.exitCode !== null) throw Error('Browser startup failed: ' + stderr.slice(-2500))
      await new Promise(r => setTimeout(r, 100))
    }
    if (!endpoint) throw Error('No private browser debugging endpoint: ' + stderr.slice(-2500))
    const parsed = new URL(endpoint)
    if (parsed.hostname !== '127.0.0.1') throw Error('Browser endpoint escaped loopback')
    socket = new WebSocket(endpoint)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    socket.addEventListener('message', event => receive(String(event.data)))
    const version = await send('Browser.getVersion')
    return { version, page, send, events, get stderr() { return stderr },
      close: async () => { try { await send('Browser.close') } catch {} socket.close(); child.kill('SIGTERM') } }
  } catch (error) { socket?.close(); child.kill('SIGTERM'); throw error }
}
