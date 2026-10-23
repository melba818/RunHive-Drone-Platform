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

// A saved step position is not a confirmation. Only the user's final confirm
// action (or its transcript receipt) permits a prepared draft to be presented.
export class PreparedDraftGate {
  constructor() {
    this.confirmed = new Set()
    this.blocked = new Set()
    this.bindings = new Map()
  }
  confirm(id) { this.confirmed.add(id) }
  revoke(id) {
    this.confirmed.delete(id)
    for (const [draft, interaction] of this.bindings) {
      if (interaction === id) this.blocked.add(draft)
    }
  }
  canPresent(draft, choices) {
    if (draft?.status !== 'prepared') return true
    if (this.blocked.has(draft.id)) return false
    const flows = Array.from(choices, entry => entry.flow || entry)
    if (flows.some(flow => !flow.confirmed && !this.confirmed.has(flow.interaction.id))) return false
    if (!['annotation', 'training', 'tune'].includes(draft.kind)) return true
    const latest = flows.filter(flow => flow.interaction.goal === draft.kind).at(-1)
    if (!latest || latest.cancelled || !this.confirmed.has(latest.interaction.id)) return false
    const bound = this.bindings.get(draft.id)
    return !bound || bound === latest.interaction.id
  }
  receive(draft, choices) {
    const flows = Array.from(choices, entry => entry.flow || entry)
    const allowed = this.canPresent(draft, flows)
    if (draft?.status === 'prepared') {
      if (!allowed) this.blocked.add(draft.id)
      else {
        const latest = flows.filter(flow => flow.interaction.goal === draft.kind).at(-1)
        if (latest) this.bindings.set(draft.id, latest.interaction.id)
      }
    }
    return allowed
  }
}
