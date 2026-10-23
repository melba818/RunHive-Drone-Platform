import { isWorkspaceMessage } from './launch.js'
import { MODULES } from './sections.js'
import { tuneTheme } from './tune-theme.js'
import { decorateTuneDocument } from './tune-presentation.js'
import { agentTheme } from './agent-theme.js'

// Keep trusted application frames connected to the same DOM node. Moving an iframe
// into Vue KeepAlive storage recreates its browsing context and consumes SSO again.
const nativeTheme = `
:root,:root[data-theme]{--ui-canvas:#f5f8fc;--ui-surface:#fff;--ui-surface-muted:#f5f8fc;--body-background-fill:#f5f8fc;--background-fill-secondary:#f5f8fc;--sidebar:#fff;--background:#f5f8fc}
html,body,.gradio-container{background:#f5f8fc!important}
.rh-agent-shell{background:#f5f8fc!important}
.rh-agent-conversations{background:#fff!important;border-right:1px solid #1f385814}
`
export class FramePool {
  constructor(win = globalThis.window, doc = globalThis.document) {
    this.win = win
    this.doc = doc
    this.entries = new Map()
    this.account = null
    this.identity = ''
    this.timer = null
    this.unsubscribe = null
    this.onMessage = (event) => {
      if (!this.checkAccount()) return
      for (const entry of this.entries.values()) {
        if (
          !isWorkspaceMessage(
            event,
            entry.frame.contentWindow,
            this.win.location.origin,
            entry.adminId,
            entry.module,
          )
        )
          continue
        const data = event.data
        if (data.type === 'llm-center-auth-ready') entry.authenticated = true
        if (
          data.type === 'llm-section-ready' &&
          MODULES[entry.module].items.some((item) => item.key === data.section)
        ) {
          entry.ready = true
          entry.section = data.section
          this.theme(entry)
        }
        entry.owner?.receiveMessage(event)
      }
    }
    this.onStorage = (event) => {
      if (event.key !== 'adminInfo' && event.key !== null) return
      try {
        const stored = JSON.parse(this.win.localStorage.getItem('adminInfo') || 'null')
        if (`${stored?.id || 0}:${stored?.token || ''}` === this.identity) return
      } catch (_) {}
      this.destroyAll()
    }
  }
  bind(account) {
    const identity = `${account.id || 0}:${account.token || ''}`
    if (this.identity && this.identity !== identity) this.destroyAll()
    this.account = account
    this.identity = identity
    if (!this.timer) {
      this.win.addEventListener('message', this.onMessage)
      this.win.addEventListener('storage', this.onStorage)
      this.timer = this.win.setInterval(() => {
        if (!this.checkAccount()) return
        for (const entry of this.entries.values())
          if (!entry.owner && Date.now() - entry.parkedAt > 1800000) this.destroy(entry)
      }, 1000)
      if (typeof account.$subscribe === 'function')
        this.unsubscribe = account.$subscribe(() => this.checkAccount(), { detached: true, flush: 'sync' })
    }
  }
  checkAccount() {
    if (!this.account || `${this.account.id || 0}:${this.account.token || ''}` !== this.identity) {
      this.destroyAll()
      return false
    }
    return true
  }
  peek(account, module) {
    this.bind(account)
    return this.entries.get(module) || null
  }
  create(account, module, adminId, url, owner) {
    this.bind(account)
    this.destroy(this.entries.get(module))
    const host = this.doc.createElement('div'),
      frame = this.doc.createElement('iframe'),
      veil = this.doc.createElement('div')
    host.className = 'rh-llm-resident-host'
    host.style.display = 'none'
    frame.className = 'rh-llm-frame'
    frame.title = owner.centerTitle || '账号工作区'
    frame.referrerPolicy = 'same-origin'
    frame.src = url
    veil.className = 'rh-llm-status rh-llm-resident-veil'
    const spinner = this.doc.createElement('span'),
      label = this.doc.createElement('p')
    spinner.className = 'runos-spinner'
    label.textContent = `正在加载${owner.centerTitle || '账号'}工作区…`
    veil.appendChild(spinner)
    veil.appendChild(label)
    host.appendChild(frame)
    host.appendChild(veil)
    this.doc.body.appendChild(host)
    const entry = {
      host,
      frame,
      veil,
      adminId,
      module,
      identity: this.identity,
      owner,
      authenticated: false,
      ready: false,
      section: owner.section,
      parkedAt: 0,
    }
    frame.addEventListener('load', () => {
      this.theme(entry)
      entry.owner?.sendSection()
    })
    this.entries.set(module, entry)
    return entry
  }
  attach(entry, owner) {
    if (!this.checkAccount() || entry.identity !== this.identity || this.entries.get(entry.module) !== entry)
      return false
    entry.owner = owner
    return true
  }
  position(entry, owner) {
    if (!entry || entry.owner !== owner || !owner.active || !this.checkAccount()) return
    const shell = owner.$refs.frameShell
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    // Route wrappers can extend below the browser viewport. Keeping the iframe
    // that tall makes its native scrollbar unreachable behind the outer clip.
    const height = Number.isFinite(this.win.innerHeight)
      ? Math.max(0, Math.min(rect.height, this.win.innerHeight - rect.top))
      : rect.height
    // Native Gradio announces readiness from requestAnimationFrame. CSS visibility
    // hidden pauses that callback in Chrome, deadlocking the loading handshake.
    // Keep the frame renderable behind an opaque loading veil. Opacity zero can
    // also throttle iframe callbacks, so neither hiding technique is safe here.
    const blocked = Boolean(owner.loading || owner.error)
    Object.assign(entry.host.style, {
      display: owner.error ? 'none' : 'block',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: blocked ? 'none' : 'auto',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${height}px`,
    })
    entry.veil.style.display = owner.loading ? 'flex' : 'none'
  }
  park(entry, owner) {
    if (!entry || entry.owner !== owner) return
    entry.owner = null
    entry.parkedAt = Date.now()
    entry.host.style.display = 'none'
  }
  theme(entry) {
    try {
      const win = entry.frame.contentWindow
      const path = `/llm-center/${entry.module}/ui`
      if (
        win.location.origin !== this.win.location.origin ||
        !(win.location.pathname === path || win.location.pathname.startsWith(path + '/'))
      )
        return
      const doc = entry.frame.contentDocument
      let style = doc.getElementById('runhive-center-theme-v3')
      if (!style) {
        style = doc.createElement('style')
        style.id = 'runhive-center-theme-v3'
        doc.head.appendChild(style)
      }
      style.textContent = nativeTheme + (entry.module === 'tune' ? tuneTheme : agentTheme)
      // Gradio adds its custom CSS after mounting. Keep the palette adapter last
      // when it announces readiness, so late styles cannot restore the old color.
      doc.head.appendChild(style)
      if (entry.module === 'tune' && entry.presentationDoc !== doc && doc.defaultView?.MutationObserver) {
        entry.cleanupPresentation?.()
        entry.presentationDoc = doc
        entry.cleanupPresentation = decorateTuneDocument(doc)
      }
    } catch (_) {
      /* Generated previews have an opaque origin and never receive this adapter. */
    }
  }
  destroy(entry) {
    if (!entry) return
    entry.cleanupPresentation?.()
    entry.host.remove()
    this.entries.delete(entry.module)
  }
  destroyAll() {
    for (const entry of this.entries.values()) {
      entry.cleanupPresentation?.()
      entry.host.remove()
    }
    this.entries.clear()
    if (this.timer) this.win.clearInterval(this.timer)
    // Pinia dispatches subscriptions from one list. Defer removal so clearing this
    // pool cannot skip the other center's account-change callback in that list.
    this.timer = null
    const unsubscribe = this.unsubscribe
    this.unsubscribe = null
    if (unsubscribe) queueMicrotask(unsubscribe)
    this.win.removeEventListener('message', this.onMessage)
    this.win.removeEventListener('storage', this.onStorage)
    this.identity = ''
    this.account = null
  }
}
export const frames = new FramePool()
