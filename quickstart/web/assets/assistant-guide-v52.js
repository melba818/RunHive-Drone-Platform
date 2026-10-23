export function assistantBounds(viewport, saved = {}) {
  const height = Math.max(160, viewport.height),
    width = Math.max(280, viewport.width)
  const minHeight = Math.min(380, height - 24)
  const top = Math.max(8, Math.min(Number(saved.y) || Math.min(140, height * 0.15), height - minHeight - 12))
  const panelWidth = Math.min(Number(saved.width) || 420, width - 24)
  return {
    x: Math.max(
      8,
      Math.min(Number.isFinite(saved.x) ? saved.x : width - panelWidth - 20, width - panelWidth - 8),
    ),
    y: top,
    width: panelWidth,
    height: height - top - 12,
  }
}
export function orderedActions(actions, running, pending) {
  if (running || pending) return []
  const views = ['plans', 'workflow', 'resources']
  const latest = new Map()
  for (const action of actions) {
    if (
      action?.type !== 'workbench' ||
      !views.includes(action.view) ||
      !/^[a-f0-9]{32}$/.test(action.id || action.analysis_id || '')
    )
      continue
    latest.set(action.view, action)
  }
  return views.filter((view) => latest.has(view)).map((view) => latest.get(view))
}
export function routeChoiceAllowed(flow, context = {}) {
  if (context.task === 'task_plan' || /任务计划|任务规划|工作流/.test(flow?.interaction?.title || ''))
    return false
  return (
    flow?.interaction?.goal === 'routes' ||
    (flow?.interaction?.goal === 'other' && /航线/.test(flow.interaction.title || ''))
  )
}

export function taskFromRouteIntent(text) {
  const value = String(text || '').trim()
  if (!value || /工作流|自动标注|模型训练|大模型微调/.test(value)) return false
  return (
    /(?:航线|路线|航路|这条|这个|已有|现有)/.test(value) &&
    /任务(?:计划)?/.test(value) &&
    /(?:创建|新建|生成|安排|准备|规划|执行|发起|下发)/.test(value)
  )
}
