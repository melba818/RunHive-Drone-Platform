import assert from 'node:assert/strict'
import { launchBrowser } from './browser-cdp.mjs'
import { fixtureTokens } from './auth-tenant.regression.mjs'

export async function browserRegression({ executable, env, services, resultsDirectory }) {
  let browser
  const cases = [], preparation = [], pages = []
  try {
    browser = await launchBrowser({ executable, env })
    preparation.push({ sandbox: 'default', status: 'PASS' })
  } catch (error) {
    preparation.push({ sandbox: 'default', status: 'BLOCKED', error: error.message })
    // Compatibility is explicit and recorded: no browser sandbox, but the
    // caller must enforce the non-root/no-network/read-only Docker boundary.
    browser = await launchBrowser({ executable, env, noSandbox: true })
    preparation.push({ sandbox: 'disabled inside strongly restricted Docker only', status: 'PASS', limitation: 'Not a Chromium sandbox security certification' })
  }
  async function check(name, operation) {
    const entry = { name, status: 'FAIL' }
    try { entry.actual = await operation(); entry.status = 'PASS' } catch (error) { entry.error = error.message }
    cases.push(entry)
  }
  async function make(token) { const page = await browser.page(token); pages.push(page); return page }
  async function click(page, selectorExpression) {
    const rect = await page.evaluate(`(()=>{const e=${selectorExpression};if(!e)throw Error('Existing control absent');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    for (const [type, buttons] of [['mousePressed', 1], ['mouseReleased', 0]]) await browser.send('Input.dispatchMouseEvent', { type, ...rect, button: 'left', clickCount: 1, buttons }, page.sessionId)
  }
  const button = text => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)})`
  const input = `document.querySelector('input[placeholder="/path/to/models"]')`
  async function type(page, value) {
    await page.evaluate(`(${input}).focus()`)
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }, page.sessionId)
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }, page.sessionId)
    await browser.send('Input.insertText', { text: value }, page.sessionId)
    await page.waitFor(`(${input}).value===${JSON.stringify(value)}`)
  }
  let anonymous, a, b
  try {
    await check('Anonymous page hydrates into visible authentication denial', async () => {
      anonymous = await make(); await anonymous.navigate('/')
      return await anonymous.waitFor(`document.body.innerText.includes('RunOS 账号验证')&&document.body.innerText.includes('请先登录')`)
    })
    await check('Real browser ticket exchange establishes HttpOnly session and clears fragment', async () => {
      await anonymous.navigate('/datasets#ticket=' + 'd'.repeat(64) + '&admin_id=1')
      await anonymous.waitFor(`!!document.querySelector('aside')&&location.hash===''`)
      assert.equal(await anonymous.evaluate(`fetch('/api/runos-auth/identity').then(r=>r.json()).then(x=>x.admin_id)`), 1)
      assert.ok(!await anonymous.evaluate(`document.cookie.includes('runos_session')`))
      return { authenticated_as: 1, fragment_cleared: true, session_not_script_readable: true }
    })
    await check('Authenticated root renders real client workspace', async () => {
      a = await make(fixtureTokens.a); await a.navigate('/')
      await a.waitFor(`!!document.querySelector('aside')&&!!(${button('设置')})`)
      const detail = await a.evaluate(`({title:document.title,buttons:document.querySelectorAll('button').length,css:document.styleSheets.length,text:document.body.innerText.length,ready:document.readyState})`)
      assert.equal(detail.title, 'RunOS'); assert.ok(detail.buttons > 5 && detail.css > 0 && detail.text > 80)
      return detail
    })
    await check('Trusted click updates React view and client route', async () => {
      await click(a, button('设置')); await a.waitFor(`location.pathname==='/settings'&&!!document.querySelector('input[placeholder="/path/to/models"]')`)
      return { path: await a.evaluate('location.pathname') }
    })
    await check('Real form input updates state and successful save synchronizes synthetic backend', async () => {
      await type(a, '/synthetic-models'); await click(a, `[...document.querySelectorAll('button')].find(e=>/保存修改|已保存/.test(e.textContent))`)
      await a.waitFor(`document.body.innerText.includes('已保存')`)
      assert.equal(services.settings.models_path, '/synthetic-models')
      return { server_path: services.settings.models_path, local_persistence: await a.evaluate(`JSON.parse(localStorage.getItem('cv-dataset-manager-settings')).modelsPath==='/synthetic-models'`) }
    })
    await check('Loading state and connection result are observable', async () => {
      services.flags.healthDelay = 500; await click(a, button('测试'))
      await a.waitFor(`document.body.innerText.includes('检测中')`)
      await a.waitFor(`document.body.innerText.includes('已连接')`)
      services.flags.healthDelay = 0; return true
    })
    await check('Failed settings sync is not displayed as successful save', async () => {
      services.flags.settingsFailure = true; await type(a, '/synthetic-unsaved')
      await click(a, `[...document.querySelectorAll('button')].find(e=>/保存修改|已保存/.test(e.textContent))`)
      await a.waitFor(`!!document.querySelector('[role="alert"]')&&document.querySelector('[role="alert"]').innerText.includes('未能同步')`)
      assert.ok(!await a.evaluate(`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='已保存')`))
      return { server_unchanged: services.settings.models_path === '/synthetic-models' }
    })
    services.flags.settingsFailure = false; services.flags.healthDelay = 0
    await check('Dataset-required route guard works after client navigation', async () => {
      await click(a, button('图库')); await a.waitFor(`location.pathname==='/gallery'&&document.body.innerText.includes('未选择数据集')`); return true
    })
    await check('Browser history restores prior React route', async () => {
      await a.evaluate('history.back()'); await a.waitFor(`location.pathname==='/settings'&&!!document.querySelector('input[placeholder="/path/to/models"]')`); return true
    })
    await check('Valid dynamic page initializes through direct navigation', async () => {
      await a.navigate('/datasets'); await a.waitFor(`!!document.querySelector('aside')&&location.pathname==='/datasets'`); return true
    })
    await check('Two independent browser contexts retain distinct authenticated identity', async () => {
      b = await make(fixtureTokens.b); await b.navigate('/datasets'); await b.waitFor(`!!document.querySelector('aside')`)
      const evaluateIdentity = p => p.evaluate(`fetch('/api/runos-auth/identity').then(r=>r.json()).then(x=>x.admin_id)`)
      assert.equal(await evaluateIdentity(a), 1); assert.equal(await evaluateIdentity(b), 2)
      assert.notEqual(a.browserContextId, b.browserContextId); return { a: 1, b: 2 }
    })
    await check('HttpOnly session cookie is not readable by page JavaScript', async () => {
      assert.ok(!await a.evaluate(`document.cookie.includes('runos_session')`)); return true
    })
    const normalEventsEnd = browser.events.length
    await check('Normal pages have no hydration mismatch or unhandled JavaScript exception', async () => {
      const severe = browser.events.slice(0, normalEventsEnd).filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' && /hydration|did not match|Minified React error/i.test(JSON.stringify(e.params))))
      assert.deepEqual(severe, []); return { unhandled_exceptions: severe.length }
    })
    await a.screenshot(resultsDirectory + '/B03-workspace.png')
    await check('Warm route initializes authentication with intentionally empty content', async () => {
      const warm = await make(fixtureTokens.a); const before = services.observed.length
      await warm.navigate('/warm'); await warm.waitFor(`document.readyState==='complete'`)
      for (let i = 0; i < 40 && services.observed.length <= before; i++) await new Promise(r => setTimeout(r, 100))
      assert.ok(services.observed.slice(before).some(x => x.path === '/api/auth/me'))
      return { body_text: await warm.evaluate('document.body.innerText.trim()'), white_screen_check: 'NOT_APPLICABLE: warm intentionally returns null' }
    })
    await check('Framework not-found page renders 404 boundary', async () => {
      const error = await make(fixtureTokens.a); await error.navigate('/_not-found')
      await error.waitFor(`document.body.innerText.includes('404')`)
      return { text: await error.evaluate('document.body.innerText.slice(0,150)') }
    })
    await check('Expired browser session shows denial after reload without affecting other context', async () => {
      await browser.send('Network.setCookie', { name: 'runos_session', value: 'expired-synthetic', url: 'http://127.0.0.1:3000', httpOnly: true, sameSite: 'Lax' }, a.sessionId)
      await a.navigate('/'); await a.waitFor(`document.body.innerText.includes('RunOS 账号验证')`)
      assert.equal(await b.evaluate(`fetch('/api/runos-auth/identity').then(r=>r.json()).then(x=>x.admin_id)`), 2)
      return true
    })
    const responses = browser.events.filter(e => e.method === 'Network.responseReceived').map(e => ({ url: e.params.response.url, status: e.params.response.status, mime: e.params.response.mimeType, type: e.params.type }))
    await check('Generated CSS and JavaScript actually load in browser', async () => {
      const staticResources = responses.filter(r => r.url.includes('/_next/static/'))
      assert.ok(staticResources.some(r => r.type === 'Script') && staticResources.some(r => r.type === 'Stylesheet'))
      assert.ok(staticResources.every(r => r.status === 200)); return { loaded: staticResources.length }
    })
    return { status: cases.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', version: browser.version, preparation, cases,
      response_log: responses, console: browser.events.filter(e => ['Runtime.exceptionThrown', 'Runtime.consoleAPICalled', 'Log.entryAdded', 'Network.loadingFailed'].includes(e.method)).map(e => ({ method: e.method, session: e.sessionId, details: e.params })),
      browser_stderr: browser.stderr, observations: [
        'HTTPS and real cross-site Secure/SameSite behavior NOT_RUN; local HTTP only.',
        'No server logout endpoint exists in approved Web routes; cookie deletion/reload tested, automatic expiry UI refresh not certified.',
        'B02 icon rights/source remains BLOCKED; its HTML fallback is not a successful SVG.',
        'Real backend authorization and multi-tenant data correctness remain outside synthetic Web verification.' ] }
  } finally {
    for (const page of pages) try { await page.close() } catch {}
    await browser.close()
  }
}
