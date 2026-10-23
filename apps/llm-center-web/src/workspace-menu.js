const icons = {
  pin: 'M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6M12 14v7',
  rename: 'M4 17v3h3L20 7l-3-3L4 17M14 7l3 3',
  archive: 'M3 4h18v4H3V4M5 8v12h14V8M9 12h6',
  copy: 'M9 9h11v11H9V9M5 15H3V3h12v2',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
  detail: 'M4 3h16v18H4V3M8 7h8M8 11h8M8 15h5',
  log: 'M4 3h16v18H4V3M8 7l3 3-3 3M13 14h3',
  reuse: 'M5 8a8 8 0 1 1-1 8M5 3v5h5',
  cancel: 'M5 5h14v14H5V5',
  train: 'M5 4h14v16H5V4M9 8l6 4-6 4V8',
  eval: 'M5 4h14v16H5V4M8 12l3 3 5-6',
}
export function resourceActions(item) {
  const entries = [
    { action: 'detail', label: item.kind === 'dataset' ? '预览数据集' : '查看详情', icon: 'detail' },
  ]
  if (item.kind === 'job') entries.push({ action: 'log', label: '查看日志', icon: 'log' })
  entries.push(
    { action: item.pinned ? 'unpin' : 'pin', label: item.pinned ? '取消置顶' : '置顶', icon: 'pin' },
    { action: 'rename', label: '重命名', icon: 'rename' },
  )
  if (item.kind === 'dataset' && !item.archived)
    entries.push(
      { action: 'train', label: '用于微调', icon: 'train' },
      { action: 'eval', label: '用于评估', icon: 'eval' },
    )
  if (item.kind === 'job' && !['queued', 'starting', 'running'].includes(item.status))
    entries.push({ action: 'reuse', label: '使用此配置', icon: 'reuse' })
  if (item.kind !== 'job') entries.push({ action: 'download', label: '下载文件', icon: 'download' })
  if (item.kind === 'job') entries.push({ action: 'copy', label: '复制任务 ID', icon: 'copy' })
  if (item.kind === 'job' && ['queued', 'starting', 'running'].includes(item.status))
    entries.push({ action: 'cancel', label: '取消任务', icon: 'cancel', danger: true })
  else
    entries.push(
      {
        action: item.archived ? 'unarchive' : 'archive',
        label: item.archived ? '取消归档' : '归档',
        icon: 'archive',
      },
      {
        action: 'delete',
        label: item.kind === 'job' ? '删除任务' : item.kind === 'dataset' ? '删除数据集' : '删除成果',
        icon: 'delete',
        danger: true,
      },
    )
  return entries
}
export function openMenu(rect, entries, onSelect, onClose, focus) {
  const menu = document.createElement('div')
  menu.className = 'rh-workspace-menu'
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', '更多操作')
  let destroyed = false
  const buttons = []
  const scroll = (event) => {
    if (!menu.contains(event.target)) close()
  }
  const close = () => {
    if (destroyed) return
    destroyed = true
    menu.remove()
    document.removeEventListener('pointerdown', outside, true)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', scroll, true)
    onClose?.()
    if (focus?.isConnected) focus.focus({ preventScroll: true })
  }
  for (const entry of entries) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('role', 'menuitem')
    button.className = entry.danger ? 'danger' : ''
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(svg.namespaceURI, 'path')
    path.setAttribute('d', icons[entry.icon] || icons.detail)
    svg.append(path)
    button.append(svg)
    const label = document.createElement('span')
    label.textContent = entry.label
    button.append(label)
    button.onclick = () => {
      close()
      onSelect(entry.action)
    }
    buttons.push(button)
    menu.append(button)
  }
  const outside = (event) => {
    if (!menu.contains(event.target) && event.target !== focus) close()
  }
  document.body.append(menu)
  const box = menu.getBoundingClientRect()
  menu.style.left =
    Math.max(8, Math.min(rect.x + rect.width - box.width, window.innerWidth - box.width - 8)) + 'px'
  menu.style.top =
    Math.max(
      8,
      rect.y + rect.height + box.height + 8 > window.innerHeight
        ? rect.y - box.height - 4
        : rect.y + rect.height + 4,
    ) + 'px'
  menu.onkeydown = (event) => {
    const index = buttons.indexOf(document.activeElement)
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault()
      close()
      return
    }
    let next
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
    else if (event.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    if (next !== undefined) {
      event.preventDefault()
      buttons[next]?.focus()
    }
  }
  document.addEventListener('pointerdown', outside, true)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', scroll, true)
  buttons[0]?.focus()
  return close
}
const menus = new WeakMap()
export function closeWorkspaceMenu(owner) {
  menus.get(owner)?.()
  menus.delete(owner)
}
export function showWorkspaceMenu(owner, rect, entries, onSelect, focus) {
  closeWorkspaceMenu(owner)
  menus.set(
    owner,
    openMenu(rect, entries, onSelect, () => menus.delete(owner), focus),
  )
}
