import { resourceActions, showWorkspaceMenu, closeWorkspaceMenu } from './workspace-menu.js'
export const workspaceMethods = {
  closeResourceMenu() {
    closeWorkspaceMenu(this)
  },
  openResourceMenu(group, item, event) {
    if (this.resourceBusy) return
    const button = event.currentTarget
    showWorkspaceMenu(
      this,
      button.getBoundingClientRect(),
      resourceActions(item),
      (action) => this.resourceAction(group, item, action),
      button,
    )
  },
  openWorkspaceOptions(event) {
    const button = event.currentTarget
    showWorkspaceMenu(
      this,
      button.getBoundingClientRect(),
      [{ action: 'archives', label: this.workspaceArchived ? '返回工作区' : '查看归档', icon: 'archive' }],
      () => {
        this.workspaceArchived = !this.workspaceArchived
        this.workspaceQuery = ''
        this.refreshWorkspace()
      },
      button,
    )
  },
  async workspaceRequestApi(path, body) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 50000)
    const identity = this.accountIdentity,
      generation = this.generation
    try {
      const response = await fetch('/llm-center/tune/ui/api/workspace' + path, {
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        ...(body
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Runhive-Workspace': '1' },
              body: JSON.stringify(body),
            }
          : {}),
      })
      const data = await response.json()
      if (identity !== this.accountIdentity || generation !== this.generation || !this.active)
        throw Error('登录状态已更新，请重新连接。')
      if (!response.ok)
        throw Error(
          typeof data.detail === 'string' && data.detail.length <= 160 && /[\u3400-\u9fff]/u.test(data.detail)
            ? data.detail
            : '资源操作暂未完成，请稍后重试。',
        )
      return data
    } catch (error) {
      if (error.name === 'AbortError') throw Error('服务响应超时，请稍后重试。')
      throw error
    } finally {
      clearTimeout(timer)
    }
  },
  async resourceAction(group, item, action) {
    if (this.resourceBusy) return
    this.resourceNotice = ''
    if (action === 'rename' || action === 'delete' || action === 'cancel') {
      this.openResource(group, item)
      this.resourceDialog = { group, item, mode: action, label: item.label }
      return
    }
    if (action === 'detail' || action === 'log') {
      this.openResource(group, item)
      this.resourceDialog = {
        group,
        item,
        mode: item.kind === 'dataset' ? 'preview' : action,
        page: 0,
        loading: true,
      }
      return this.loadResourceDetail()
    }
    if (action === 'download') {
      const link = document.createElement('a')
      link.href = item.download
      link.download = ''
      document.body.append(link)
      link.click()
      link.remove()
      return
    }
    this.resourceBusy = true
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(item.id)
        this.resourceNotice = '任务 ID 已复制。'
        return
      }
      if (['reuse', 'train', 'eval'].includes(action)) {
        const data = await this.workspaceRequestApi('/prepare', { kind: item.kind, id: item.id, action })
        if (!['train', 'eval', 'export'].includes(data.section) || !/^[a-f0-9]{48}$/.test(data.token))
          throw Error('配置载入未完成，请重新操作。')
        this.selectSection('tune', data.section)
        this.frameEntry?.frame.contentWindow.postMessage(
          {
            source: 'runhive-llm-shell',
            type: 'llm-resource-apply',
            module: 'tune',
            admin_id: this.adminId,
            token: data.token,
          },
          location.origin,
        )
        this.resourceNotice = '正在载入配置…'
        return
      }
      const result = await this.workspaceRequestApi('/action', {
        kind: item.kind,
        id: item.id,
        revision: item.revision,
        action,
      })
      if (!result.success) throw Error('资源操作暂未完成，请稍后重试。')
      this.resourceNotice = result.cleanup_pending ? '资源已删除，文件清理暂未完成。' : '操作已完成。'
      await this.refreshWorkspace()
      this.refreshTaskPanel()
    } catch (error) {
      this.workspaceError = /[\u3400-\u9fff]/u.test(error.message)
        ? error.message
        : '资源操作暂未完成，请稍后重试。'
    } finally {
      this.resourceBusy = false
    }
  },
  refreshTaskPanel() {
    this.frameEntry?.frame.contentWindow.postMessage(
      { source: 'runhive-llm-shell', type: 'llm-resource-refresh', module: 'tune', admin_id: this.adminId },
      location.origin,
    )
  },
  async submitResourceDialog() {
    const dialog = this.resourceDialog
    if (!dialog || this.resourceBusy) return
    this.resourceBusy = true
    dialog.error = ''
    try {
      const result = await this.workspaceRequestApi('/action', {
        kind: dialog.item.kind,
        id: dialog.item.id,
        revision: dialog.item.revision,
        action: dialog.mode,
        ...(dialog.mode === 'rename' ? { label: dialog.label } : {}),
      })
      if (!result.success) throw Error('资源操作暂未完成，请稍后重试。')
      this.closeResource()
      this.resourceNotice = result.cleanup_pending ? '资源已删除，文件清理暂未完成。' : '操作已完成。'
      await this.refreshWorkspace()
      this.refreshTaskPanel()
    } catch (error) {
      if (this.resourceDialog === dialog) dialog.error = error.message
    } finally {
      this.resourceBusy = false
    }
  },
  async loadResourceDetail(page = 0) {
    const dialog = this.resourceDialog
    if (!dialog) return
    dialog.loading = true
    dialog.error = ''
    try {
      const result = await this.workspaceRequestApi(
        dialog.mode === 'preview'
          ? '/preview?' + new URLSearchParams({ resource: dialog.item.id, page })
          : '/detail?' + new URLSearchParams({ kind: dialog.item.kind, resource: dialog.item.id }),
      )
      if (this.resourceDialog !== dialog) return
      dialog.data = result
      dialog.page = page
    } catch (error) {
      if (this.resourceDialog === dialog) dialog.error = error.message
    } finally {
      if (this.resourceDialog === dialog) dialog.loading = false
    }
  },
}
