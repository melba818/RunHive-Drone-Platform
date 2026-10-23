import { f as defineComponent, m as vnode, p as resolveComponent } from '/assets/vue-FCF7ynEj.js'
import { W as BackendApi, d as createAxios, u as useAdminInfo } from '/assets/index-D5rXB33a.js'
import { validateLaunch, isWorkspaceMessage, chineseError } from './launch.js'
import { MODULES, sectionInfo, validateWorkspace, filterWorkspace, taskStatus } from './sections.js'
import { frames } from './frame-pool.js'
import { attachNativeCenter } from './native-center.js'
import './style.css'
import { workspaceMethods } from './workspace-methods.js'
import { resourceActions, showWorkspaceMenu } from './workspace-menu.js'

const paths = {
  home: 'M3 10l9-7 9 7M5 9v11h14V9M9 20v-7h6v7',
  database:
    'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3',
  sliders: 'M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4',
  chart: 'M4 3v17h17M8 16v-5M13 16V7M18 16v-9',
  message: 'M4 4h16v12H9l-5 4V4',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v10',
  bot: 'M5 7h14v13H5V7ZM12 3v4M8 12h1M15 12h1M9 16h6M2 11v5M22 11v5',
  sparkles: 'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6',
  link: 'M10 14l4-4M8 16l-2 2a4 4 0 01-6-6l5-5a4 4 0 016 0M16 8l2-2a4 4 0 016 6l-5 5a4 4 0 01-6 0',
  clock: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0ZM12 7v5l3 2',
  chevron: 'M9 5l7 7-7 7',
  collapse: 'M4 4v16M15 6l-6 6 6 6',
  folder: 'M3 6h6l2 2h10v12H3V6',
  search: 'M20 20l-5-5M17 10a7 7 0 11-14 0 7 7 0 0114 0Z',
  refresh: 'M20 8a8 8 0 10.3 7M20 3v5h-5',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  pin: 'M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6M12 14v7',
}
const icon = (name) =>
  vnode(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 16,
      height: 16,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    [vnode('path', { d: paths[name] })],
  )

// Share Runhive's authenticated client and reactive account store; credentials never enter the iframe URL.
export function createCenter(entryModule = 'tune') {
  if (!Object.hasOwn(MODULES, entryModule)) throw new Error('功能入口无效。')
  return defineComponent({
    name: entryModule === 'agent' ? 'RunhiveAgentCenter' : 'RunhiveLlmCenter',
    data() {
      return {
        account: useAdminInfo(),
        module: entryModule,
        section: MODULES[entryModule].items[0].key,
        frameUrl: '',
        frameKey: 0,
        adminId: 0,
        frameModule: '',
        authenticated: false,
        connecting: false,
        loading: true,
        error: '',
        active: false,
        generation: 0,
        timeout: null,
        messageListener: null,
        storageListener: null,
        frameEntry: null,
        resizeObserver: null,
        resizeListener: null,
        sidebarCollapsed: false,
        navCollapsed: false,
        workspaceOpen: true,
        workspaceSearch: false,
        workspaceQuery: '',
        workspaceGroups: [],
        workspaceClosedGroups: [],
        workspaceLoading: false,
        workspaceError: '',
        workspaceRequest: 0,
        workspaceAbort: null,
        resourceDialog: null,
        workspaceReturnFocus: null,
        workspaceKeyListener: null,
        assistantGuide: null,
        nativeAssistant: null,
        workspaceArchived: false,
        resourceBusy: false,
        resourceNotice: '',
      }
    },
    computed: {
      // Token changes invalidate even an iframe belonging to the same numerical account.
      accountIdentity() {
        return `${this.account.id || 0}:${this.account.token || ''}`
      },
      currentSection() {
        return sectionInfo(this.module, this.section)
      },
      centerTitle() {
        return entryModule === 'agent' ? 'Agent中心' : '大模型中心'
      },
      resourceGroups() {
        return filterWorkspace(
          this.workspaceGroups.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.archived === this.workspaceArchived),
          })),
          this.workspaceQuery,
        )
      },
    },
    watch: {
      accountIdentity: {
        flush: 'sync',
        handler() {
          this.assistantGuide = null
          this.clearFrame()
          if (this.active && this.account.id && this.account.token) this.launch()
          else if (this.active) {
            this.loading = false
            this.error = '登录状态已更新，请登录后重新连接。'
          }
        },
      },
    },
    mounted() {
      this.storageListener = (event) => {
        if (event.key !== 'adminInfo' && event.key !== null) return
        try {
          const stored = JSON.parse(localStorage.getItem('adminInfo') || 'null')
          if (
            Number(stored?.id || 0) === Number(this.account.id || 0) &&
            String(stored?.token || '') === String(this.account.token || '')
          )
            return
        } catch (_) {}
        this.clearFrame()
        this.loading = false
        this.error = '登录状态已在其他页面更新，请刷新后重新连接。'
      }
      window.addEventListener('storage', this.storageListener)
      this.resizeListener = () => this.positionFrame()
      window.addEventListener('resize', this.resizeListener)
      window.addEventListener('scroll', this.resizeListener, true)
      this.workspaceKeyListener = (event) => this.resourceKeydown(event)
      window.addEventListener('keydown', this.workspaceKeyListener)
      this.active = true
      if (entryModule === 'tune') this.nativeAssistant = attachNativeCenter(this)
      this.resume()
    },
    activated() {
      if (!this.active) {
        this.active = true
        this.resume()
      }
    },
    deactivated() {
      this.parkFrame()
    },
    beforeUnmount() {
      this.nativeAssistant?.close()
      this.parkFrame()
      window.removeEventListener('resize', this.resizeListener)
      window.removeEventListener('scroll', this.resizeListener, true)
      window.removeEventListener('storage', this.storageListener)
      window.removeEventListener('keydown', this.workspaceKeyListener)
    },
    methods: {
      ...workspaceMethods,
      clearWorkspace() {
        this.closeResourceMenu()
        this.workspaceArchived = false
        this.resourceNotice = ''
        this.workspaceAbort?.abort()
        this.workspaceAbort = null
        this.workspaceRequest += 1
        this.workspaceGroups = []
        this.workspaceQuery = ''
        this.workspaceSearch = false
        this.workspaceLoading = false
        this.workspaceError = ''
        this.workspaceClosedGroups = []
        this.closeResource()
      },
      async refreshWorkspace() {
        if (
          entryModule !== 'tune' ||
          !this.active ||
          !this.authenticated ||
          !this.account.id ||
          !this.account.token
        )
          return
        this.workspaceAbort?.abort()
        const controller = new AbortController(),
          request = ++this.workspaceRequest,
          win = window
        const identity = this.accountIdentity,
          generation = this.generation,
          adminId = Number(this.account.id)
        this.workspaceAbort = controller
        this.workspaceLoading = true
        this.workspaceError = ''
        const timeout = win.setTimeout(() => controller.abort(), 20000)
        try {
          const response = await fetch('/llm-center/tune/ui/api/workspace', {
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
          })
          if (!response.ok) throw new Error('workspace')
          const groups = validateWorkspace(await response.json(), adminId)
          if (
            !this.active ||
            request !== this.workspaceRequest ||
            identity !== this.accountIdentity ||
            generation !== this.generation
          )
            return
          this.workspaceGroups = groups
        } catch (_) {
          if (
            this.active &&
            request === this.workspaceRequest &&
            identity === this.accountIdentity &&
            generation === this.generation
          ) {
            this.workspaceGroups = []
            this.workspaceError = '工作区数据暂不可用，请重新刷新。'
          }
        } finally {
          win.clearTimeout(timeout)
          if (request === this.workspaceRequest) {
            this.workspaceAbort = null
            this.workspaceLoading = false
          }
        }
      },
      toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed
        this.$nextTick(() => this.positionFrame())
      },
      toggleResourceGroup(key) {
        this.workspaceClosedGroups = this.workspaceClosedGroups.includes(key)
          ? this.workspaceClosedGroups.filter((item) => item !== key)
          : [...this.workspaceClosedGroups, key]
      },
      toggleWorkspaceSearch() {
        this.workspaceSearch = !this.workspaceSearch
        if (!this.workspaceSearch) this.workspaceQuery = ''
        else this.$nextTick(() => this.$refs.workspaceSearch?.focus())
      },
      openResource(group, item) {
        this.closeResourceMenu()
        this.workspaceReturnFocus = document.activeElement
        this.resourceDialog = { group, item }
        this.$nextTick(() => this.$refs.resourceDialog?.focus({ preventScroll: true }))
      },
      closeResource() {
        if (!this.resourceDialog) return
        this.resourceDialog = null
        const focus = this.workspaceReturnFocus
        this.workspaceReturnFocus = null
        if (focus?.isConnected) focus.focus({ preventScroll: true })
      },
      resourceKeydown(event) {
        if (!this.resourceDialog) return
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!this.resourceBusy) this.closeResource()
          return
        }
        if (event.key !== 'Tab') return
        const dialog = this.$refs.resourceDialog
        const nodes = [...(dialog?.querySelectorAll('button,a[href],[tabindex]') || [])].filter(
          (node) => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length,
        )
        const first = nodes[0],
          last = nodes[nodes.length - 1]
        if (!first) {
          event.preventDefault()
          dialog?.focus()
          return
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || !dialog.contains(document.activeElement))
        ) {
          event.preventDefault()
          last.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !dialog.contains(document.activeElement))
        ) {
          event.preventDefault()
          first.focus()
        }
      },
      resourceSize(size) {
        return size < 1024
          ? `${size} B`
          : size < 1024 ** 2
            ? `${(size / 1024).toFixed(1)} KB`
            : `${(size / 1024 ** 2).toFixed(1)} MB`
      },
      resourceTime(value) {
        return new Date(value * 1000).toLocaleString('zh-CN', { hour12: false })
      },
      renderTuneSidebar() {
        const action = (name, label, onClick, extra = {}) =>
          vnode(
            'button',
            {
              type: 'button',
              class: 'rh-workspace-control',
              'aria-label': label,
              title: label,
              onClick,
              ...extra,
            },
            [icon(name)],
          )
        const navItem = (item) =>
          vnode(
            'button',
            {
              type: 'button',
              class: ['rh-llm-nav-item', { active: this.section === item.key }],
              title: this.sidebarCollapsed ? item.label : undefined,
              'aria-label': item.label,
              'aria-current': this.section === item.key ? 'page' : undefined,
              onClick: () => this.selectSection('tune', item.key),
            },
            [icon(item.icon), this.sidebarCollapsed ? null : vnode('span', null, item.label)],
          )
        return vnode(
          'aside',
          {
            class: ['rh-llm-sidebar rh-tune-sidebar', { 'is-collapsed': this.sidebarCollapsed }],
            'aria-label': '大模型中心导航',
          },
          [
            vnode('div', { class: 'rh-workspace-switcher' }, [
              action('collapse', this.sidebarCollapsed ? '展开侧栏' : '收起侧栏', this.toggleSidebar, {
                'aria-expanded': !this.sidebarCollapsed,
              }),
              this.sidebarCollapsed
                ? null
                : vnode(
                    'button',
                    {
                      type: 'button',
                      class: 'rh-workspace-name',
                      'aria-expanded': this.workspaceOpen,
                      'aria-controls': 'rh-tune-workspace-resources',
                      onClick: () => {
                        this.workspaceOpen = !this.workspaceOpen
                      },
                    },
                    [
                      vnode('span', null, '默认工作区'),
                      vnode('span', { class: ['rh-workspace-chevron', { open: this.workspaceOpen }] }, [
                        icon('chevron'),
                      ]),
                    ],
                  ),
            ]),
            vnode('div', { class: 'rh-tune-sidebar-scroll' }, [
              vnode('nav', { 'aria-label': '大模型微调' }, [
                ...(this.sidebarCollapsed || !this.navCollapsed ? MODULES.tune.items.map(navItem) : []),
                this.sidebarCollapsed
                  ? null
                  : vnode(
                      'button',
                      {
                        type: 'button',
                        class: 'rh-workspace-nav-fold',
                        'aria-expanded': !this.navCollapsed,
                        'aria-label': this.navCollapsed ? '展开功能导航' : '收起功能导航',
                        onClick: () => {
                          this.navCollapsed = !this.navCollapsed
                        },
                      },
                      [
                        vnode(
                          'span',
                          { class: ['rh-workspace-chevron', { 'fold-open': !this.navCollapsed }] },
                          [icon('chevron')],
                        ),
                      ],
                    ),
              ]),
              this.sidebarCollapsed
                ? null
                : vnode(
                    'section',
                    {
                      id: 'rh-tune-workspace-resources',
                      class: 'rh-workspace-resources',
                      hidden: !this.workspaceOpen,
                      'aria-label': '工作区资源',
                    },
                    [
                      vnode('div', { class: 'rh-workspace-list-header' }, [
                        this.workspaceSearch
                          ? vnode('input', {
                              ref: 'workspaceSearch',
                              class: 'rh-workspace-search',
                              type: 'search',
                              value: this.workspaceQuery,
                              placeholder: '搜索工作区',
                              'aria-label': '搜索工作区资源',
                              maxlength: 100,
                              onInput: (event) => {
                                this.workspaceQuery = event.target.value
                              },
                              onKeydown: (event) => {
                                if (event.key === 'Escape') {
                                  event.stopPropagation()
                                  this.toggleWorkspaceSearch()
                                }
                              },
                            })
                          : vnode('span', null, this.workspaceArchived ? '归档' : '工作区'),
                        action(
                          this.workspaceSearch ? 'close' : 'search',
                          this.workspaceSearch ? '关闭搜索' : '搜索工作区',
                          this.toggleWorkspaceSearch,
                          { 'aria-pressed': this.workspaceSearch },
                        ),
                        action('refresh', '刷新工作区', this.refreshWorkspace, {
                          disabled: this.workspaceLoading,
                        }),
                        vnode(
                          'button',
                          {
                            type: 'button',
                            class: 'rh-workspace-control',
                            'aria-label': '工作区更多操作',
                            title: '更多操作',
                            onClick: this.openWorkspaceOptions,
                          },
                          '⋯',
                        ),
                      ]),
                      this.workspaceLoading && !this.workspaceGroups.length
                        ? vnode('p', { class: 'rh-workspace-note', role: 'status' }, '正在加载工作区…')
                        : null,
                      this.workspaceError
                        ? vnode(
                            'p',
                            { class: 'rh-workspace-note rh-workspace-error', role: 'alert' },
                            this.workspaceError,
                          )
                        : null,
                      this.resourceNotice
                        ? vnode('p', { class: 'rh-workspace-note', role: 'status' }, this.resourceNotice)
                        : null,
                      ...this.resourceGroups.map((group) => {
                        const expanded =
                          Boolean(this.workspaceQuery.trim()) ||
                          !this.workspaceClosedGroups.includes(group.key)
                        return vnode('div', { class: 'rh-workspace-group', key: group.key }, [
                          vnode('div', { class: 'rh-workspace-group-header' }, [
                            vnode(
                              'button',
                              {
                                type: 'button',
                                class: 'rh-workspace-group-toggle',
                                'aria-expanded': expanded,
                                'aria-controls': `rh-tune-resources-${group.key}`,
                                onClick: () => this.toggleResourceGroup(group.key),
                              },
                              [
                                icon('folder'),
                                vnode('span', { class: 'rh-workspace-group-label' }, group.label),
                                vnode('span', { class: 'rh-workspace-count' }, String(group.items.length)),
                                vnode('span', { class: ['rh-workspace-chevron', { open: expanded }] }, [
                                  icon('chevron'),
                                ]),
                              ],
                            ),
                            this.workspaceArchived
                              ? null
                              : action('plus', group.action, () => this.selectSection('tune', group.key)),
                          ]),
                          expanded
                            ? vnode(
                                'div',
                                { id: `rh-tune-resources-${group.key}`, class: 'rh-workspace-items' },
                                [
                                  ...group.items.map((item) =>
                                    vnode(
                                      'div',
                                      { class: 'rh-workspace-resource-row', key: `${item.kind}:${item.id}` },
                                      [
                                        vnode(
                                          'button',
                                          {
                                            type: 'button',
                                            class: 'rh-workspace-resource',
                                            title: item.label,
                                            onClick: () => this.resourceAction(group, item, 'detail'),
                                          },
                                          [
                                            icon(
                                              item.kind === 'dataset'
                                                ? 'database'
                                                : item.kind === 'export'
                                                  ? 'box'
                                                  : group.icon,
                                            ),
                                            vnode(
                                              'span',
                                              { class: 'rh-workspace-resource-name' },
                                              item.label,
                                            ),
                                            item.pinned
                                              ? vnode(
                                                  'span',
                                                  { class: 'rh-resource-pin', 'aria-label': '已置顶' },
                                                  [icon('pin')],
                                                )
                                              : null,
                                            item.kind === 'job'
                                              ? vnode(
                                                  'span',
                                                  { class: ['rh-workspace-status', `status-${item.status}`] },
                                                  taskStatus(item.status),
                                                )
                                              : null,
                                          ],
                                        ),
                                        vnode(
                                          'button',
                                          {
                                            type: 'button',
                                            class: 'rh-workspace-more',
                                            'aria-label': `${item.label} 更多操作`,
                                            title: '更多操作',
                                            disabled: this.resourceBusy,
                                            onClick: (event) => this.openResourceMenu(group, item, event),
                                          },
                                          '⋯',
                                        ),
                                      ],
                                    ),
                                  ),
                                  group.items.length
                                    ? null
                                    : vnode(
                                        'p',
                                        { class: 'rh-workspace-empty' },
                                        this.workspaceQuery.trim()
                                          ? '无匹配结果'
                                          : group.key === 'data'
                                            ? '暂无数据集'
                                            : group.key === 'export'
                                              ? '暂无导出成果'
                                              : '暂无任务',
                                      ),
                                ],
                              )
                            : null,
                        ])
                      }),
                    ],
                  ),
            ]),
          ],
        )
      },
      renderResourceDialog() {
        if (!this.resourceDialog) return null
        const dialog = this.resourceDialog,
          { group, item, mode } = dialog
        const button = (label, handler, primary = false, disabled = false) =>
          vnode(
            'button',
            { type: 'button', class: ['rh-resource-button', { primary }], onClick: handler, disabled },
            label,
          )
        const body = []
        if (mode === 'rename')
          body.push(
            vnode('label', { class: 'rh-resource-label' }, [
              '名称',
              vnode('input', {
                value: dialog.label,
                maxlength: 100,
                disabled: this.resourceBusy,
                onInput: (event) => {
                  dialog.label = event.target.value
                },
                onKeydown: (event) => {
                  if (event.key === 'Enter') this.submitResourceDialog()
                },
              }),
            ]),
          )
        else if (mode === 'delete' || mode === 'cancel')
          body.push(
            vnode(
              'p',
              { class: 'rh-resource-description' },
              mode === 'cancel'
                ? '确认取消此任务？已生成的数据和检查点会保留。'
                : item.kind === 'job'
                  ? '确认删除此任务记录？输出成果会保留。'
                  : '确认删除此资源？删除后将无法用于新的任务。',
            ),
          )
        else if (dialog.loading) body.push(vnode('p', { role: 'status' }, '正在加载…'))
        else if (mode === 'preview' && dialog.data)
          body.push(vnode('pre', { class: 'rh-resource-code' }, JSON.stringify(dialog.data.rows, null, 2)))
        else if (dialog.data) {
          body.push(
            vnode(
              'p',
              { class: 'rh-resource-description' },
              item.kind === 'job' ? taskStatus(item.status) : this.resourceSize(item.size_bytes),
            ),
          )
          if (mode === 'log')
            body.push(vnode('pre', { class: 'rh-resource-code' }, dialog.data.log || '暂无日志。'))
          else if (dialog.data.args)
            body.push(vnode('pre', { class: 'rh-resource-code' }, JSON.stringify(dialog.data.args, null, 2)))
          if (dialog.data.missing_datasets?.length)
            body.push(vnode('p', { class: 'rh-workspace-error' }, '部分关联数据集已删除。'))
        }
        if (dialog.error) body.push(vnode('p', { role: 'alert', class: 'rh-workspace-error' }, dialog.error))
        const footer = [button('关闭', this.closeResource, false, this.resourceBusy)]
        if (['rename', 'delete', 'cancel'].includes(mode))
          footer.push(
            button(
              this.resourceBusy
                ? '正在提交…'
                : mode === 'rename'
                  ? '保存'
                  : mode === 'delete'
                    ? '确认删除'
                    : '确认取消',
              this.submitResourceDialog,
              true,
              this.resourceBusy,
            ),
          )
        else if (mode === 'preview' && dialog.data) {
          footer.unshift(
            button(
              '上一页',
              () => this.loadResourceDetail(dialog.page - 1),
              false,
              dialog.loading || dialog.page === 0,
            ),
          )
          footer.unshift(vnode('span', { class: 'rh-resource-page' }, `第 ${dialog.page + 1} 页`))
          footer.unshift(
            button(
              '下一页',
              () => this.loadResourceDetail(dialog.page + 1),
              false,
              dialog.loading || !dialog.data.has_next,
            ),
          )
        } else if (mode === 'log')
          footer.unshift(button('刷新日志', () => this.loadResourceDetail(), false, dialog.loading))
        return vnode(
          'div',
          {
            class: 'rh-resource-backdrop',
            onClick: (event) => {
              if (event.target === event.currentTarget && !this.resourceBusy) this.closeResource()
            },
          },
          [
            vnode(
              'section',
              {
                class: 'rh-resource-dialog',
                ref: 'resourceDialog',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'rh-resource-dialog-title',
                tabindex: -1,
              },
              [
                vnode('header', null, [
                  vnode('h2', { id: 'rh-resource-dialog-title' }, item.label),
                  button('×', this.closeResource, false, this.resourceBusy),
                ]),
                ...body,
                vnode('footer', null, footer),
              ],
            ),
          ],
        )
      },
      clearTimeout() {
        if (this.timeout) window.clearTimeout(this.timeout)
        this.timeout = null
      },
      clearFrame() {
        this.clearWorkspace()
        frames.destroy(this.frameEntry)
        this.frameEntry = null
        this.generation += 1
        this.clearTimeout()
        this.frameUrl = ''
        this.adminId = 0
        this.frameModule = ''
        this.authenticated = false
        this.connecting = false
      },
      parkFrame() {
        this.closeResourceMenu()
        this.workspaceAbort?.abort()
        this.workspaceAbort = null
        this.workspaceRequest += 1
        this.workspaceLoading = false
        this.closeResource()
        this.active = false
        this.generation += 1
        this.clearTimeout()
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        frames.park(this.frameEntry, this)
        this.frameEntry = null
        this.frameUrl = ''
      },
      positionFrame() {
        frames.position(this.frameEntry, this)
      },
      observeFrame() {
        this.$nextTick(() => {
          this.resizeObserver?.disconnect()
          if (typeof ResizeObserver !== 'undefined' && this.$refs.frameShell) {
            this.resizeObserver = new ResizeObserver(() => this.positionFrame())
            this.resizeObserver.observe(this.$refs.frameShell)
          }
          this.positionFrame()
        })
      },
      async resume() {
        const cached = frames.peek(this.account, this.module)
        if (!cached) return this.launch()
        this.loading = true
        this.error = ''
        this.connecting = true
        const generation = ++this.generation
        try {
          // Recheck the current parent login and module permission before showing any retained view.
          const response = await fetch(`/llm-center/${this.module}/auth/ready`, {
            credentials: 'same-origin',
            cache: 'no-store',
          })
          const data = await response.json()
          if (!this.active || this.generation !== generation) return
          if (
            !response.ok ||
            !data.ready ||
            data.module !== this.module ||
            Number(data.admin_id) !== Number(this.account.id) ||
            !frames.attach(cached, this)
          ) {
            frames.destroy(cached)
            return this.launch()
          }
          this.frameEntry = cached
          this.frameUrl = cached.frame.src
          this.frameModule = this.module
          this.adminId = data.admin_id
          this.authenticated = cached.authenticated
          this.section = cached.section
          this.loading = !cached.ready
          this.connecting = false
          this.observeFrame()
          this.refreshWorkspace()
          if (!cached.ready) {
            this.armTimeout()
            this.sendSection()
          }
        } catch (_) {
          if (this.active && this.generation === generation) {
            frames.destroy(cached)
            return this.launch()
          }
        }
      },
      armTimeout() {
        this.clearTimeout()
        const generation = this.generation,
          module = this.module,
          section = this.section
        this.timeout = window.setTimeout(() => {
          if (
            !this.active ||
            this.generation !== generation ||
            this.module !== module ||
            this.section !== section
          )
            return
          this.loading = false
          this.error = '工作区加载时间较长，请稍后重新连接。'
          this.positionFrame()
        }, 120000)
      },
      selectSection(module, section) {
        if (module !== entryModule) return
        sectionInfo(module, section)
        if (this.module === module && this.section === section && this.frameUrl && !this.error) return
        const changedModule = this.module !== module
        this.module = module
        this.section = section
        this.error = ''
        this.loading = true
        this.positionFrame()
        if (changedModule || (!this.frameUrl && !this.connecting)) this.launch()
        else {
          this.armTimeout()
          this.sendSection()
        }
      },
      sendSection() {
        const frame = this.frameEntry?.frame.contentWindow
        if (!frame || !this.authenticated || this.frameModule !== this.module) return
        frame.postMessage(
          {
            source: 'runhive-llm-shell',
            type: 'llm-section-change',
            admin_id: this.adminId,
            module: this.module,
            section: this.section,
          },
          window.location.origin,
        )
      },
      async launch() {
        this.clearFrame()
        this.loading = true
        this.error = ''
        this.connecting = true
        const generation = this.generation,
          module = this.module,
          section = this.section
        try {
          const result = await createAxios(
            { url: '/admin/Llmcenter/launch', method: 'post', data: { module, section } },
            { showSuccessMessage: false, cancelDuplicateRequest: false },
          )
          if (!this.active || this.generation !== generation || this.module !== module) return
          const launch = validateLaunch(result.data, window.location.origin, module, section)
          if (launch.adminId !== Number(this.account.id) || !this.account.token)
            throw new Error('登录状态已更新，请重新连接。')
          this.adminId = launch.adminId
          this.frameModule = module
          this.frameKey += 1
          this.frameUrl = launch.url
          this.frameEntry = frames.create(this.account, module, launch.adminId, launch.url, this)
          this.observeFrame()
          this.armTimeout()
        } catch (error) {
          if (this.active && this.generation === generation) {
            this.loading = false
            this.error = chineseError(error)
            this.positionFrame()
          }
        } finally {
          if (this.generation === generation) this.connecting = false
        }
      },
      receiveMessage(event) {
        if (
          !this.active ||
          this.module !== this.frameModule ||
          !isWorkspaceMessage(
            event,
            this.frameEntry?.frame.contentWindow,
            window.location.origin,
            this.adminId,
            this.frameModule,
          )
        )
          return
        const data = event.data
        if (data.type === 'llm-resource-success') {
          this.resourceNotice = '配置已载入，请确认参数后开始任务。'
          return
        }
        if (data.type === 'llm-resource-failed') {
          this.workspaceError = '配置载入未完成，请重新操作。'
          return
        }
        if (data.type === 'llm-resource-menu') {
          const rect = data.rect,
            frame = this.frameEntry.frame.getBoundingClientRect()
          if (
            data.kind !== 'job' ||
            typeof data.resource !== 'string' ||
            !rect ||
            !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(rect[k])) ||
            rect.x < 0 ||
            rect.y < 0 ||
            rect.x > frame.width ||
            rect.y > frame.height
          )
            return
          const generation = this.generation,
            identity = this.accountIdentity,
            entry = this.frameEntry
          const open = () => {
            if (
              !this.active ||
              this.generation !== generation ||
              this.accountIdentity !== identity ||
              this.frameEntry !== entry
            )
              return
            const group = this.workspaceGroups.find((g) =>
                g.items.some((i) => i.kind === 'job' && i.id === data.resource),
              ),
              item = group?.items.find((i) => i.kind === 'job' && i.id === data.resource)
            if (group && item)
              showWorkspaceMenu(
                this,
                { x: frame.x + rect.x, y: frame.y + rect.y, width: rect.width, height: rect.height },
                resourceActions(item),
                (action) => this.resourceAction(group, item, action),
              )
          }
          if (
            this.workspaceGroups.some((g) => g.items.some((i) => i.kind === 'job' && i.id === data.resource))
          )
            open()
          else this.refreshWorkspace().then(open)
          return
        }
        if (data.type === 'llm-center-auth-ready') {
          this.authenticated = true
          this.sendSection()
          this.refreshWorkspace()
        } else if (data.type === 'llm-section-ready') {
          if (!MODULES[this.module].items.some((item) => item.key === data.section)) return
          if (data.section !== this.section && this.loading) {
            this.sendSection()
            return
          }
          // Follow native drilldowns after initial loading; preserve the current iframe/session.
          this.section = data.section
          this.clearTimeout()
          this.loading = false
          this.error = ''
          this.positionFrame()
          if (!this.workspaceLoading) this.refreshWorkspace()
        } else if (
          data.type === 'llm-center-auth-error' ||
          (data.type === 'llm-section-error' && data.section === this.section)
        ) {
          this.clearTimeout()
          this.loading = false
          this.error = chineseError({ message: data.message })
          this.positionFrame()
        }
      },
    },
    render() {
      const Button = resolveComponent('ElButton')
      return vnode(
        'main',
        {
          class: [
            'rh-llm-center',
            {
              'rh-agent-native-layout': entryModule === 'agent',
              'rh-tune-sidebar-layout': entryModule === 'tune',
            },
          ],
        },
        [
          entryModule === 'agent' ? null : this.renderTuneSidebar(),
          vnode('section', { class: 'rh-llm-content' }, [
            entryModule === 'agent'
              ? null
              : vnode('header', { class: 'rh-llm-header' }, [
                  vnode('div', null, [
                    vnode('h1', null, this.currentSection.label),
                    vnode('p', null, this.currentSection.description),
                  ]),
                  vnode(
                    Button,
                    { size: 'small', plain: true, loading: this.connecting, onClick: this.launch },
                    { default: () => '重新连接' },
                  ),
                ]),
            entryModule === 'tune' && this.assistantGuide
              ? vnode(
                  'div',
                  { class: 'rh-assistant-native-guide', role: 'region', 'aria-label': '平台助手引导' },
                  [
                    vnode(
                      'strong',
                      null,
                      this.assistantGuide.view === 'data' ? '导入训练数据' : '微调参数核对',
                    ),
                    vnode('span', null, this.assistantGuide.notice),
                    this.assistantGuide.restoreToken
                      ? vnode(
                          'button',
                          {
                            onClick: () =>
                              this.nativeAssistant.restore().catch((e) => (this.workspaceError = e.message)),
                          },
                          '恢复回填前的参数',
                        )
                      : vnode(
                          'button',
                          { onClick: () => this.nativeAssistant.returnToAssistant() },
                          '已导入，返回助手继续',
                        ),
                    vnode(
                      'button',
                      {
                        onClick: () => {
                          this.assistantGuide = null
                          this.$nextTick(() => this.positionFrame())
                        },
                      },
                      '暂停引导',
                    ),
                  ],
                )
              : null,
            vnode('div', { class: 'rh-llm-frame-shell', ref: 'frameShell' }, [
              this.loading && !this.error
                ? vnode('div', { class: 'rh-llm-status', role: 'status' }, [
                    vnode('span', { class: 'runos-spinner', 'aria-hidden': 'true' }),
                    vnode('p', null, `正在加载${this.centerTitle}工作区…`),
                  ])
                : null,
              this.error
                ? vnode('div', { class: 'rh-llm-status rh-llm-error', role: 'alert' }, [
                    vnode('p', null, this.error),
                    vnode(
                      Button,
                      { type: 'primary', size: 'small', onClick: this.launch },
                      { default: () => '重新连接' },
                    ),
                  ])
                : null,
            ]),
          ]),
          entryModule === 'tune' ? this.renderResourceDialog() : null,
        ],
      )
    },
  })
}

export default createCenter('tune')
