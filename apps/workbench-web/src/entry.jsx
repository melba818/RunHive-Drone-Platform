import React from 'react'
import { createRoot } from 'react-dom/client'
import { f as defineComponent, m as vnode } from '/assets/vue-FCF7ynEj.js'
import { u as useAdminInfo } from '/assets/index-D5rXB33a.js'
import { App } from './App.jsx'
import { session } from './api.js'

const cache = new Map()
let identity = '',
  unsubscribe = null
function clear() {
  for (const e of cache.values()) {
    e.root.unmount()
    e.host.remove()
  }
  cache.clear()
}
function bind(account) {
  const key = `${account.id}:${account.token}`
  if (identity && identity !== key) clear()
  identity = key
  if (!unsubscribe && account.$subscribe)
    unsubscribe = account.$subscribe(
      () => {
        const next = `${account.id}:${account.token}`
        if (next !== identity) {
          clear()
          identity = next
        }
      },
      { detached: true, flush: 'sync' },
    )
}
window.addEventListener('storage', (event) => {
  if (event.key !== 'adminInfo' && event.key !== null) return
  try {
    const value = JSON.parse(localStorage.getItem('adminInfo') || 'null')
    if (`${value?.id || 0}:${value?.token || ''}` === identity) return
  } catch {}
  clear()
  identity = ''
})
export function createWorkbench(mode) {
  return defineComponent({
    name: mode === 'resources' ? 'RunhiveResourceCenter' : 'RunhiveWorkflowCenter',
    data() {
      return {
        account: useAdminInfo(),
        entry: null,
        active: false,
        error: '',
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
          this.entry = null
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
      async resume() {
        bind(this.account)
        const generation = ++this.generation
        this.error = ''
        try {
          await session(true)
          if (!this.active || generation !== this.generation) return
          let entry = cache.get(mode)
          if (!entry) {
            const host = document.createElement('section')
            host.className = 'wb-resident-host'
            host.style.display = 'none'
            document.body.append(host)
            const root = createRoot(host)
            root.render(<App mode={mode} accountId={Number(this.account.id)} />)
            entry = { host, root, identity, owner: this }
            cache.set(mode, entry)
          }
          entry.owner = this
          this.entry = entry
          this.$nextTick(() => {
            this.observer?.disconnect()
            this.observer = new ResizeObserver(() => this.position())
            this.observer.observe(this.$refs.shell)
            this.position()
          })
        } catch (e) {
          if (this.active && generation === this.generation) {
            this.error = e.message
            this.entry?.host && (this.entry.host.style.display = 'none')
          }
        }
      },
      position() {
        const entry = this.entry
        if (!entry || entry.owner !== this || !this.active || entry.identity !== identity) return
        const rect = this.$refs.shell?.getBoundingClientRect()
        if (!rect) return
        Object.assign(entry.host.style, {
          display: this.error ? 'none' : 'block',
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: Math.max(0, Math.min(rect.height, window.innerHeight - rect.top)) + 'px',
        })
      },
      park() {
        this.active = false
        this.generation++
        this.observer?.disconnect()
        if (this.entry?.owner === this) {
          this.entry.owner = null
          this.entry.host.style.display = 'none'
        }
        this.entry = null
      },
    },
    render() {
      return vnode(
        'section',
        { class: 'wb-shell', ref: 'shell' },
        this.error
          ? [vnode('p', { role: 'alert' }, this.error), vnode('button', { onClick: this.resume }, '重新连接')]
          : [],
      )
    },
  })
}
