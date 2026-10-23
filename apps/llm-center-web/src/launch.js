import { sectionInfo } from './sections.js'

export function validateLaunch(data, origin, module, section) {
  sectionInfo(module, section)
  const adminId = Number(data?.admin_id)
  if (
    !Number.isSafeInteger(adminId) ||
    adminId <= 0 ||
    data?.module !== module ||
    typeof data?.ticket !== 'string' ||
    !data.ticket ||
    data.ticket.length > 2048
  ) {
    throw new Error('账号验证信息不完整，请重新连接。')
  }
  const url = new URL(data?.launch_url || '', origin)
  if (
    url.origin !== origin ||
    url.pathname !== `/llm-center/${module}/` ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('工作区启动地址无效，请联系管理员。')
  }
  url.hash = new URLSearchParams({
    ticket: data.ticket,
    admin_id: String(adminId),
    module,
    section,
  }).toString()
  return { url: url.toString(), adminId, module }
}

export function isWorkspaceMessage(event, frameWindow, origin, adminId, module) {
  if (
    !frameWindow ||
    event.source !== frameWindow ||
    event.origin !== origin ||
    !event.data ||
    typeof event.data !== 'object' ||
    Number(event.data.admin_id) !== adminId ||
    event.data.module !== module
  )
    return false
  const { source, type } = event.data
  return (
    (source === 'llm-center-auth-gate' &&
      ['llm-center-auth-ready', 'llm-center-auth-error'].includes(type)) ||
    (source === 'llm-center-content' &&
      (['llm-section-ready', 'llm-section-error'].includes(type) ||
        (module === 'tune' &&
          ['llm-resource-menu', 'llm-resource-success', 'llm-resource-failed'].includes(type))))
  )
}

export function chineseError(error, fallback = '工作区暂时无法打开，请稍后重新连接。') {
  const message = String(error?.message || '')
  return /[\u3400-\u9fff]/u.test(message) &&
    message.length <= 160 &&
    !/Traceback|Exception|LLaMA.?Factory|Penguin|https?:\/\//iu.test(message)
    ? message
    : fallback
}
