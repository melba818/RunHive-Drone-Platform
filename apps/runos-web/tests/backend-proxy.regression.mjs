import assert from 'node:assert/strict'

// Synthetic HTTP fixtures only. Run after a standalone build in an isolated
// network namespace. The caller owns startup/shutdown; no production discovery.
export function backendFixture(req, res, raw) {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (!url.pathname.startsWith('/api/b01-status/')) return false
  const status = Number(url.pathname.split('/').at(-1))
  assert.ok([200, 204, 400, 401, 403, 404, 500, 502, 503, 504].includes(status))
  res.statusCode = status
  res.setHeader('x-internal-diagnostic', 'SYNTHETIC_INTERNAL_CONFIG')
  res.setHeader('set-cookie', 'synthetic_upstream=not_a_session; HttpOnly')
  if (status === 204) { res.end(); return true }
  if (url.searchParams.get('format') === 'text') {
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(status >= 500 ? 'SYNTHETIC_INTERNAL_STACK' : 'synthetic text response')
    return true
  }
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({
    fixture: 'B01', method: req.method, body: raw ? JSON.parse(raw) : null,
    query: url.searchParams.get('value'),
    synthetic_authorization: req.headers.authorization === 'Bearer a12-synthetic-only',
    ...(status >= 500 ? { traceback: 'SYNTHETIC_INTERNAL_STACK' } : { detail: 'Synthetic public response' }),
  }))
  return true
}

function client(baseUrl, checks) {
  const base = new URL(baseUrl)
  assert.equal(base.protocol, 'http:')
  assert.equal(base.hostname, '127.0.0.1', 'Regression runner is restricted to IPv4 loopback')
  assert.equal(base.username + base.password, '')
  return async (name, endpoint, expected, options, verify) => {
    const response = await fetch(new URL(endpoint, base), { ...options, signal: AbortSignal.timeout(5000) })
    const text = await response.text()
    const check = { name, method: options?.method || 'GET', expected, status: response.status,
      content_type: response.headers.get('content-type'), pass: false }
    checks.push(check)
    try {
      assert.equal(response.status, expected)
      if (verify) verify(response, text)
      check.pass = true
    } catch (error) { check.failure = error.message }
  }
}

export async function runBackendRegression(baseUrl) {
  const checks = [], request = client(baseUrl, checks)
  const headers = { cookie: 'runos_session=a12-synthetic-only', 'content-type': 'application/json' }
  for (const method of ['GET', 'POST']) {
    const options = { method, headers, ...(method === 'POST' ? { body: JSON.stringify({ fixture: 'synthetic-only' }) } : {}) }
    for (const status of [200, 400, 401, 403, 404, 500, 502, 503, 504]) {
      const endpoint = '/api/b01-status/' + status + '?value=' + encodeURIComponent('a b&c')
      await request(`${method} upstream ${status}`, '/api/backend?endpoint=' + encodeURIComponent(endpoint), status, options, (response, text) => {
        assert.match(response.headers.get('content-type'), /^application\/json/i)
        assert.equal(response.headers.get('x-internal-diagnostic'), null)
        assert.equal(response.headers.get('set-cookie'), null)
        const body = JSON.parse(text)
        if (status >= 500) {
          assert.deepEqual(body, { error: 'Backend request failed.' })
          assert.ok(!text.includes('SYNTHETIC_INTERNAL'))
        } else {
          assert.equal(body.fixture, 'B01')
          assert.equal(body.method, method)
          assert.equal(body.query, 'a b&c')
          assert.equal(body.synthetic_authorization, true)
          assert.deepEqual(body.body, method === 'POST' ? { fixture: 'synthetic-only' } : null)
        }
      })
    }
    await request(`${method} preserves text success`, '/api/backend?endpoint=' + encodeURIComponent('/api/b01-status/200?format=text'), 200, options, (response, text) => {
      assert.match(response.headers.get('content-type'), /^text\/plain;\s*charset=utf-8/i)
      assert.equal(text, 'synthetic text response')
    })
    await request(`${method} empty 204`, '/api/backend?endpoint=/api/b01-status/204', 204, options, (_, text) => assert.equal(text, ''))
    await request(`${method} non-JSON 502 is sanitized`, '/api/backend?endpoint=' + encodeURIComponent('/api/b01-status/502?format=text'), 502, options, (response, text) => {
      assert.match(response.headers.get('content-type'), /^application\/json/i)
      assert.deepEqual(JSON.parse(text), { error: 'Backend request failed.' })
    })
    for (const endpoint of ['', '/health', 'https://invalid.example/api/']) {
      await request(`${method} rejects unsupported path ${endpoint || '(empty)'}`, '/api/backend?endpoint=' + encodeURIComponent(endpoint), 401, options,
        (_, text) => assert.deepEqual(JSON.parse(text), { detail: 'RunHive sign-in required' }))
    }
    await request(`${method} rejects missing session`, '/api/backend?endpoint=/api/b01-status/200', 401,
      { ...options, headers: { 'content-type': 'application/json' } },
      (_, text) => assert.deepEqual(JSON.parse(text), { detail: 'RunHive sign-in required' }))
  }
  return checks
}

export async function runBackendUnavailableRegression(baseUrl) {
  const checks = [], request = client(baseUrl, checks)
  for (const method of ['GET', 'POST']) {
    await request(`${method} unavailable dependency`, '/api/backend?endpoint=/api/b01-status/200', 503,
      { method, headers: { cookie: 'runos_session=a12-synthetic-only', 'content-type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}) }, (_, text) => {
        assert.deepEqual(JSON.parse(text), { error: 'Backend unavailable. Please ensure the Python backend is running.' })
        assert.ok(!text.includes('SYNTHETIC_INTERNAL'))
      })
  }
  return checks
}
