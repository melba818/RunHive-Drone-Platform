// In-page bridge. The business page owns its authenticated iframe and controls.
export function attachNativeCenter(owner) {
  const channel = crypto.randomUUID().replaceAll('-', '')
  let busy = false,
    closed = false
  const reply = (type, data = {}) =>
    window.dispatchEvent(
      new CustomEvent('runhive-native-response', {
        detail: {
          source: 'runhive-native-page',
          kind: 'tune',
          type,
          channel,
          admin_id: Number(owner.account.id),
          ...data,
        },
      }),
    )
  const valid = (d) =>
    owner.active &&
    owner.account.token &&
    d?.source === 'runhive-platform-assistant' &&
    d.admin_id === Number(owner.account.id)
  const wait = async (test, message) => {
    const start = Date.now()
    while (Date.now() - start < 60000) {
      if (closed || !owner.active) throw Error('页面已切换，请重新打开。')
      if (test()) return
      await new Promise((r) => setTimeout(r, 150))
    }
    throw Error(message)
  }
  const apply = async (token) => {
    const frame = owner.frameEntry?.frame
    if (!frame) throw Error('微调页面尚未连接。')
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', receive)
        reject(Error('参数回填未完成，请重新连接后重试。'))
      }, 30000)
      const receive = (e) => {
        if (
          e.source !== frame.contentWindow ||
          e.origin !== location.origin ||
          e.data?.module !== 'tune' ||
          e.data.admin_id !== Number(owner.account.id) ||
          e.data.token !== token
        )
          return
        if (!['llm-resource-success', 'llm-resource-failed'].includes(e.data.type)) return
        clearTimeout(timer)
        window.removeEventListener('message', receive)
        e.data.type === 'llm-resource-success'
          ? resolve()
          : reject(Error('参数回填未通过，请检查数据集和模型。'))
      }
      window.addEventListener('message', receive)
      frame.contentWindow.postMessage(
        {
          source: 'runhive-llm-shell',
          type: 'llm-resource-apply',
          module: 'tune',
          admin_id: Number(owner.account.id),
          token,
        },
        location.origin,
      )
    })
  }
  const listen = async (event) => {
    const d = event.detail
    if (!valid(d)) return
    if (d.type === 'native-ping') {
      reply('native-ready')
      return
    }
    if (
      d.type !== 'native-nav' ||
      d.channel !== channel ||
      !/^[a-f0-9]{32}$/.test(d.request_id || '') ||
      !['train', 'data', 'eval', 'export'].includes(d.view) ||
      (d.draft_id && !/^[a-f0-9]{32}$/.test(d.draft_id))
    )
      return
    if (busy) {
      reply('native-navigation-error', { request_id: d.request_id, message: '页面正在载入参数，请稍候。' })
      return
    }
    busy = true
    const identity = owner.accountIdentity
    try {
      owner.selectSection('tune', d.view)
      await wait(() => {
        if (owner.authenticated && owner.section !== d.view) owner.selectSection('tune', d.view)
        return owner.authenticated && !owner.loading && owner.section === d.view
      }, '大模型中心加载超时，请重新连接。')
      if (identity !== owner.accountIdentity) throw Error('登录状态已更新。')
      let restoration = ''
      if (d.draft_id) {
        const result = await owner.workspaceRequestApi('/prepare', {
          kind: 'configuration',
          action: d.view,
          id: d.draft_id,
        })
        if (result.section !== d.view || !/^[a-f0-9]{48}$/.test(result.token))
          throw Error('参数回填结果无效。')
        await apply(result.token)
        restoration = result.restore_token
      }
      if (identity !== owner.accountIdentity || closed || !owner.active) throw Error('登录状态或页面已更新。')
      owner.assistantGuide = {
        view: d.view,
        draftId: d.draft_id || '',
        restoreToken: restoration,
        notice: d.draft_id
          ? '参数已填入。请核对基础模型、数据集及高级配置，再点击原页面的“开始任务”。'
          : '可上传数据集文件，也可填写数据记录。导入完成后返回助手继续选择。',
      }
      reply('native-navigated', { request_id: d.request_id, view: d.view })
    } catch (error) {
      reply('native-navigation-error', { request_id: d.request_id, message: error.message })
    } finally {
      busy = false
    }
  }
  window.addEventListener('runhive-native-request', listen)
  return {
    restore: async () => {
      const token = owner.assistantGuide?.restoreToken
      if (!token) return
      await apply(token)
      owner.assistantGuide = null
    },
    returnToAssistant: () => reply('resource-return', { source_kind: 'tune_datasets' }),
    close: () => {
      closed = true
      window.removeEventListener('runhive-native-request', listen)
    },
  }
}
