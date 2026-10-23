import { W as BackendApi, r as appRouter } from '/assets/index-D5rXB33a.js'

const definitions = [
  { key: 'projects', title: '项目', controller: 'Project', field: 'name', path: '/admin/project/index' },
  { key: 'routes', title: '航线', controller: 'Airline', field: 'name', path: '/admin/airline/index' },
  { key: 'devices', title: '设备', controller: 'Equipment', field: 'nickname', path: '/admin/equipment/index' },
  { key: 'tasks', title: '飞行任务', controller: 'Flighttask', field: 'name', path: '/admin/flighttask/index' },
  { key: 'records', title: '飞行记录', controller: 'Flightrecord', field: null, path: '/admin/flightrecord/index' },
  { key: 'media', title: '媒体', controller: 'Media', field: 'name', path: '/admin/flightSpace/index' },
]
const clients = Object.fromEntries(definitions.map(item => [item.key, new BackendApi(`admin/${item.controller}/`)]))
const icon = (name) => ({
  asset: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  chart: '<path d="M4 20V5m0 15h16M8 16l4-5 3 2 4-6"/>',
  task: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 5 2 2 5-5"/>',
  search: '<circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 4.5 4.5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 12-2L20 12M4 12l2.4 5a7 7 0 0 0 12-2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
})[name]
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`
const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node }
const value = input => input === null || input === undefined ? '—' : Number(input).toLocaleString('zh-CN')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const dateDaysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const dateMonthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
const searchDate = (from, to) => from && to ? [{field:'create_time',operator:'RANGE',val:`${from} 00:00:00,${to} 23:59:59`,render:'datetime'}] : []
const requestList = (key, params) => clients[key].index(params, {silentUnauthorized:true,showSuccessMessage:false,cancelDuplicateRequest:false})

let current = null
let map = window.__runhiveDashboardMap || null
window.addEventListener('runhive:dashboard-map', event => { map = event.detail })

function mount(dashboard) {
  if (current?.dashboard === dashboard) return
  current?.dispose()
  let disposed = false, sequence = 0, searchSequence = 0, dateFrom = '', dateTo = '', searchTimer
  const root = el('div','rh-home-overlay')
  root.innerHTML = `
    <aside class="rh-home-panel rh-home-left" aria-label="主页资产概览">
      <header class="rh-home-heading"><span class="rh-home-heading-icon">${svg('asset')}</span><span><strong>资产总览</strong><small class="rh-period-label">全部时间</small></span><button class="rh-icon-button rh-refresh" title="刷新统计" aria-label="刷新统计">${svg('refresh')}</button></header>
      <div class="rh-home-section-label">资源与航线</div>
      <div class="rh-home-stat-grid"><button class="rh-stat" data-go="projects"><small>项目</small><strong data-count="projects">—</strong></button><button class="rh-stat" data-go="routes"><small>航线</small><strong data-count="routes">—</strong></button><button class="rh-stat" data-go="devices"><small>设备</small><strong data-count="devices">—</strong></button><button class="rh-stat" data-go="media"><small>媒体文件</small><strong data-count="media">—</strong></button></div>
      <div class="rh-home-divider"></div><div class="rh-home-section-label">当前在线状态 <span>实时</span></div>
      <div class="rh-live-row"><span>无人机在线</span><strong data-live="drone">—</strong></div><div class="rh-live-sub"><span>执行中 <b data-live="drone-running">—</b></span><span>空闲中 <b data-live="drone-idle">—</b></span></div>
      <div class="rh-live-row"><span>机场在线</span><strong data-live="dock">—</strong></div><div class="rh-live-sub"><span>执行中 <b data-live="dock-running">—</b></span><span>空闲中 <b data-live="dock-idle">—</b></span></div>
      <div class="rh-home-spacer"></div><button class="rh-home-link" data-go="projects">进入项目管理 ${svg('arrow')}</button>
    </aside>
    <div class="rh-home-toolbar"><div class="rh-preset-group" role="group" aria-label="统计时间范围"><button data-period="all" class="active">全部</button><button data-period="week">近一周</button><button data-period="month">本月</button><button data-period="year">近一年</button></div><div class="rh-date-group"><input type="date" aria-label="开始日期" class="rh-date-from"><span>至</span><input type="date" aria-label="结束日期" class="rh-date-to"></div><div class="rh-search-wrap"><label class="rh-search-input">${svg('search')}<input type="search" placeholder="搜索项目、航线、设备或地点" aria-label="搜索项目、航线、设备或地点" autocomplete="off"></label><div class="rh-search-results" hidden></div></div></div>
    <aside class="rh-home-panel rh-home-right-top" aria-label="主页任务概览"><header class="rh-home-heading"><span class="rh-home-heading-icon">${svg('task')}</span><span><strong>任务概览</strong><small>按所选时间统计</small></span><button class="rh-home-head-link" data-go="tasks">查看任务 ${svg('arrow')}</button></header><div class="rh-home-wide-stats"><div><small>飞行任务</small><strong data-count="tasks">—</strong></div><div><small>飞行记录</small><strong data-count="records">—</strong></div></div><div class="rh-home-section-label">最近任务</div><div class="rh-recent-tasks">正在读取…</div><div class="rh-home-spacer"></div><button class="rh-home-link" data-path="/admin/workflowcenter">打开工作流中心 ${svg('arrow')}</button></aside>
    <aside class="rh-home-panel rh-home-right-bottom" aria-label="主页飞行数据"><header class="rh-home-heading"><span class="rh-home-heading-icon">${svg('chart')}</span><span><strong>飞行与数据成果</strong><small>真实业务数据</small></span><button class="rh-home-head-link" data-go="records">查看详情 ${svg('arrow')}</button></header><div class="rh-home-flight-grid"><div><small>历史累计里程</small><strong data-history="distance">—</strong></div><div><small>历史累计时长</small><strong data-history="time">—</strong></div><div><small>历史累计架次</small><strong data-history="sorties">—</strong></div><div><small>时段媒体文件</small><strong data-count="media-mirror">—</strong></div></div><p class="rh-home-footnote">设备历史累计值不随时间筛选变化；其余数量按所选时段统计。</p></aside>
  `
  dashboard.append(root)
  dashboard.classList.add('rh-home-ready')
  const setCount = (key, text) => root.querySelectorAll(`[data-count="${key}"]`).forEach(node => node.textContent = text)
  const updateOriginal = () => {
    const cards = dashboard.querySelectorAll('.dashboard-content .aerodrome')
    if (cards.length < 3) return
    const cardText = (card, selector) => card.querySelector(selector)?.textContent?.trim() || '—'
    const live = [
      ['drone',cards[0],'.content-item-info .info-value'],['drone-running',cards[0],'.item-box:nth-child(1) .info-value'],['drone-idle',cards[0],'.item-box:nth-child(2) .info-value'],
      ['dock',cards[1],'.content-item-info .info-value'],['dock-running',cards[1],'.item-box:nth-child(1) .info-value'],['dock-idle',cards[1],'.item-box:nth-child(2) .info-value'],
    ]
    for (const [key,card,selector] of live) root.querySelector(`[data-live="${key}"]`).textContent = cardText(card,selector)
    const history = cards[2].querySelectorAll('.info-value')
    for (const [i,key] of ['distance','time','sorties'].entries()) root.querySelector(`[data-history="${key}"]`).textContent = history[i]?.textContent?.trim() || '—'
  }
  const liveObserver = new MutationObserver(updateOriginal)
  const original = dashboard.querySelector('.dashboard-content')
  if (original) liveObserver.observe(original,{subtree:true,childList:true,characterData:true})
  updateOriginal()

  function go(path) {
    const route = appRouter.getRoutes().find(item => item.path.toLowerCase() === path.toLowerCase())
    if (route) appRouter.push(route.path).catch(() => {})
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-go], [data-path]')
    if (target) go(target.dataset.path || definitions.find(item => item.key === target.dataset.go)?.path)
  })

  async function load() {
    const ticket = ++sequence
    const search = searchDate(dateFrom,dateTo)
    const results = await Promise.allSettled(definitions.map(item => requestList(item.key,{limit:item.key==='tasks'?4:1,search})))
    if (disposed || ticket !== sequence) return
    for (let i=0;i<definitions.length;i++) {
      const result = results[i]
      const data = result.status==='fulfilled' && result.value?.code===1 ? result.value.data : null
      const key = definitions[i].key
      setCount(key,data && Number.isFinite(Number(data.total)) ? value(data.total) : '—')
      if (key==='media') setCount('media-mirror',data && Number.isFinite(Number(data.total)) ? value(data.total) : '—')
      if (key==='tasks') {
        const list = root.querySelector('.rh-recent-tasks')
        list.replaceChildren()
        if (!data) list.textContent='任务数据暂不可用'
        else if (!data.list?.length) list.textContent='所选时段暂无任务'
        else for (const item of data.list.slice(0,3)) {
          const button=el('button','rh-task-item')
          button.append(el('span','',String(item.name||`任务 #${item.id}`)),el('small','',String(item.status||'待查看')))
          button.onclick=()=>go('/admin/flighttask/index')
          list.append(button)
        }
      }
    }
  }
  root.querySelector('.rh-refresh').onclick=load
  const fromInput=root.querySelector('.rh-date-from'),toInput=root.querySelector('.rh-date-to')
  toInput.max=today();fromInput.max=today()
  function choose(from,to,preset) {
    if (from && to && from>to) { const temp=from;from=to;to=temp }
    dateFrom=from;dateTo=to;fromInput.value=from;toInput.value=to
    root.querySelectorAll('[data-period]').forEach(node=>node.classList.toggle('active',node.dataset.period===preset))
    root.querySelector('.rh-period-label').textContent=from&&to?`${from} 至 ${to}`:'全部时间'
    load()
  }
  root.querySelectorAll('[data-period]').forEach(button => button.onclick=()=>{
    const period=button.dataset.period, end=today()
    choose(period==='all'?'':period==='week'?dateDaysAgo(6):period==='month'?dateMonthStart():dateDaysAgo(364),period==='all'?'':end,period)
  })
  for (const input of [fromInput,toInput]) input.addEventListener('change',()=>{if (fromInput.value&&toInput.value) choose(fromInput.value,toInput.value,'custom')})

  const searchInput=root.querySelector('.rh-search-input input'), searchResults=root.querySelector('.rh-search-results')
  const closeSearch=()=>{searchResults.hidden=true;searchResults.replaceChildren()}
  document.addEventListener('pointerdown',onOutside)
  function onOutside(event) { if (!root.querySelector('.rh-search-wrap').contains(event.target)) closeSearch() }
  function coordinate(query) {
    const parts=query.split(/[,，\s]+/).map(Number)
    return parts.length===2 && parts.every(Number.isFinite) && Math.abs(parts[0])<=90 && Math.abs(parts[1])<=180 ? {lat:parts[0],lng:parts[1]} : null
  }
  function flyTo(lat,lng) {
    if (map && !map.isDestroy && typeof map.setCameraView==='function') map.setCameraView({lat:Number(lat),lng:Number(lng),alt:5000,heading:0,pitch:-70})
  }
  async function searchNow() {
    const query=searchInput.value.trim(), ticket=++searchSequence
    if (!query) { closeSearch();return }
    searchResults.hidden=false;searchResults.textContent='正在搜索…'
    const locations=coordinate(query)
    const searchable=definitions.filter(item=>item.field)
    const results=await Promise.allSettled(searchable.map(item=>requestList(item.key,{limit:5,search:[{field:item.field,operator:'LIKE',val:query}]})))
    if(disposed || ticket!==searchSequence)return
    searchResults.replaceChildren()
    if(locations){const b=el('button','rh-result');b.innerHTML=`${svg('pin')}<span><strong>定位到经纬度</strong><small>${locations.lat}, ${locations.lng}</small></span>`;b.onclick=()=>{flyTo(locations.lat,locations.lng);closeSearch()};searchResults.append(b)}
    for(let i=0;i<searchable.length;i++) {
      const data=results[i].status==='fulfilled'&&results[i].value?.code===1?results[i].value.data:null
      for(const item of (data?.list||[]).slice(0,4)) {
        const def=searchable[i], b=el('button','rh-result'), span=el('span')
        b.innerHTML=svg(def.key==='projects'?'pin':'search')
        span.append(el('strong','',String(item[def.field]||`#${item.id}`)),el('small','',def.title+(item.project?.name?` · ${item.project.name}`:'')))
        b.append(span)
        b.onclick=()=>{closeSearch();searchInput.value=String(item[def.field]||'');if(def.key==='projects'&&Number.isFinite(Number(item.latitude))&&Number.isFinite(Number(item.longitude))){flyTo(item.latitude,item.longitude)}else go(def.path)}
        searchResults.append(b)
      }
    }
    if(!searchResults.childElementCount)searchResults.textContent='没有找到匹配的项目、航线、设备或地点'
  }
  searchInput.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchNow,280)})
  searchInput.addEventListener('keydown',event=>{if(event.key==='Escape')closeSearch();if(event.key==='Enter'){event.preventDefault();searchNow()}})
  load()
  current={dashboard,dispose(){disposed=true;sequence++;searchSequence++;clearTimeout(searchTimer);liveObserver.disconnect();document.removeEventListener('pointerdown',onOutside);root.remove();dashboard.classList.remove('rh-home-ready')}}
}

function reconcile() {
  const dashboard=document.querySelector('.dashboard[data-v-9988717a]')
  if (dashboard) {map=window.__runhiveDashboardMap||map;mount(dashboard)}
  else if (current) {current.dispose();current=null;map=null;window.__runhiveDashboardMap=null}
}
new MutationObserver(reconcile).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})
reconcile()
