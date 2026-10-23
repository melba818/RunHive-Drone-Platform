export const STATUS = {
  draft: '草稿',
  pending_confirmation: '待下发确认',
  queued: '排队中',
  running: '运行中',
  waiting: '处理中',
  waiting_review: '待确认',
  paused: '已暂停',
  needs_auth: '待重新授权',
  uncertain: '待核查',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
  pending: '未开始',
  submitting: '提交中',
  interrupted: '已中断',
  waiting_media: '等待媒体',
  dispatched: '已创建运行',
  skipped: '已跳过',
}
export const TIME = (seconds) =>
  seconds ? new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false }) : '—'
export const SIZE = (bytes) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`
export function definition(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) =>
      [
        'name',
        'description',
        'trigger',
        'nodes',
        'edges',
        'bindings',
        'fields',
        'template_id',
        'template_version',
      ].includes(key),
    ),
  )
}
export function sourceOptions(catalog, assets, source, routeId) {
  const native = (key) => catalog[key]?.result?.list || []
  if (source === 'media' || source === 'images')
    return assets
      .filter((a) => (source === 'images' ? a.kind === 'image' : ['image', 'video'].includes(a.kind)))
      .map((a) => ({ value: a.id, label: a.name }))
  if (source === 'routes' || source === 'devices')
    return native(source).map((r) => ({ value: String(r.id), label: r.name || r.nickname || String(r.id) }))
  if (source === 'missions')
    return native('flight_tasks')
      .filter((r) => !routeId || String(r.airline_id) === String(routeId))
      .map((r) => ({ value: String(r.id), label: (r.name || `任务 ${r.id}`) + ' · ' + (r.status || '未知') }))
  if (source === 'vision_models')
    return (catalog.vision?.vision_models || []).map((r) => ({
      value: r.id,
      label: r.name + ' · ' + r.model,
    }))
  if (source === 'datasets')
    return (catalog.runos?.datasets || []).map((r) => ({ value: r.id, label: r.name }))
  if (source === 'annotation_models')
    return (catalog.runos?.annotation_models || []).map((r) => ({ value: r.id, label: r.name }))
  if (source === 'training_architectures')
    return (catalog.runos?.training_architectures || []).map((r) => ({
      value: r.value,
      label: r.label || r.value,
    }))
  if (source === 'tune_models')
    return (catalog.tune?.models || [])
      .filter((r) => r.trainable)
      .map((r) => ({ value: r.path, label: r.id }))
  if (source === 'tune_datasets') {
    const rows = catalog.tune?.datasets || []
    return (Array.isArray(rows) ? rows : Object.keys(rows)).map((r) => ({
      value: typeof r === 'string' ? r : r.name || r.id,
      label: typeof r === 'string' ? r : r.name || r.id,
    }))
  }
  return []
}
