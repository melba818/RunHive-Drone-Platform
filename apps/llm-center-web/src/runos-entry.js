import { f as defineComponent, m as vnode } from '/assets/vue-FCF7ynEj.js'
import { d as createAxios, u as useAdminInfo } from '/assets/index-D5rXB33a.js'
import './style.css'
let entry = null,
  identity = '',
  unsubscribe = null
function destroy() {
  entry?.host.remove()
  entry = null
}
function bind(account) {
  const next = `${account.id}:${account.token}`
  if (identity && identity !== next) destroy()
  identity = next
  if (!unsubscribe && account.$subscribe)
    unsubscribe = account.$subscribe(
      () => {
        if (`${account.id}:${account.token}` !== identity) {
          destroy()
          identity = `${account.id}:${account.token}`
        }
      },
      { detached: true, flush: 'sync' },
    )
}
window.addEventListener('storage', (event) => {
  if (event.key !== 'adminInfo' && event.key !== null) return
  try {
    const v = JSON.parse(localStorage.getItem('adminInfo') || 'null')
    if (`${v?.id || 0}:${v?.token || ''}` === identity) return
  } catch {}
  destroy()
  identity = ''
})
export default defineComponent({
  name: 'RunhiveApplicationCenter',
  data() {
    return {
      account: useAdminInfo(),
      active: false,
      error: '',
      loading: true,
      generation: 0,
      observer: null,
      onResize: null,
    }
  },
  computed: {
    identity() {
      return `${this.account.id}:${this.account.token}`
    },
  },
  watch: {
    identity: {
      flush: 'sync',
      handler() {
        bind(this.account)
        if (this.active) this.resume()
      },
    },
  },
  mounted() {
    this.onResize = () => this.position()
    window.addEventListener('resize', this.onResize)
    window.addEventListener('scroll', this.onResize, true)
    this.active = true
    this.resume()
  },
  activated() {
    if (!this.active) {
      this.active = true
      this.resume()
    }
  },
  deactivated() {
    this.park()
  },
  beforeUnmount() {
    this.park()
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('scroll', this.onResize, true)
  },
  methods: {
    async resume(force = false) {
      bind(this.account)
      const generation = ++this.generation
      this.error = ''
      this.loading = !entry?.ready
      try {
        // Recheck native module permission without provisioning or signing another ticket.
        await createAxios(
          { url: '/admin/Appcenter/access', method: 'GET' },
          { showSuccessMessage: false, cancelDuplicateRequest: false },
        )
        if (!this.active || generation !== this.generation) return
        if (force) destroy()
        if (!entry) {
          const result = await createAxios(
            { url: '/admin/Appcenter/launchRunos', method: 'POST', data: {} },
            { showSuccessMessage: false, cancelDuplicateRequest: false },
          )
          if (!this.active || generation !== this.generation) return
          const data = result.data,
            url = new URL(data.launch_url, window.location.origin)
          if (
            Number(data.admin_id) !== Number(this.account.id) ||
            !data.ticket ||
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw Error('应用登录信息无效。')
          url.searchParams.set('rh_embed', '1')
          url.hash = new URLSearchParams({ ticket: data.ticket, admin_id: String(data.admin_id) })
          const host = document.createElement('section'),
            frame = document.createElement('iframe'),
            veil = document.createElement('div')
          host.className = 'rh-llm-resident-host'
          host.style.display = 'none'
          frame.className = 'runos-frame'
          frame.title = '应用中心工作区'
          frame.allow = 'camera; fullscreen'
          frame.referrerPolicy = 'strict-origin-when-cross-origin'
          frame.src = url.toString()
          veil.className = 'rh-llm-status rh-llm-resident-veil'
          veil.textContent = '正在加载应用工作区…'
          host.append(frame, veil)
          document.body.append(host)
          entry = { host, frame, veil, owner: this, identity, ready: false, origin: url.origin }
          const current = entry
          current.message = (event) => {
            if (
              entry !== current ||
              event.source !== current.frame.contentWindow ||
              event.origin !== current.origin ||
              event.data?.source !== 'runos-auth-gate'
            )
              return
            if (event.data.type === 'runos-auth-ready') {
              current.ready = true
              current.veil.style.display = 'none'
              if (current.owner) {
                current.owner.loading = false
                current.owner.position()
              }
            } else if (event.data.type === 'runos-auth-error' && current.owner) {
              current.owner.error = event.data.message || '应用登录已失效。'
              current.owner.position()
            }
          }
          window.addEventListener('message', current.message)
          const remove = host.remove.bind(host)
          host.remove = () => {
            window.removeEventListener('message', current.message)
            remove()
          }
        }
        entry.owner = this
        this.loading = !entry.ready
        this.$nextTick(() => {
          this.observer?.disconnect()
          this.observer = new ResizeObserver(() => this.position())
          this.observer.observe(this.$refs.shell)
          this.position()
        })
      } catch (error) {
        if (this.active && generation === this.generation) {
          this.loading = false
          this.error = error.message || '应用暂时不可用。'
          this.position()
        }
      }
    },
    position() {
      if (!entry || entry.owner !== this || !this.active || entry.identity !== identity) return
      const rect = this.$refs.shell?.getBoundingClientRect()
      if (!rect) return
      Object.assign(entry.host.style, {
        display: this.error ? 'none' : 'block',
        left: rect.left + 'px',
        top: rect.top + 'px',
        width: rect.width + 'px',
        height: Math.max(0, Math.min(rect.height, innerHeight - rect.top)) + 'px',
      })
      entry.veil.style.display = this.loading ? 'flex' : 'none'
    },
    park() {
      this.active = false
      this.generation++
      this.observer?.disconnect()
      if (entry?.owner === this) {
        entry.owner = null
        entry.host.style.display = 'none'
      }
    },
  },
  render() {
    return vnode(
      'main',
      { class: 'rh-runos-cached-shell', ref: 'shell' },
      this.error
        ? [
            vnode('p', { role: 'alert' }, this.error),
            vnode('button', { onClick: () => this.resume(true) }, '重新连接'),
          ]
        : [],
    )
  },
})
