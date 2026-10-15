// Capture the web UI at exactly 1920x1080 with headless Chrome over CDP.
// usage: node tools/shot.mjs <url> <out.png> [--keys Left,Down,...] [--wait ms] [--keywait ms]
// Keys go through the app's window.__tv.press() hook, --keywait apart (default 400 ms), and the
// screenshot is taken --wait ms after the last key (default 1200 ms).
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(name)
  if (i < 0) return def
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const keys = opt('--keys', '').split(',').filter(Boolean)
const wait = +opt('--wait', 1200)
const keywait = +opt('--keywait', 400)
const [url, out] = args
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [--keys K1,K2] [--wait ms] [--keywait ms]')
  process.exit(2)
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9400 + Math.floor(Math.random() * 400)
const profile = mkdtempSync(join(tmpdir(), 'tvshot-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080',
  '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { stdio: 'ignore' })

const sleep = ms => new Promise(r => setTimeout(r, ms))
let list
for (let i = 0; i < 50 && !list; i++) {
  await sleep(100)
  try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { /* not up yet */ }
}
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl)
let id = 0
const pending = {}
const events = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pending[m.id]) pending[m.id](m)
  else if (m.method) events.push(m)
}
await new Promise(r => (ws.onopen = r))
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id
    pending[i] = m => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result))
    ws.send(JSON.stringify({ id: i, method, params }))
  })

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url })
  for (let i = 0; i < 100 && !events.some(e => e.method === 'Page.loadEventFired'); i++) await sleep(100)
  await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
  await sleep(500)
  for (const k of keys) {
    await send('Runtime.evaluate', { expression: `window.__tv.press(${JSON.stringify(k)})` })
    await sleep(keywait)
  }
  await sleep(wait)
  const errors = events.filter(e => e.method === 'Runtime.exceptionThrown')
  for (const e of events) {
    if (e.method === 'Network.responseReceived' && e.params.response.status >= 400)
      console.error(`HTTP ${e.params.response.status}: ${e.params.response.url}`)
    if (e.method === 'Network.loadingFailed' && !e.params.canceled) {
      const req = events.find(r => r.method === 'Network.requestWillBeSent' && r.params.requestId === e.params.requestId)
      console.error(`failed: ${e.params.errorText} ${req?.params.request.url ?? ''}`)
    }
  }
  for (const e of errors) console.error('page error:', e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log(out)
} finally {
  ws.close()
  chrome.kill()
  await sleep(200)
  rmSync(profile, { recursive: true, force: true })
}
process.exit(0)
