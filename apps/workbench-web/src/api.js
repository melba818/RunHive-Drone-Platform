import { d as createAxios, u as useAdminInfo } from '/assets/index-D5rXB33a.js'
export const BASE = '/llm-center/agent/platform'
let current = '',
  csrf = '',
  connecting = null,
  checkedAt = 0
const identity = () => {
  const a = useAdminInfo()
  return `${a.id}:${a.token}`
}
export async function session(force = false) {
  const key = identity()
  if (current !== key) {
    current = key
    csrf = ''
    connecting = null
    checkedAt = 0
  }
  if (!force && csrf && Date.now() - checkedAt < 120000) return { tenant_id: Number(useAdminInfo().id), csrf }
  if (connecting) return connecting
  connecting = (async () => {
    let response = await fetch(BASE + '/session', { credentials: 'same-origin', cache: 'no-store' })
    if (response.status === 401) {
      const value = await createAxios(
        { url: '/admin/Llmcenter/launch', method: 'post', data: { module: 'agent', section: 'projects' } },
        { showSuccessMessage: false, cancelDuplicateRequest: false },
      )
      if (key !== identity()) throw Error('登录状态已更新。')
      const exchange = await fetch('/llm-center/agent/auth/exchange', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: value.data.ticket }),
      })
      if (!exchange.ok) throw Error('中心连接未完成，请重新登录。')
      response = await fetch(BASE + '/session', { credentials: 'same-origin', cache: 'no-store' })
    }
    const result = await response.json()
    if (!response.ok || key !== identity() || result.tenant_id !== Number(useAdminInfo().id))
      throw Error('账号授权已失效，请重新登录。')
    csrf = result.csrf
    checkedAt = Date.now()
    return result
  })()
  try {
    return await connecting
  } finally {
    connecting = null
  }
}
export async function api(path, method = 'GET', body, signal) {
  const key = identity()
  await session()
  const response = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-Platform-CSRF': csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const value = await response.json().catch(() => ({ message: '服务返回内容无效。' }))
  if (key !== identity()) throw Error('登录状态已更新。')
  if (!response.ok) {
    const message =
      typeof value.detail === 'string'
        ? value.detail
        : value.message || value.detail?.message || '操作未完成。'
    throw Error(message)
  }
  return value
}
export async function upload(file, parent = '', metadata = {}, onProgress = () => {}) {
  const key = identity()
  await session()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      BASE +
        '/resources/upload?' +
        new URLSearchParams({ name: file.name, parent, metadata: JSON.stringify(metadata) }),
    )
    xhr.setRequestHeader('X-Platform-CSRF', csrf)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const value = JSON.parse(xhr.responseText)
        if (key !== identity()) throw Error('账号已切换。')
        if (xhr.status >= 400)
          throw Error(typeof value.detail === 'string' ? value.detail : value.message || '上传失败。')
        resolve(value)
      } catch (e) {
        reject(e)
      }
    }
    xhr.onerror = () => reject(Error('上传连接中断，请重试。'))
    xhr.send(file)
  })
}
