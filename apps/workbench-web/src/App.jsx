import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import {
  Workflow,
  FolderOpen,
  Search,
  GitCompare,
  UploadCloud,
  Plus,
  RefreshCw,
  Play,
  Pause,
  Square,
  Check,
  ChevronRight,
  ArrowLeft,
  Trash2,
  RotateCcw,
  LayoutGrid,
  List,
  FileImage,
  Video,
  FileBox,
  Box,
  FileText,
  Clock,
  Zap,
  Settings2,
  Download,
  Eye,
  Loader2,
  X,
  ClipboardList,
  ArrowRight,
  Save,
  Link2,
} from 'lucide-react'
import { api, BASE, upload } from './api.js'
import { STATUS, SIZE, TIME, definition, sourceOptions } from './contracts.js'
import '@xyflow/react/dist/style.css'
import './style.css'

const categories = [
  ['media', '媒体', FolderOpen],
  ['image', '照片', FileImage],
  ['video', '视频', Video],
  ['archive', '压缩文件', FileBox],
  ['model', '模型', Box],
  ['design', '设计文件', FileText],
  ['trash', '回收站', Trash2],
]
const Badge = ({ status }) => <span className={'wb-badge status-' + status}>{STATUS[status] || status}</span>
const Empty = ({ icon: Icon = FolderOpen, title, children }) => (
  <div className="wb-empty">
    <Icon size={40} />
    <h3>{title}</h3>
    <p>{children}</p>
  </div>
)
const Button = ({ icon: Icon, children, primary = false, danger = false, ...props }) => (
  <button className={'wb-button' + (primary ? ' primary' : '') + (danger ? ' danger' : '')} {...props}>
    {Icon && <Icon size={16} />}
    <span>{children}</span>
  </button>
)
function exportReport(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name + '.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Modal({ title, children, onClose, footer }) {
  const ref = useRef(null)
  useEffect(() => {
    const element = ref.current
    const previous = document.activeElement
    element?.showModal?.()
    return () => {
      element?.close?.()
      previous?.isConnected && previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="wb-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-label={title}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="wb-icon-button" aria-label="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <section>{children}</section>
      {footer && <footer>{footer}</footer>}
    </dialog>
  )
}
function Field({ name, spec, value, onChange, catalog, assets, bindings = {} }) {
  const options = sourceOptions(catalog, assets, spec.source, bindings.airline_id || bindings.route_id)
  if (spec.type === 'boolean')
    return (
      <label className="wb-check-field">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {spec.label}
      </label>
    )
  return (
    <label className="wb-field">
      <span>
        {spec.label}
        {spec.required && <em>*</em>}
      </span>
      {spec.type === 'resource' ? (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">请选择</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.type === 'resources' ? (
        <div className="wb-multiselect">
          {options.length ? (
            options.map((o) => (
              <label key={o.value}>
                <input
                  type="checkbox"
                  checked={(value || []).includes(o.value)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...(value || []), o.value]
                        : (value || []).filter((v) => v !== o.value),
                    )
                  }
                />
                {o.label}
              </label>
            ))
          ) : (
            <small>暂无图片或视频，请先在资源库导入。</small>
          )}
        </div>
      ) : spec.type === 'number' ? (
        <input
          type="number"
          value={value ?? spec.default ?? ''}
          min={spec.min}
          max={spec.max}
          step={spec.min < 1 ? '0.01' : '1'}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      ) : (
        <input
          value={value ?? ''}
          maxLength={2000}
          placeholder={spec.placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {spec.description && <small>{spec.description}</small>}
    </label>
  )
}
function Fields({ fields, bindings, setBindings, catalog, assets }) {
  return (
    <div className="wb-fields">
      {Object.entries(fields || {}).map(([key, spec]) => (
        <Field
          key={key}
          name={key}
          spec={spec}
          value={bindings[key]}
          onChange={(v) => setBindings({ ...bindings, [key]: v })}
          bindings={bindings}
          catalog={catalog}
          assets={assets}
        />
      ))}
    </div>
  )
}
function AnalysisResult({ job }) {
  const result = job?.result
  if (!job) return null
  return (
    <div className="wb-analysis-result">
      <div className="wb-section-title">
        <h3>分析结果</h3>
        <Badge status={job.status} />
        {result && (
          <Button icon={Download} onClick={() => exportReport('RunHive-分析报告-' + job.id, job)}>
            导出报告
          </Button>
        )}
      </div>
      {job.error && <div className="wb-notice error">{job.error}</div>}
      {['queued', 'running'].includes(job.status) && (
        <p className="wb-muted">
          <Loader2 size={14} className="wb-spin" />
          正在分析实际画面，{result?.processed || 0} / {result?.total || '—'} 个资源已处理。
        </p>
      )}
      {result?.hits && (
        <>
          <p>找到 {result.hits.length} 处匹配画面。</p>
          <div className="wb-result-grid">
            {result.hits.map((hit, index) => (
              <article key={index} className="wb-result-card">
                <img
                  loading="lazy"
                  src={BASE + '/resources/' + (hit.preview_id || hit.resource_id) + '/thumbnail'}
                  alt={hit.name}
                />
                <strong>{hit.name}</strong>
                <p>{hit.description}</p>
                {hit.second > 0 && <small>视频位置：{hit.second} 秒</small>}
                <div>
                  {(hit.tags || []).map((t) => (
                    <span key={t} className="wb-tag">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {result.video_sampling && (
            <small className="wb-muted">
              视频目标间隔为 {result.video_sampling.interval_seconds} 秒，每段最多{' '}
              {result.video_sampling.max_frames_per_video}{' '}
              帧；长视频会加大间隔覆盖全段。未命中不代表整段视频没有目标。
            </small>
          )}
        </>
      )}
      {result?.preview_id && <ChangeResult result={result} />}
      {result?.pairs && (
        <>
          <p>已比较 {result.pairs.length} 组同航点影像。</p>
          {(result.unmatched_baseline_count > 0 || result.unmatched_current_count > 0) && (
            <p className="wb-muted">
              尚未匹配：基准任务 {result.unmatched_baseline_count || 0} 张，对比任务{' '}
              {result.unmatched_current_count || 0} 张。
            </p>
          )}
          {result.ambiguous_waypoints?.length > 0 && (
            <p className="wb-notice">
              这些航点关联了多张图片，请核对后再比较：{result.ambiguous_waypoints.join('、')}
            </p>
          )}
          {result.omitted_pairs > 0 && (
            <p className="wb-muted">本次最多比较 50 组，另有 {result.omitted_pairs} 组未处理。</p>
          )}
          {result.pairs.map((pair) => (
            <div key={pair.waypoint}>
              <h4>航点 {pair.waypoint}</h4>
              <ChangeResult result={pair} />
            </div>
          ))}
        </>
      )}
      {result?.errors?.length > 0 && (
        <details>
          <summary>有 {result.errors.length} 项未完成</summary>
          {result.errors.map((e, i) => (
            <p key={i}>{e.message}</p>
          ))}
        </details>
      )}
    </div>
  )
}
function ChangeResult({ result }) {
  return (
    <div className="wb-change-result">
      <img src={BASE + '/resources/' + result.preview_id + '/file'} alt="变化检测候选区域" />
      <div>
        <span className="wb-stat">
          差异比例 <b>{(result.changed_ratio * 100).toFixed(2)}%</b>
        </span>
        <span className="wb-stat">
          候选区域 <b>{result.regions?.length || 0}</b>
        </span>
        <p>{result.description}</p>
        {result.semantic?.changes?.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        {result.semantic?.uncertainty && <small>{result.semantic.uncertainty}</small>}
        <small className="wb-muted">
          {result.alignment === 'orb_homography' ? '已自动配准' : '按已确认的固定视角比较'}，有效重叠{' '}
          {Math.round(result.overlap_ratio * 100)}%。曝光、季节和机位差异仍需复核。
        </small>
      </div>
    </div>
  )
}

function Resources({ catalog, notify, action, accountId }) {
  const [kind, setKind] = useState('media'),
    [parent, setParent] = useState(''),
    [breadcrumbs, setBreadcrumbs] = useState([]),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, counts: {} }),
    [selected, setSelected] = useState([]),
    [grid, setGrid] = useState(true),
    [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(null),
    [job, setJob] = useState(null)
  const [allAssets, setAllAssets] = useState([]),
    [history, setHistory] = useState([])
  const file = useRef(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ kind, q: query, page: String(page), limit: '60' })
      if (parent) params.set('parent', parent)
      else if (kind === 'media' && !query) params.set('parent', '')
      setData(await api('/resources?' + params))
    } catch (e) {
      notify(e.message, true)
    } finally {
      setLoading(false)
    }
  }, [kind, parent, query, page])
  useEffect(() => {
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return
    const timer = setInterval(
      () =>
        api('/resources/analyses/jobs/' + job.id)
          .then(setJob)
          .catch((e) => notify(e.message, true)),
      2500,
    )
    return () => clearInterval(timer)
  }, [job?.id, job?.status])
  useEffect(() => {
    if (action?.analysis_id)
      api('/resources/analyses/jobs/' + action.analysis_id)
        .then(setJob)
        .catch((e) => notify(e.message, true))
  }, [action?.analysis_id])
  async function prepare(type, asset) {
    setBusy(true)
    try {
      const all = await api('/resources?limit=500')
      setAllAssets(all.items)
      setForm(
        type === 'metadata'
          ? { ...asset.metadata, name: asset.name, parent: asset.parent }
          : type === 'change_mission'
            ? {
                route_id: '',
                baseline_mission: '',
                current_mission: '',
                sensitivity: 25,
                assume_aligned: false,
              }
            : type === 'change_pair'
              ? {
                  before_id: selected[0] || '',
                  after_id: selected[1] || '',
                  sensitivity: 25,
                  assume_aligned: false,
                }
              : { query: '', provider_id: '', resource_ids: selected },
      )
      setModal({ type, asset })
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
    }
  }
  async function uploadFiles(files) {
    if (!files.length) return
    setBusy(true)
    try {
      for (const item of Array.from(files).slice(0, 20)) {
        if (item.size > 512 * 1024 * 1024) throw Error(item.name + ' 超过 512 MB。')
        setProgress({ name: item.name, value: 0 })
        await upload(item, parent, {}, (value) => setProgress({ name: item.name, value }))
      }
      notify('文件已导入资源库。')
      await load()
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
      setProgress(null)
      if (file.current) file.current.value = ''
    }
  }
  async function changeAnalysis() {
    setBusy(true)
    try {
      const value = await api('/resources/analyses/' + modal.type, 'POST', form)
      setJob(value)
      setModal(null)
      notify('分析已创建，可在这里查看进度。')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
    }
  }
  function agentSearch() {
    if (!form.query?.trim() || !form.provider_id) {
      notify('请填写目标描述并选择视觉语言模型。', true)
      return
    }
    window.dispatchEvent(
      new CustomEvent('runhive-assistant-compose', {
        detail: {
          source: 'runhive-workbench',
          admin_id: accountId,
          text: '请在选中的媒体中进行智能搜索：' + form.query,
          context: {
            title: '资源库 · 智能搜索',
            task: 'resource_search',
            query: form.query,
            provider_id: form.provider_id,
            resource_ids: form.resource_ids,
          },
        },
      }),
    )
    setModal(null)
    notify('已交给平台助手，在同一对话中查看搜索进度。')
  }
  async function updateAsset(body) {
    setBusy(true)
    try {
      await api('/resources/' + modal.asset.id, 'PATCH', body)
      setModal(null)
      setSelected([])
      await load()
      notify('资源已更新。')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
    }
  }
  function openFolder(asset) {
    setParent(asset.id)
    setBreadcrumbs([...breadcrumbs, { id: asset.id, name: asset.name }])
    setPage(1)
    setSelected([])
  }
  const missionOptions = sourceOptions(catalog, allAssets, 'missions', form.route_id)
  return (
    <>
      <aside className="wb-sidebar">
        <div className="wb-sidebar-heading">
          <FolderOpen size={20} />
          <strong>资源库</strong>
        </div>
        <p className="wb-sidebar-hint">管理巡检成果与模型资源</p>
        {categories.map(([key, label, Icon]) => (
          <button
            key={key}
            className={kind === key ? 'active' : ''}
            onClick={() => {
              setKind(key)
              setParent('')
              setBreadcrumbs([])
              setSelected([])
              setPage(1)
              setQuery('')
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
            <small>
              {key === 'media'
                ? SIZE(['image', 'video', 'archive'].reduce((n, k) => n + (data.counts[k]?.bytes || 0), 0))
                : key !== 'trash'
                  ? SIZE(data.counts[key]?.bytes || 0)
                  : ''}
            </small>
          </button>
        ))}
        <div className="wb-sidebar-bottom">
          <span>{Object.values(data.counts).reduce((n, v) => n + v.count, 0)} 个资源</span>
          <small>文件按当前账号独立保存</small>
        </div>
      </aside>
      <main
        className="wb-main"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (!busy) uploadFiles(e.dataTransfer.files)
        }}
      >
        <header className="wb-page-header">
          <div>
            <h1>{categories.find((c) => c[0] === kind)?.[1]}</h1>
            <p>上传、搜索与对比巡检成果，保留任务关联。</p>
          </div>
          <div className="wb-toolbar">
            <Button icon={Search} onClick={() => prepare('smart_search')} disabled={busy}>
              智能搜索
            </Button>
            <Button icon={GitCompare} onClick={() => prepare('change_pair')} disabled={busy}>
              两图变化检测
            </Button>
            <Button icon={Link2} onClick={() => prepare('change_mission')} disabled={busy}>
              任务变化检测
            </Button>
            <Button
              icon={Download}
              onClick={() => {
                setForm({ media_id: '', mission_id: '' })
                setModal({ type: 'native_import' })
              }}
              disabled={busy}
            >
              导入任务媒体
            </Button>
            <Button
              primary
              icon={UploadCloud}
              onClick={() => file.current?.click()}
              disabled={busy || kind === 'trash'}
            >
              导入文件
            </Button>
          </div>
        </header>
        <input ref={file} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
        {progress && (
          <div className="wb-upload-progress">
            <UploadCloud size={18} />
            <span>{progress.name}</span>
            <progress max="100" value={progress.value} />
            <b>{progress.value}%</b>
          </div>
        )}
        <section className="wb-card wb-resource-card">
          <div className="wb-resource-bar">
            <div className="wb-breadcrumb">
              <button
                onClick={() => {
                  setParent('')
                  setBreadcrumbs([])
                }}
              >
                全部资源
              </button>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={b.id}>
                  <ChevronRight size={14} />
                  <button
                    onClick={() => {
                      setParent(b.id)
                      setBreadcrumbs(breadcrumbs.slice(0, i + 1))
                    }}
                  >
                    {b.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="wb-toolbar">
              <div className="wb-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="按文件名搜索"
                />
              </div>
              <button className="wb-icon-button" aria-label="刷新资源" onClick={load}>
                <RefreshCw size={17} />
              </button>
              <button
                className={'wb-icon-button' + (grid ? ' selected' : '')}
                aria-label="网格视图"
                onClick={() => setGrid(true)}
              >
                <LayoutGrid size={17} />
              </button>
              <button
                className={'wb-icon-button' + (!grid ? ' selected' : '')}
                aria-label="列表视图"
                onClick={() => setGrid(false)}
              >
                <List size={17} />
              </button>
              <Button
                icon={Plus}
                onClick={() => {
                  setForm({ name: '' })
                  setModal({ type: 'folder' })
                }}
                disabled={kind === 'trash'}
              >
                创建文件夹
              </Button>
            </div>
          </div>
          <div className="wb-selection-bar">
            <label>
              <input
                type="checkbox"
                checked={data.items.length > 0 && selected.length === data.items.length}
                onChange={(e) => setSelected(e.target.checked ? data.items.map((r) => r.id) : [])}
              />
              已选 {selected.length} / {data.total}
            </label>
            <button
              onClick={async () => {
                try {
                  const h = await api('/resources/analyses/history')
                  setHistory(h.items)
                  setModal({ type: 'history' })
                } catch (e) {
                  notify(e.message, true)
                }
              }}
            >
              分析历史
            </button>
          </div>
          {loading && !data.items.length ? (
            <Empty icon={Loader2} title="正在读取资源" />
          ) : !data.items.length ? (
            <Empty title={kind === 'trash' ? '回收站为空' : '还没有资源'}>
              拖放文件到这里，或点击“导入文件”。
            </Empty>
          ) : (
            <div className={grid ? 'wb-assets-grid' : 'wb-assets-list'}>
              {data.items.map((asset) => {
                const Icon = categories.find((c) => c[0] === asset.kind)?.[2] || FolderOpen
                return (
                  <article
                    key={asset.id}
                    className={'wb-asset' + (selected.includes(asset.id) ? ' selected' : '')}
                  >
                    <label className="wb-asset-select">
                      <input
                        type="checkbox"
                        checked={selected.includes(asset.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, asset.id]
                              : selected.filter((id) => id !== asset.id),
                          )
                        }
                      />
                    </label>
                    <button
                      className="wb-asset-preview"
                      onClick={() =>
                        asset.kind === 'folder' ? openFolder(asset) : setModal({ type: 'preview', asset })
                      }
                    >
                      {['image', 'video'].includes(asset.kind) && !asset.trashed ? (
                        <img
                          loading="lazy"
                          src={BASE + '/resources/' + asset.id + '/thumbnail'}
                          alt={asset.name}
                        />
                      ) : (
                        <Icon size={36} />
                      )}
                      {asset.kind === 'video' && (
                        <span className="wb-video-mark">
                          <Play size={18} />
                        </span>
                      )}
                    </button>
                    <div className="wb-asset-info">
                      <strong title={asset.name}>{asset.name}</strong>
                      <small>
                        {asset.kind === 'folder' ? '文件夹' : SIZE(asset.size)} · {TIME(asset.created)}
                      </small>
                      <div>
                        {(asset.metadata.tags || []).slice(0, 3).map((tag) => (
                          <span className="wb-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="wb-asset-actions">
                      {asset.trashed ? (
                        <Button
                          icon={RotateCcw}
                          onClick={() => {
                            setModal({ type: 'restore', asset })
                          }}
                        >
                          恢复
                        </Button>
                      ) : (
                        <>
                          <button
                            className="wb-icon-button"
                            title="标签与任务关联"
                            aria-label={'编辑 ' + asset.name}
                            onClick={() => prepare('metadata', asset)}
                          >
                            <Settings2 size={15} />
                          </button>
                          {asset.kind !== 'folder' && (
                            <a
                              className="wb-icon-button"
                              aria-label={'下载 ' + asset.name}
                              href={BASE + '/resources/' + asset.id + '/file?download=true'}
                            >
                              <Download size={15} />
                            </a>
                          )}
                          <button
                            className="wb-icon-button"
                            title="移入回收站"
                            aria-label={'移除 ' + asset.name}
                            onClick={() => setModal({ type: 'trash', asset })}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          <footer className="wb-pagination">
            <span>{data.total} 个资源</span>
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              上一页
            </Button>
            <span>{page}</span>
            <Button disabled={page * 60 >= data.total} onClick={() => setPage(page + 1)}>
              下一页
            </Button>
          </footer>
        </section>
        <AnalysisResult job={job} />
        {modal && (
          <Modal
            title={
              {
                folder: '创建文件夹',
                smart_search: 'Agent 智能搜索',
                change_pair: '两张图片变化检测',
                change_mission: '航线任务变化检测',
                native_import: '导入平台任务媒体',
                metadata: '资源信息与任务关联',
                preview: modal.asset?.name,
                trash: '移入回收站',
                restore: '恢复资源',
                history: '分析历史',
              }[modal.type]
            }
            onClose={() => !busy && setModal(null)}
            footer={
              modal.type === 'preview' || modal.type === 'history' ? null : (
                <>
                  <Button disabled={busy} onClick={() => setModal(null)}>
                    取消
                  </Button>
                  <Button
                    primary
                    disabled={busy}
                    onClick={() => {
                      if (modal.type === 'smart_search') agentSearch()
                      else if (modal.type.startsWith('change_')) changeAnalysis()
                      else if (modal.type === 'metadata')
                        updateAsset({
                          name: form.name,
                          parent: form.parent,
                          metadata: Object.fromEntries(
                            Object.entries(form).filter(([k]) =>
                              [
                                'tags',
                                'route_id',
                                'mission_id',
                                'waypoint',
                                'captured_at',
                                'longitude',
                                'latitude',
                                'panorama',
                                'description',
                              ].includes(k),
                            ),
                          ),
                        })
                      else if (modal.type === 'trash' || modal.type === 'restore')
                        updateAsset({ trash: modal.type === 'trash' })
                      else if (modal.type === 'native_import') {
                        setBusy(true)
                        api(
                          '/resources/import-native',
                          'POST',
                          Object.fromEntries(Object.entries(form).filter(([, v]) => v)),
                        )
                          .then((value) => {
                            setModal(null)
                            load()
                            notify(
                              value.errors?.length
                                ? '部分任务媒体不可用，请检查原存储服务或上传副本。'
                                : '任务媒体已导入并保留关联。',
                            )
                          })
                          .catch((e) => notify(e.message, true))
                          .finally(() => setBusy(false))
                      } else if (modal.type === 'folder') {
                        setBusy(true)
                        api('/resources/folders', 'POST', { name: form.name, parent })
                          .then(() => {
                            setModal(null)
                            load()
                          })
                          .catch((e) => notify(e.message, true))
                          .finally(() => setBusy(false))
                      }
                    }}
                  >
                    {busy
                      ? '处理中…'
                      : modal.type === 'smart_search'
                        ? '交给 Agent 搜索'
                        : modal.type.startsWith('change_')
                          ? '开始分析'
                          : '确认'}
                  </Button>
                </>
              )
            }
          >
            {modal.type === 'folder' && (
              <Field
                spec={{ label: '文件夹名称', type: 'text', required: true }}
                value={form.name}
                onChange={(name) => setForm({ name })}
                catalog={catalog}
                assets={[]}
              />
            )}
            {modal.type === 'native_import' && (
              <>
                <p className="wb-muted">选择任务可导入该任务全部可访问媒体；也可单独选择平台媒体。</p>
                <label className="wb-field">
                  <span>航线任务（可选）</span>
                  <select
                    value={form.mission_id}
                    onChange={(e) => setForm({ ...form, mission_id: e.target.value })}
                  >
                    <option value="">请选择</option>
                    {sourceOptions(catalog, [], 'missions').map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wb-field">
                  <span>平台媒体（可选）</span>
                  <select
                    value={form.media_id}
                    onChange={(e) => setForm({ ...form, media_id: e.target.value })}
                  >
                    <option value="">选择任务全部媒体</option>
                    {(catalog.media?.result?.list || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || '媒体 ' + m.id}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {modal.type === 'smart_search' && (
              <>
                <p className="wb-muted">平台助手会分析实际画面，并保留搜索过程和结果。</p>
                <Fields
                  fields={{
                    query: {
                      label: '搜索目标',
                      type: 'text',
                      required: true,
                      placeholder: '例如：新增垃圾堆、异常停放车辆',
                    },
                    provider_id: {
                      label: '视觉语言模型',
                      type: 'resource',
                      source: 'vision_models',
                      required: true,
                    },
                    resource_ids: { label: '图片／视频', type: 'resources', source: 'media', required: true },
                  }}
                  bindings={form}
                  setBindings={setForm}
                  catalog={catalog}
                  assets={allAssets}
                />
              </>
            )}
            {modal.type === 'change_pair' && (
              <Fields
                fields={{
                  before_id: { label: '基准图片', type: 'resource', source: 'images', required: true },
                  after_id: { label: '对比图片', type: 'resource', source: 'images', required: true },
                  sensitivity: { label: '差异阈值', type: 'number', min: 5, max: 80 },
                  provider_id: { label: 'VLM 语义复核（可选）', type: 'resource', source: 'vision_models' },
                  assume_aligned: { label: '确认两图来自固定机位和相同视角', type: 'boolean' },
                }}
                bindings={form}
                setBindings={setForm}
                catalog={catalog}
                assets={allAssets}
              />
            )}
            {modal.type === 'change_mission' && (
              <>
                <p className="wb-muted">先将照片关联航线、任务和航点。按相同航点匹配两次任务影像。</p>
                <Fields
                  fields={{
                    route_id: { label: '航线', type: 'resource', source: 'routes', required: true },
                    baseline_mission: {
                      label: '基准任务',
                      type: 'resource',
                      source: 'missions',
                      required: true,
                    },
                    current_mission: {
                      label: '对比任务',
                      type: 'resource',
                      source: 'missions',
                      required: true,
                    },
                    provider_id: { label: 'VLM 语义复核（可选）', type: 'resource', source: 'vision_models' },
                    sensitivity: { label: '差异阈值', type: 'number', min: 5, max: 80 },
                    assume_aligned: { label: '确认图片来自固定机位和相同视角', type: 'boolean' },
                  }}
                  bindings={form}
                  setBindings={setForm}
                  catalog={catalog}
                  assets={allAssets}
                />
              </>
            )}
            {modal.type === 'metadata' && (
              <>
                <Fields
                  fields={{
                    name: { label: '资源名称', type: 'text', required: true },
                    route_id: { label: '关联航线', type: 'resource', source: 'routes' },
                    mission_id: { label: '关联任务', type: 'resource', source: 'missions' },
                    waypoint: { label: '航点编号', type: 'text' },
                    captured_at: { label: '拍摄时间', type: 'text' },
                  }}
                  bindings={form}
                  setBindings={setForm}
                  catalog={catalog}
                  assets={allAssets}
                />
                <label className="wb-field">
                  <span>标签（逗号分隔）</span>
                  <input
                    value={(form.tags || []).join(',')}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tags: e.target.value
                          .split(/[,，]/)
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              </>
            )}
            {modal.type === 'preview' &&
              (modal.asset.kind === 'image' ? (
                <img
                  className="wb-preview-image"
                  src={BASE + '/resources/' + modal.asset.id + '/file'}
                  alt={modal.asset.name}
                />
              ) : modal.asset.kind === 'video' ? (
                <video
                  className="wb-preview-image"
                  controls
                  src={BASE + '/resources/' + modal.asset.id + '/file'}
                />
              ) : (
                <Empty icon={FileText} title={modal.asset.name}>
                  <a href={BASE + '/resources/' + modal.asset.id + '/file?download=true'}>下载查看</a>
                </Empty>
              ))}
            {modal.type === 'trash' && (
              <p>
                将“{modal.asset.name}”移入回收站，之后可以恢复。
                {modal.asset.kind === 'folder' && '文件夹中的资源会一起移入。'}
              </p>
            )}
            {modal.type === 'restore' && <p>恢复“{modal.asset.name}”及其同次移入的子资源。</p>}
            {modal.type === 'history' && (
              <div className="wb-history">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setJob(h)
                      setModal(null)
                    }}
                  >
                    <span>
                      {
                        { smart_search: '智能搜索', change_pair: '两图变化', change_mission: '任务变化' }[
                          h.kind
                        ]
                      }{' '}
                      · {TIME(h.created)}
                    </span>
                    <Badge status={h.status} />
                  </button>
                ))}
                {!history.length && <Empty title="暂无分析记录" />}
              </div>
            )}
          </Modal>
        )}
      </main>
    </>
  )
}

function WorkflowEditor({ initial, catalog, assets, nodeTypes, notify, onBack, onSaved }) {
  const [draft, setDraft] = useState({ ...definition(initial), bindings: { ...initial.bindings } }),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initial.nodes.map((n) => ({
      ...n,
      type: 'default',
      data: { label: n.label },
      originalType: n.type,
      config: n.config,
    })),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [tab, setTab] = useState('parameters'),
    [advanced, setAdvanced] = useState('')
  const selectedNode = nodes.find((n) => n.id === selected)
  async function save() {
    setBusy(true)
    try {
      const cleanNodes = nodes.map((n) => ({
        id: n.id,
        type: n.originalType,
        label: n.data.label,
        config: n.config || {},
        position: n.position,
      }))
      const value = {
        ...draft,
        nodes: cleanNodes,
        edges: edges.map(({ id, source, target }) => ({ id, source, target })),
      }
      const result = await api(
        '/workflows' + (initial.id ? '/' + initial.id : ''),
        initial.id ? 'PUT' : 'POST',
        initial.id ? { revision: initial.revision, definition: value } : value,
      )
      onSaved(result)
      notify('工作流已保存为停用草稿。')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
    }
  }
  function addNode(type) {
    const id = 'n' + crypto.randomUUID().replaceAll('-', '').slice(0, 10)
    setNodes((v) => [
      ...v,
      {
        id,
        type: 'default',
        originalType: type,
        data: { label: nodeTypes[type].label },
        config: {},
        position: { x: 50 + (v.length % 4) * 240, y: 120 + Math.floor(v.length / 4) * 150 },
      },
    ])
    setSelected(id)
  }
  return (
    <main className="wb-main wb-editor">
      <header className="wb-page-header">
        <div className="wb-title-row">
          <Button icon={ArrowLeft} onClick={onBack}>
            返回
          </Button>
          <div>
            <h1>工作流编辑</h1>
            <p>连接步骤，配置资源，核对后启用。</p>
          </div>
        </div>
        <Button primary icon={Save} disabled={busy} onClick={save}>
          {busy ? '保存中…' : '保存草稿'}
        </Button>
      </header>
      <div className="wb-editor-layout">
        <aside className="wb-node-palette">
          <h3>步骤组件</h3>
          {Object.entries(nodeTypes).map(([key, value]) => (
            <button key={key} onClick={() => addNode(key)}>
              <Plus size={14} />
              <div>
                <strong>{value.label}</strong>
                <small>{value.description}</small>
              </div>
            </button>
          ))}
        </aside>
        <div className="wb-graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(params) => setEdges((e) => addEdge(params, e))}
            onNodeClick={(_, node) => setSelected(node.id)}
            onPaneClick={() => setSelected(null)}
            fitView
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background gap={22} color="#dbe5f1" />
            <Controls />
            <MiniMap nodeColor="#dcecff" />
          </ReactFlow>
        </div>
        <aside className="wb-properties">
          <div className="wb-tabs">
            <button className={tab === 'parameters' ? 'active' : ''} onClick={() => setTab('parameters')}>
              工作流参数
            </button>
            <button className={tab === 'node' ? 'active' : ''} onClick={() => setTab('node')}>
              选中步骤
            </button>
          </div>
          {tab === 'parameters' ? (
            <>
              <label className="wb-field">
                <span>名称</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="wb-field">
                <span>说明</span>
                <textarea
                  value={draft.description || ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
              <label className="wb-field">
                <span>触发方式</span>
                <select
                  value={draft.trigger.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      trigger: {
                        ...draft.trigger,
                        kind: e.target.value,
                        event: draft.trigger.event || 'manual.trigger',
                      },
                    })
                  }
                >
                  <option value="periodic">周期性</option>
                  <option value="event">触发式</option>
                  <option value="manual">手动运行</option>
                </select>
              </label>
              {draft.trigger.kind === 'periodic' ? (
                <label className="wb-field">
                  <span>间隔（分钟）</span>
                  <input
                    type="number"
                    min="1"
                    max="525600"
                    value={draft.trigger.interval_minutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        trigger: { ...draft.trigger, interval_minutes: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ) : draft.trigger.kind === 'event' ? (
                <label className="wb-field">
                  <span>触发事件</span>
                  <select
                    value={draft.trigger.event}
                    onChange={(e) =>
                      setDraft({ ...draft, trigger: { ...draft.trigger, event: e.target.value } })
                    }
                  >
                    <option value="resource.uploaded">资源上传</option>
                    <option value="flight_task.completed">航线任务完成</option>
                    <option value="dataset.ready">数据集就绪</option>
                    <option value="manual.trigger">手动事件</option>
                  </select>
                </label>
              ) : null}
              <Fields
                fields={draft.fields}
                bindings={draft.bindings}
                setBindings={(bindings) => setDraft({ ...draft, bindings })}
                catalog={catalog}
                assets={assets}
              />
            </>
          ) : selectedNode ? (
            <>
              <p className="wb-muted">{nodeTypes[selectedNode.originalType]?.description}</p>
              <label className="wb-field">
                <span>步骤名称</span>
                <input
                  value={selectedNode.data.label}
                  onChange={(e) =>
                    setNodes((v) =>
                      v.map((n) =>
                        n.id === selected ? { ...n, data: { ...n.data, label: e.target.value } } : n,
                      ),
                    )
                  }
                />
              </label>
              <p className="wb-muted">步骤默认使用左侧“工作流参数”。高级覆盖适合已核对的特殊参数。</p>
              <details
                onToggle={(e) => {
                  if (e.currentTarget.open) setAdvanced(JSON.stringify(selectedNode.config || {}, null, 2))
                }}
              >
                <summary>高级参数覆盖</summary>
                <textarea
                  className="wb-json"
                  value={advanced}
                  onChange={(e) => setAdvanced(e.target.value)}
                />
                <Button
                  onClick={() => {
                    try {
                      const config = JSON.parse(advanced)
                      if (!config || Array.isArray(config) || typeof config !== 'object')
                        throw Error('参数须为对象。')
                      setNodes((v) => v.map((n) => (n.id === selected ? { ...n, config } : n)))
                      notify('步骤参数已更新，保存草稿后生效。')
                    } catch (e) {
                      notify(e.message, true)
                    }
                  }}
                >
                  应用参数
                </Button>
              </details>
              <Button
                danger
                icon={Trash2}
                onClick={() => {
                  setNodes((v) => v.filter((n) => n.id !== selected))
                  setEdges((v) => v.filter((e) => e.source !== selected && e.target !== selected))
                  setSelected(null)
                }}
              >
                删除步骤
              </Button>
            </>
          ) : (
            <Empty icon={Settings2} title="选择一个步骤">
              点击画布中的步骤查看设置。
            </Empty>
          )}
        </aside>
      </div>
    </main>
  )
}

function RunDetail({ run, notify, onClose, onRefresh }) {
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [partial, setPartial] = useState(false),
    [exclude, setExclude] = useState(false)
  async function control(action) {
    setBusy(true)
    try {
      await api('/workflow-runs/' + run.id + '/' + action, 'POST', {
        confirmed,
        accept_partial: partial,
        exclude_pending: exclude,
      })
      await onRefresh()
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={'工作流运行 · ' + run.definition.name}
      onClose={onClose}
      footer={
        <>
          <Button disabled={busy} onClick={onRefresh} icon={RefreshCw}>
            刷新
          </Button>
          {['running', 'waiting', 'queued'].includes(run.status) && (
            <Button disabled={busy} icon={Pause} onClick={() => control('pause')}>
              暂停后续步骤
            </Button>
          )}
          {['paused', 'needs_auth'].includes(run.status) && (
            <Button primary disabled={busy} icon={Play} onClick={() => control('resume')}>
              继续
            </Button>
          )}
          {run.status === 'failed' && (
            <Button primary disabled={busy} icon={RotateCcw} onClick={() => control('retry')}>
              重试失败步骤
            </Button>
          )}
          {run.status === 'uncertain' && (
            <Button
              primary
              disabled={busy || !confirmed}
              icon={RefreshCw}
              onClick={() => control('reconcile')}
            >
              核查提交并继续
            </Button>
          )}
          {!['succeeded', 'cancelled'].includes(run.status) && (
            <Button danger disabled={busy} icon={Square} onClick={() => control('cancel')}>
              取消运行
            </Button>
          )}
        </>
      }
    >
      <div className="wb-section-title">
        <span>{TIME(run.created)}</span>
        <Badge status={run.status} />
      </div>
      {run.error && <div className="wb-notice error">{run.error}</div>}
      <ol className="wb-run-steps">
        {run.definition.nodes.map((node) => {
          const value = run.state.nodes[node.id]
          return (
            <li key={node.id}>
              <div className={'wb-step-dot status-' + value.status}>
                {value.status === 'succeeded' ? <Check size={14} /> : <span />}
              </div>
              <div>
                <strong>{node.label}</strong>
                <Badge status={value.status} />
                {value.error && <p className="wb-error-text">{value.error}</p>}
                {value.result?.message && <p>{value.result.message}</p>}
                {value.result?.job && (
                  <small>
                    任务：{STATUS[value.result.job.status] || value.result.job.status} ·{' '}
                    {value.result.job.progress ?? 0}%
                  </small>
                )}
                {value.result?.hits && <p>搜索命中 {value.result.hits.length} 处画面。</p>}
                {value.result?.preview_id && <ChangeResult result={value.result} />}
                {value.result?.pairs && <p>已比较 {value.result.pairs.length} 组任务影像。</p>}
                {value.result?.data?.dispatched === false && <p>任务计划已保存，等待人工核对。</p>}
                {['annotation', 'training', 'tune'].includes(value.kind) &&
                  (value.result?.id || value.draft_id) && (
                    <Button
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('runhive-workbench-native-draft', {
                            detail: { kind: value.kind, id: value.result?.id || value.draft_id },
                          }),
                        )
                      }
                    >
                      {value.kind === 'annotation' ? '检查标注效果' : '打开原任务页核查'}
                    </Button>
                  )}
              </div>
            </li>
          )
        })}
      </ol>
      {run.status === 'waiting_review' && (
        <div className="wb-review">
          <h3>核对后继续</h3>
          <p>请检查上游结果和资源参数。飞行任务仍需在原专用页面确认。</p>
          <label>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            我已核对结果与参数
          </label>
          {Object.values(run.state.nodes).some(
            (n) => n.kind === 'annotation_review' && n.status === 'waiting_review',
          ) && (
            <>
              <label>
                <input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
                仅使用正式标签，排除未复核候选
              </label>
              <label>
                <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
                接受当前部分标注结果
              </label>
            </>
          )}
          <Button primary icon={Check} disabled={!confirmed || busy} onClick={() => control('approve')}>
            确认继续
          </Button>
        </div>
      )}
      {run.status === 'uncertain' && (
        <div className="wb-review">
          <h3>核查提交状态</h3>
          <p>先查看原任务记录，再继续核查。系统会复用原草稿或分析请求，避免重复提交。</p>
          <label>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            我已查看原业务任务记录
          </label>
        </div>
      )}
    </Modal>
  )
}

function Workflows({ catalog, notify, action, accountId }) {
  const [data, setData] = useState({ items: [], templates: [], node_types: {} }),
    [runs, setRuns] = useState([]),
    [events, setEvents] = useState([]),
    [plans, setPlans] = useState([]),
    [assets, setAssets] = useState([])
  const [section, setSection] = useState('workflows'),
    [category, setCategory] = useState('periodic'),
    [editor, setEditor] = useState(null),
    [selectedRun, setSelectedRun] = useState(null),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [planForm, setPlanForm] = useState(null)
  const [planEditing, setPlanEditing] = useState(null),
    [planReview, setPlanReview] = useState(null),
    [planWhen, setPlanWhen] = useState(''),
    [flightReview, setFlightReview] = useState(null)
  const load = useCallback(async () => {
    try {
      const [flows, runList, planList, assetList, eventList] = await Promise.all([
        api('/workflows'),
        api('/workflow-runs'),
        api('/task-plans'),
        api('/resources?limit=500'),
        api('/workflow-events'),
      ])
      setData(flows)
      setRuns(runList.items)
      setPlans(planList.items)
      setAssets(assetList.items)
      setEvents(eventList.items)
    } catch (e) {
      notify(e.message, true)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (action?.view === 'plans') {
      setSection('plans')
      load()
    }
    if (action?.view === 'workflow' && action.id)
      api('/workflows/' + action.id)
        .then(setEditor)
        .catch((e) => notify(e.message, true))
  }, [action?.id, action?.view])
  useEffect(() => {
    if (!selectedRun || !['queued', 'running', 'waiting'].includes(selectedRun.status)) return
    const timer = setInterval(() => refreshRun(selectedRun.id), 3000)
    return () => clearInterval(timer)
  }, [selectedRun?.id, selectedRun?.status])
  async function refreshRun(id) {
    try {
      const value = await api('/workflow-runs/' + id)
      setSelectedRun(value)
      setRuns((list) => [value, ...list.filter((r) => r.id !== id)])
    } catch (e) {
      notify(e.message, true)
    }
  }
  async function execute() {
    setBusy(true)
    try {
      if (confirm.action === 'run') {
        const run = await api('/workflows/' + confirm.item.id + '/run', 'POST', { confirmed: true })
        setSelectedRun(run)
      } else
        await api('/workflows/' + confirm.item.id + '/enable', 'POST', {
          enabled: confirm.action === 'enable',
          revision: confirm.item.revision,
        })
      setConfirm(null)
      await load()
      notify(confirm.action === 'run' ? '工作流已启动。' : '工作流状态已更新。')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setBusy(false)
    }
  }
  if (editor)
    return (
      <WorkflowEditor
        key={editor.id || editor.template_id || editor.name}
        initial={editor}
        catalog={catalog}
        assets={assets}
        nodeTypes={data.node_types}
        notify={notify}
        onBack={() => setEditor(null)}
        onSaved={() => {
          setEditor(null)
          load()
        }}
      />
    )
  const fields = {
    name: { label: '任务名称', type: 'text', required: true },
    objective: { label: '巡检目标', type: 'text', required: true },
    airline_id: { label: '航线', type: 'resource', source: 'routes', required: true },
    equipment_id: { label: '设备', type: 'resource', source: 'devices' },
    rth_altitude: { label: '返航高度（米）', type: 'number', min: 20, max: 500, default: 100 },
  }
  return (
    <>
      <aside className="wb-sidebar">
        <div className="wb-sidebar-heading">
          <Workflow size={20} />
          <strong>工作流中心</strong>
        </div>
        <p className="wb-sidebar-hint">把目标拆成可核对的步骤</p>
        {[
          ['workflows', '我的工作流', Workflow],
          ['templates', '示例模板', LayoutGrid],
          ['runs', '运行记录', Clock],
          ['events', '触发队列', Zap],
          ['plans', '任务计划', ClipboardList],
        ].map(([key, label, Icon]) => (
          <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <div className="wb-sidebar-bottom">
          <span>保留航线与业务模块</span>
          <small>飞行任务均需人工确认</small>
        </div>
      </aside>
      <main className="wb-main">
        <header className="wb-page-header">
          <div>
            <h1>
              {
                {
                  workflows: '我的工作流',
                  templates: '示例模板',
                  runs: '运行记录',
                  events: '触发队列',
                  plans: '任务计划',
                }[section]
              }
            </h1>
            <p>周期性巡检、事件触发与训练流程统一管理。</p>
          </div>
          <div className="wb-toolbar">
            <Button icon={RefreshCw} onClick={load}>
              刷新
            </Button>
            <Button
              icon={Search}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('runhive-assistant-compose', {
                    detail: {
                      source: 'runhive-workbench',
                      admin_id: accountId,
                      text: '我要规划一个巡检任务，请从选择航线开始引导我。',
                      context: { title: '工作流中心 · 任务规划', task: 'task_plan' },
                    },
                  }),
                )
              }
            >
              让 Agent 规划
            </Button>
            <Button
              primary
              icon={Plus}
              onClick={() => {
                if (section === 'plans') {
                  setPlanEditing(null)
                  setPlanForm({
                    name: '巡检任务计划',
                    objective: '',
                    airline_id: '',
                    equipment_id: '',
                    rth_altitude: 100,
                    schedule: { kind: 'manual' },
                  })
                } else setSection('templates')
              }}
            >
              {section === 'plans' ? '创建任务计划' : '从模板创建'}
            </Button>
          </div>
        </header>
        {['workflows', 'templates'].includes(section) && (
          <div className="wb-segmented">
            <button
              className={category === 'periodic' ? 'active' : ''}
              onClick={() => setCategory('periodic')}
            >
              <Clock size={16} />
              周期性工作流
            </button>
            <button className={category === 'event' ? 'active' : ''} onClick={() => setCategory('event')}>
              <Zap size={16} />
              触发式工作流
            </button>
            <button className={category === 'manual' ? 'active' : ''} onClick={() => setCategory('manual')}>
              手动运行
            </button>
          </div>
        )}
        {section === 'templates' && (
          <div className="wb-template-grid">
            {data.templates
              .filter((t) => t.category === category)
              .map((template) => (
                <article className="wb-card wb-template" key={template.id}>
                  <div className="wb-template-icon">
                    {template.category === 'periodic' ? <Clock size={24} /> : <Zap size={24} />}
                  </div>
                  <h2>{template.name}</h2>
                  <p>{template.description}</p>
                  <div className="wb-template-chain">
                    {template.nodes.map((node, i) => (
                      <React.Fragment key={node.id}>
                        {i > 0 && <ArrowRight size={12} />}
                        <span>{node.label}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <Button
                    primary
                    icon={Plus}
                    onClick={() => setEditor({ ...template, id: undefined, template_id: template.id })}
                  >
                    使用模板
                  </Button>
                </article>
              ))}
          </div>
        )}
        {section === 'workflows' && (
          <div className="wb-workflow-list">
            {data.items
              .filter((w) => w.trigger.kind === category)
              .map((item) => (
                <article className="wb-card wb-workflow-row" key={item.id}>
                  <div className="wb-template-icon">
                    <Workflow size={23} />
                  </div>
                  <div className="wb-workflow-copy">
                    <h2>
                      {item.name}
                      <span className={'wb-badge ' + (item.enabled ? 'status-running' : '')}>
                        {item.enabled ? '已启用' : '停用草稿'}
                      </span>
                    </h2>
                    <p>{item.description}</p>
                    <small>
                      {item.nodes.length} 个步骤 ·{' '}
                      {item.trigger.kind === 'periodic'
                        ? `每 ${item.trigger.interval_minutes} 分钟`
                        : item.trigger.event === 'resource.uploaded'
                          ? '资源上传触发'
                          : item.trigger.event === 'flight_task.completed'
                            ? '航线任务完成触发'
                            : '事件触发'}
                      {item.next_at ? ' · 下次 ' + TIME(item.next_at) : ''}
                    </small>
                    {item.reason && <p className="wb-error-text">{item.reason}</p>}
                  </div>
                  <div className="wb-toolbar">
                    <Button icon={Settings2} disabled={!!item.enabled} onClick={() => setEditor(item)}>
                      编辑
                    </Button>
                    <Button icon={Play} onClick={() => setConfirm({ item, action: 'run' })}>
                      运行一次
                    </Button>
                    <Button
                      primary={!item.enabled}
                      onClick={() => setConfirm({ item, action: item.enabled ? 'disable' : 'enable' })}
                    >
                      {item.enabled ? '停用' : '启用'}
                    </Button>
                  </div>
                </article>
              ))}
            {!data.items.some((w) => w.trigger.kind === category) && (
              <Empty icon={Workflow} title="还没有工作流">
                选择示例模板，绑定实际资源后开始。
              </Empty>
            )}
          </div>
        )}
        {section === 'runs' && (
          <section className="wb-card">
            <table className="wb-table">
              <thead>
                <tr>
                  <th>工作流</th>
                  <th>开始时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.definition.name}</td>
                    <td>{TIME(run.created)}</td>
                    <td>
                      <Badge status={run.status} />
                    </td>
                    <td>
                      <Button icon={Eye} onClick={() => setSelectedRun(run)}>
                        查看步骤
                      </Button>
                      <Button icon={Download} onClick={() => exportReport('RunHive-工作流-' + run.id, run)}>
                        导出记录
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!runs.length && <Empty icon={Clock} title="暂无运行记录" />}
          </section>
        )}
        {section === 'plans' && (
          <div className="wb-template-grid">
            {plans.map((plan) => (
              <article className="wb-card wb-plan" key={plan.id}>
                <div className="wb-section-title">
                  <h2>{plan.data.name}</h2>
                  <Badge status={plan.status} />
                </div>
                <p>{plan.data.objective}</p>
                <div className="wb-plan-resources">
                  <span>航线：{plan.data.resources.airline_id.name}</span>
                  <span>设备：{plan.data.resources.equipment_id?.name || '待选择'}</span>
                  <span>返航高度：{plan.data.rth_altitude} 米</span>
                </div>
                <ol>
                  {plan.data.steps.map((step, i) => (
                    <li key={i}>
                      <b>{step.title}</b>
                      <small>{step.description}</small>
                    </li>
                  ))}
                </ol>
                <div className="wb-toolbar">
                  <Button
                    icon={Settings2}
                    onClick={() => {
                      setPlanEditing(plan)
                      setPlanForm(
                        Object.fromEntries(
                          Object.entries(plan.data).filter(([key]) =>
                            [
                              'name',
                              'objective',
                              'airline_id',
                              'equipment_id',
                              'rth_altitude',
                              'schedule',
                              'analysis',
                              'onsite',
                            ].includes(key),
                          ),
                        ),
                      )
                    }}
                  >
                    编辑计划
                  </Button>
                  <Button
                    primary
                    icon={Check}
                    onClick={() => {
                      setPlanReview(plan)
                      setPlanWhen('')
                      setFlightReview(null)
                    }}
                  >
                    核对执行
                  </Button>
                </div>
                <small className="wb-muted">{TIME(plan.created)}</small>
              </article>
            ))}
            {!plans.length && (
              <Empty icon={ClipboardList} title="还没有任务计划">
                选择已保存的航线，或让平台助手逐步规划。
              </Empty>
            )}
          </div>
        )}
        {section === 'events' && (
          <section className="wb-card">
            <p className="wb-muted">
              工作流繁忙时事件继续排队；航线任务完成后等待媒体同步，最多等待 24 小时。
            </p>
            <table className="wb-table">
              <thead>
                <tr>
                  <th>工作流</th>
                  <th>触发事件</th>
                  <th>时间</th>
                  <th>状态</th>
                  <th>说明与操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{event.name}</td>
                    <td>
                      {{
                        'resource.uploaded': '资源上传',
                        'flight_task.completed': '航线任务完成',
                        'dataset.ready': '数据集更新',
                      }[event.event] || event.event}
                    </td>
                    <td>{TIME(event.created)}</td>
                    <td>
                      <Badge status={event.status} />
                    </td>
                    <td>
                      {event.reason || '—'}
                      {event.status === 'failed' && (
                        <Button
                          icon={RotateCcw}
                          onClick={async () => {
                            try {
                              await api('/workflow-events/' + event.id + '/retry', 'POST', {})
                              await load()
                            } catch (e) {
                              notify(e.message, true)
                            }
                          }}
                        >
                          重新排队
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!events.length && (
              <Empty icon={Zap} title="暂无触发事件">
                启用触发式工作流后，在这里查看排队与处理情况。
              </Empty>
            )}
          </section>
        )}
        {confirm && (
          <Modal
            title={
              confirm.action === 'run'
                ? '确认运行工作流'
                : confirm.action === 'enable'
                  ? '启用工作流'
                  : '停用工作流'
            }
            onClose={() => !busy && setConfirm(null)}
            footer={
              <>
                <Button onClick={() => setConfirm(null)} disabled={busy}>
                  取消
                </Button>
                <Button primary onClick={execute} disabled={busy}>
                  {busy ? '处理中…' : '确认'}
                </Button>
              </>
            }
          >
            <h3>{confirm.item.name}</h3>
            <p>{confirm.item.description}</p>
            {confirm.action === 'enable' && (
              <p className="wb-notice">
                启用后授予此工作流 30 天后台运行权限，关闭浏览器后仍可运行；停用会撤销授权。到期后请重新启用。
              </p>
            )}
            <ol className="wb-confirm-chain">
              {confirm.item.nodes.map((n) => (
                <li key={n.id}>{n.label}</li>
              ))}
            </ol>
            <p>
              {confirm.action === 'disable'
                ? '停用后不再创建新的自动运行，当前运行可在记录中单独暂停或取消。'
                : '将使用当前绑定的真实资源，搜索或标注会调用已配置的模型。训练与微调会在确认节点暂停。飞行任务不会自动下发。'}
            </p>
          </Modal>
        )}
        {selectedRun && (
          <RunDetail
            run={selectedRun}
            notify={notify}
            onClose={() => setSelectedRun(null)}
            onRefresh={() => refreshRun(selectedRun.id)}
          />
        )}
        {planForm && (
          <Modal
            title={planEditing ? '编辑任务计划草稿' : '创建任务计划草稿'}
            onClose={() => !busy && setPlanForm(null)}
            footer={
              <>
                <Button disabled={busy} onClick={() => setPlanForm(null)}>
                  取消
                </Button>
                <Button
                  primary
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await api(
                        '/task-plans' + (planEditing ? '/' + planEditing.id : ''),
                        planEditing ? 'PUT' : 'POST',
                        planEditing ? { revision: planEditing.revision, data: planForm } : planForm,
                      )
                      setPlanForm(null)
                      await load()
                      notify('任务计划已保存，尚未下发飞行。')
                    } catch (e) {
                      notify(e.message, true)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  保存草稿
                </Button>
              </>
            }
          >
            <Fields
              fields={fields}
              bindings={planForm}
              setBindings={setPlanForm}
              catalog={catalog}
              assets={assets}
            />
          </Modal>
        )}
        {planReview && (
          <Modal
            title="核对飞行任务"
            onClose={() => !busy && setPlanReview(null)}
            footer={
              <>
                <Button disabled={busy} onClick={() => setPlanReview(null)}>
                  关闭
                </Button>
                {flightReview ? (
                  <a
                    className="wb-button primary"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={flightReview.confirmation_url}
                  >
                    打开专用确认页
                  </a>
                ) : (
                  <Button
                    primary
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        const result = await api('/task-plans/' + planReview.id + '/prepare-flight', 'POST', {
                          revision: planReview.revision,
                          ...(planWhen
                            ? { execute_time: Math.floor(new Date(planWhen).getTime() / 1000) }
                            : {}),
                        })
                        const url = new URL(result.confirmation_url, location.origin)
                        if (
                          url.origin !== location.origin ||
                          !/^\/llm-center\/agent\/platform\/requests\/[a-f0-9]{48}$/.test(url.pathname)
                        )
                          throw Error('确认入口无效。')
                        setFlightReview(result)
                        load()
                      } catch (e) {
                        notify(e.message, true)
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    准备确认页面
                  </Button>
                )}
              </>
            }
          >
            <h3>{planReview.data.name}</h3>
            <div className="wb-plan-resources">
              <span>航线：{planReview.data.resources.airline_id.name}</span>
              <span>设备：{planReview.data.resources.equipment_id?.name || '请先编辑计划选择设备'}</span>
              <span>返航高度：{planReview.data.rth_altitude} 米</span>
            </div>
            <label className="wb-field">
              <span>计划执行时间（留空表示专用页面确认后执行）</span>
              <input
                type="datetime-local"
                value={planWhen}
                disabled={!!flightReview}
                onChange={(e) => setPlanWhen(e.target.value)}
              />
            </label>
            <p className="wb-muted">这里只准备确认页面。设备收到任务前，还需要您在专用页面核对并确认下发。</p>
          </Modal>
        )}
      </main>
    </>
  )
}

export function App({ mode, accountId }) {
  const [catalog, setCatalog] = useState({}),
    [notice, setNotice] = useState(null),
    [action, setAction] = useState(null),
    [ready, setReady] = useState(false)
  const notify = useCallback((text, error = false) => setNotice({ text, error }), [])
  useEffect(() => {
    let alive = true
    api('/workbench/catalog')
      .then((value) => {
        if (alive) {
          setCatalog(value)
          setReady(true)
        }
      })
      .catch((e) => alive && notify(e.message, true))
    const open = (e) => {
      if (e.detail?.admin_id === accountId) {
        setAction(e.detail)
        setReady(true)
      }
    }
    window.addEventListener('runhive-workbench-open', open)
    if (window.__runhiveWorkbenchAction?.admin_id === accountId) setAction(window.__runhiveWorkbenchAction)
    return () => {
      alive = false
      window.removeEventListener('runhive-workbench-open', open)
    }
  }, [])
  return (
    <div className="wb-app">
      {notice && (
        <div className={'wb-toast' + (notice.error ? ' error' : '')} role={notice.error ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {!ready ? (
        <main className="wb-main">
          <Empty icon={Loader2} title="正在连接工作区">
            首次进入需要验证当前账号，之后切换会保留状态。
          </Empty>
          <Button
            icon={RefreshCw}
            onClick={() =>
              api('/workbench/catalog')
                .then((value) => {
                  setCatalog(value)
                  setReady(true)
                })
                .catch((e) => notify(e.message, true))
            }
          >
            重新连接
          </Button>
        </main>
      ) : mode === 'resources' ? (
        <Resources catalog={catalog} notify={notify} action={action} accountId={accountId} />
      ) : (
        <Workflows catalog={catalog} notify={notify} action={action} accountId={accountId} />
      )}
    </div>
  )
}
