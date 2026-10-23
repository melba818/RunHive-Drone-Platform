import http from 'node:http'
import assert from 'node:assert/strict'

export const fixtureTokens = { a: 'a12-synthetic-only', b: 'b04-synthetic-user-b' }
export async function syntheticServices() {
  const flags = { authFailure: 0, workerOwner: 2, settingsFailure: false, healthDelay: 0, crossData: false }
  const observed = [], settings = { models_path: '/models', datasets_path: '/datasets', output_path: '/output', use_gpu: false, gpu_device: '-1' }
  const handler = owner => async (req, res) => {
    let raw = ''; for await (const b of req) { raw += b; if (raw.length > 8192) { res.writeHead(413); res.end(); return } }
    const url = new URL(req.url, 'http://127.0.0.1')
    const identity = req.headers.authorization === 'Bearer ' + fixtureTokens.a ? 1 : req.headers.authorization === 'Bearer ' + fixtureTokens.b ? 2 : null
    observed.push({ owner, path: req.url, method: req.method, authenticated_as: identity })
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (url.pathname === '/api/auth/me') {
      if (flags.authFailure) return json(flags.authFailure, { detail: 'SYNTHETIC_INTERNAL_STACK', connection: 'SYNTHETIC_INTERNAL_CONFIG' })
      if (!identity) return json(401, { detail: 'Synthetic session expired' })
      return json(200, { admin_id: identity, name: 'Synthetic User ' + (identity === 1 ? 'A' : 'B'), tenant_id: identity === 1 ? 'a' : 'b' })
    }
    if (url.pathname === '/api/auth/exchange') {
      const ticket = JSON.parse(raw).ticket
      if (ticket === 'c'.repeat(64)) return json(401, { detail: 'Synthetic ticket expired' })
      if (ticket === 'f'.repeat(64)) return json(200, { account: { admin_id: 1 } })
      const id = ticket === 'e'.repeat(64) ? 2 : 1
      return json(200, { access_token: id === 1 ? fixtureTokens.a : fixtureTokens.b, expires_in: 60, account: { admin_id: id } })
    }
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      if (flags.healthDelay) await new Promise(r => setTimeout(r, flags.healthDelay))
      return json(200, { status: 'healthy', tenant_admin_id: owner === 2 ? flags.workerOwner : 1 })
    }
    if (url.pathname === '/api/tenant-resource' || url.pathname.startsWith('/api/tenants/')) {
      const desired = url.searchParams.get('tenant_id') || (url.pathname.includes('/tenants/b/') ? 'b' : null)
      const tenant = owner === 1 ? 'a' : 'b'
      if (identity !== owner || (desired && desired !== tenant)) return json(403, { detail: 'Synthetic backend ACL denied' })
      return json(200, { tenant_id: flags.crossData ? (tenant === 'a' ? 'b' : 'a') : tenant, fixture: true })
    }
    if (url.pathname === '/api/sensitive-failure') return json(500, { detail: 'SYNTHETIC_INTERNAL_STACK', connection: 'SYNTHETIC_INTERNAL_CONFIG' })
    if (url.pathname === '/api/settings') {
      if (req.method === 'POST') {
        if (flags.settingsFailure) return json(503, { detail: 'Synthetic settings unavailable' })
        Object.assign(settings, JSON.parse(raw))
      }
      return json(200, settings)
    }
    if (url.pathname === '/api/datasets') return json(200, { datasets: [] })
    if (url.pathname === '/api/hardware') return json(200, { platform: 'synthetic', python_version: 'fixture', cuda_available: false, cuda_version: null, gpu_count: 0, gpus: [], cpu_cores: 2, cpu_model: 'synthetic', ram_total_gb: 6, ram_available_gb: 4 })
    if (url.pathname === '/api/device-info') return json(200, { gpu_status: { state: 'no_gpu' } })
    if (req.method !== 'GET') return json(405, { detail: 'Not an approved synthetic mutation' })
    return json(200, {})
  }
  const control = http.createServer(handler(1)), worker = http.createServer(handler(2))
  for (const [server, port] of [[control, 8010], [worker, 20002]]) await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  return { flags, observed, settings, close: async () => { for (const server of [control, worker]) if (server.listening) await new Promise(r => server.close(r)) } }
}

export async function authTenantRegression(base, services) {
  assert.equal(new URL(base).origin, 'http://127.0.0.1:3000')
  const cases = [], observations = []
  const headers = token => ({ cookie: 'runos_session=' + token })
  async function check(name, path, expected, options = {}, verify = () => {}, boundary = 'Web authentication/selection') {
    const entry = { name, path, method: options.method || 'GET', expected, boundary, status: 'FAIL' }
    try {
      const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(5000) }); const text = await response.text()
      entry.actual = response.status
      assert.equal(response.status, expected); verify(response, text); entry.status = 'PASS'
    } catch (error) { entry.error = error.message }
    cases.push(entry)
  }
  const noLeak = (_, text) => assert.ok(!/SYNTHETIC_INTERNAL/.test(text), 'Upstream internal diagnostics must not be exposed')
  for (const path of ['/api/runos-auth/identity', '/api/runos-auth/session', '/api/proxy/api/tenant-resource', '/api/backend?endpoint=/api/tenant-resource']) await check('Anonymous denied', path, 401)
  for (const token of ['invalid-synthetic', 'expired-synthetic']) for (const path of ['/api/runos-auth/identity', '/api/runos-auth/session']) {
    await check('Invalid/expired session cleared', path, 401, { headers: headers(token) }, (r, body) => {
      assert.match(r.headers.get('set-cookie') || '', /runos_session=;/)
      assert.ok(!body.includes(token))
    })
  }
  for (const [tenant, token, admin] of [['a', fixtureTokens.a, 1], ['b', fixtureTokens.b, 2]]) {
    await check('Authenticated identity ' + tenant, '/api/runos-auth/identity', 200, { headers: headers(token) }, (r, text) => {
      assert.equal(JSON.parse(text).admin_id, admin); assert.equal(r.headers.get('cache-control'), 'no-store')
    })
    await check('Authenticated worker ' + tenant, '/api/runos-auth/session', 200, { headers: headers(token) }, (_, text) => assert.equal(JSON.parse(text).backend_port, admin === 1 ? 8010 : 20002))
    await check('Own tenant resource ' + tenant, '/api/proxy/api/tenant-resource', 200, { headers: headers(token) }, (_, text) => assert.equal(JSON.parse(text).tenant_id, tenant))
    const other = tenant === 'a' ? 'b' : 'a'
    await check('Cross tenant query denied by fixture backend ' + tenant, '/api/proxy/api/tenant-resource?tenant_id=' + other, 403, { headers: headers(token) }, () => {}, 'Mock ACL only; not real backend proof')
  }
  await check('Forged tenant/Authorization headers cannot select another worker', '/api/proxy/api/tenant-resource?tenant_id=a', 200,
    { headers: { ...headers(fixtureTokens.a), authorization: 'Bearer ' + fixtureTokens.b, 'x-tenant-id': 'b' } }, (_, text) => assert.equal(JSON.parse(text).tenant_id, 'a'))
  await check('Forged tenant route still reaches authenticated worker', '/api/proxy/api/tenants/b/resource', 403, { headers: headers(fixtureTokens.a) }, () => {}, 'Web worker selection + Mock ACL')
  services.flags.workerOwner = 1
  await check('Mismatched worker owner blocked without leaking port', '/api/proxy/api/tenant-resource', 503, { headers: headers(fixtureTokens.b) }, (_, text) => assert.ok(!text.includes('20002')))
  services.flags.workerOwner = 2
  const exchange = ticket => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }) })
  await check('Malformed ticket rejected locally', '/api/runos-auth/exchange', 400, exchange('invalid'))
  await check('Expired ticket rejected upstream', '/api/runos-auth/exchange', 401, exchange('c'.repeat(64)))
  for (const [ticket, tenant] of [['d', 'a'], ['e', 'b']]) await check('Synthetic ticket exchange ' + tenant, '/api/runos-auth/exchange', 200, exchange(ticket.repeat(64)), (r, text) => {
    assert.match(r.headers.get('set-cookie'), /HttpOnly/i); assert.match(r.headers.get('set-cookie'), /SameSite=Lax/i)
    assert.equal(JSON.parse(text).account.admin_id, tenant === 'a' ? 1 : 2)
    assert.ok(!text.includes(fixtureTokens.a) && !text.includes(fixtureTokens.b))
  })
  await check('Malformed successful exchange is not successful login', '/api/runos-auth/exchange', 502, exchange('f'.repeat(64)), (r) => assert.equal(r.headers.get('set-cookie'), null))
  await check('HTTPS-forwarded cookie attribute (not HTTPS browser proof)', '/api/runos-auth/exchange', 200,
    { ...exchange('d'.repeat(64)), headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' } }, r => assert.match(r.headers.get('set-cookie'), /; Secure/i))
  services.flags.authFailure = 503
  for (const path of ['/api/runos-auth/identity', '/api/runos-auth/session', '/api/proxy/api/tenant-resource', '/api/backend?endpoint=/api/tenant-resource']) await check('Auth service unavailable has no diagnostic leak', path, 503, { headers: headers(fixtureTokens.a) }, noLeak)
  services.flags.authFailure = 0
  await check('Proxy upstream internal error sanitized', '/api/proxy/api/sensitive-failure', 500, { headers: headers(fixtureTokens.a) }, noLeak)
  services.flags.crossData = true
  await check('Observe payload boundary of compromised synthetic backend', '/api/proxy/api/tenant-resource', 200, { headers: headers(fixtureTokens.a) }, (_, text) => {
    observations.push({ scope: 'Real backend tenant ACL', status: 'BLOCKED', observed_tenant: JSON.parse(text).tenant_id,
      finding: 'Web selects worker A but forwards backend-supplied tenant B payload; no Web payload-level authorization is claimed.' })
  }, 'Observation only; cannot certify tenant authorization')
  services.flags.crossData = false
  await services.close()
  for (const path of ['/api/runos-auth/identity', '/api/backend?endpoint=/api/tenant-resource']) await check('Control network unavailable', path, 503, { headers: headers(fixtureTokens.a) }, noLeak)
  return { cases, observations, backend_requests: services.observed, https_browser_semantics: 'NOT_RUN: HTTPS/cross-site environment unavailable', real_backend_acl: 'BLOCKED: synthetic backend only' }
}
