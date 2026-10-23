export const MODULES = {
  tune: {
    title: '大模型微调',
    items: [
      { key: 'data', label: '训练数据', icon: 'database', description: '导入和管理当前账号的训练数据' },
      { key: 'train', label: '微调任务', icon: 'sliders', description: '配置并运行模型微调任务' },
      { key: 'eval', label: '评估验证', icon: 'chart', description: '验证模型效果与评估结果' },
      { key: 'chat', label: '对话测试', icon: 'message', description: '测试模型的对话与视觉能力' },
      { key: 'export', label: '模型导出', icon: 'box', description: '导出和下载当前账号的模型成果' },
    ],
  },
  agent: {
    title: 'Agent中心',
    items: [
      { key: 'projects', label: '项目与对话', icon: 'message', description: '创建项目并与智能体协作' },
      { key: 'agents', label: '智能体管理', icon: 'bot', description: '配置智能体能力与协作方式' },
      { key: 'skills', label: '技能管理', icon: 'sparkles', description: '管理智能体可使用的技能' },
      { key: 'models', label: '模型接入', icon: 'link', description: '配置当前账号的模型连接' },
      { key: 'runs', label: '运行记录', icon: 'clock', description: '查看任务过程与运行结果' },
      { key: 'evaluations', label: '评估中心', icon: 'chart', description: '评估智能体任务的执行效果' },
    ],
  },
}
export function sectionInfo(module, section) {
  const item = MODULES[module]?.items.find((item) => item.key === section)
  if (!item) throw new Error('所选功能页面无效。')
  return item
}

// Resource groups belong to the authenticated tuning instance, not the Agent
// project registry. A tuning account currently has one real workspace.
export const TUNE_WORKSPACE_GROUPS = [
  { key: 'data', label: '训练数据', icon: 'database', action: '导入数据集' },
  { key: 'train', label: '微调任务', icon: 'sliders', action: '创建微调任务' },
  { key: 'eval', label: '评估验证', icon: 'chart', action: '创建评估任务' },
  { key: 'export', label: '模型导出', icon: 'box', action: '导出模型' },
]
const JOB_STATUS = new Set(['queued', 'starting', 'running', 'succeeded', 'failed', 'cancelled'])
const text = (value, max) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  !/[\u0000-\u001f\u007f]/u.test(value)
export function validateWorkspace(data, adminId) {
  if (
    !data ||
    data.module !== 'tune' ||
    !Number.isSafeInteger(data.admin_id) ||
    data.admin_id !== adminId ||
    data.workspace?.id !== 'default' ||
    data.workspace?.name !== '默认工作区' ||
    !Array.isArray(data.groups) ||
    data.groups.length !== TUNE_WORKSPACE_GROUPS.length
  )
    throw new Error('工作区数据无效。')
  return TUNE_WORKSPACE_GROUPS.map((definition, index) => {
    const group = data.groups[index]
    if (group?.key !== definition.key || !Array.isArray(group.items) || group.items.length > 300)
      throw new Error('工作区数据无效。')
    const identities = new Set()
    const items = group.items.map((item) => {
      if (
        !item ||
        !['dataset', 'job', 'export'].includes(item.kind) ||
        !text(item.id, 512) ||
        !text(item.label, 512) ||
        (item.kind === 'dataset' && group.key !== 'data') ||
        (item.kind === 'export' && group.key !== 'export') ||
        (item.kind === 'job' && !['train', 'eval', 'export'].includes(group.key)) ||
        (item.kind === 'job' && !JOB_STATUS.has(item.status)) ||
        !Number.isFinite(item.updated) ||
        item.updated < 0
      )
        throw new Error('工作区数据无效。')
      const identity = `${item.kind}:${item.id}`
      if (identities.has(identity)) throw new Error('工作区数据无效。')
      identities.add(identity)
      const result = { kind: item.kind, id: item.id, label: item.label, updated: item.updated }
      if (
        typeof item.pinned !== 'boolean' ||
        typeof item.archived !== 'boolean' ||
        !Number.isSafeInteger(item.revision) ||
        item.revision < 0
      )
        throw new Error('工作区数据无效。')
      Object.assign(result, { pinned: item.pinned, archived: item.archived, revision: item.revision })
      if (item.kind === 'job') {
        if (!Number.isFinite(item.created) || item.created < 0 || !text(item.description, 400))
          throw new Error('工作区数据无效。')
        Object.assign(result, { status: item.status, created: item.created, description: item.description })
      } else {
        if (!Number.isSafeInteger(item.size_bytes) || item.size_bytes < 0) throw new Error('工作区数据无效。')
        result.size_bytes = item.size_bytes
        if (item.kind === 'dataset') {
          if (!['Alpaca', 'ShareGPT', '标准格式'].includes(item.format)) throw new Error('工作区数据无效。')
          result.format = item.format
          result.download = `/llm-center/tune/ui/api/workspace/datasets/${encodeURIComponent(item.id)}`
        } else {
          const parts = item.id.split('/')
          if (
            parts.some((part) => !part || part === '.' || part === '..' || part.includes('\\')) ||
            item.id.startsWith('/')
          )
            throw new Error('工作区数据无效。')
          // Derive the only allowed download route; never accept an upstream URL.
          result.download = `/llm-center/tune/ui/api/workspace/exports/${parts.map(encodeURIComponent).join('/')}`
        }
      }
      return result
    })
    return { ...definition, items }
  })
}
export function filterWorkspace(groups, query) {
  const term = String(query).trim().toLocaleLowerCase('zh-CN')
  return groups.map((group) => ({
    ...group,
    items: term
      ? group.items.filter((item) => item.label.toLocaleLowerCase('zh-CN').includes(term))
      : group.items,
  }))
}
export function taskStatus(status) {
  return (
    {
      queued: '排队中',
      starting: '启动中',
      running: '运行中',
      succeeded: '已完成',
      failed: '失败',
      cancelled: '已取消',
    }[status] || ''
  )
}
