// This adapter only runs in the trusted, same-origin tuning document. Gradio
// owns opening, paging and closing data previews; keep its original buttons.
export function decorateTuneDocument(doc) {
  const win = doc.defaultView
  let dialog = null,
    previousFocus = null,
    backdrop = null,
    queued = false
  const setAttribute = (node, key, value) => {
    if (node.getAttribute(key) !== value) node.setAttribute(key, value)
  }
  const addClass = (node, value) => {
    if (node && !node.classList.contains(value)) node.classList.add(value)
  }
  const setStyle = (node, key, value) => {
    if (node.style.getPropertyValue(key) !== value || node.style.getPropertyPriority(key) !== 'important') {
      node.style.setProperty(key, value, 'important')
    }
  }
  const polishControls = () => {
    const upload = doc.getElementById('rh-dataset-upload')
    const importCard = upload?.closest('.rh-layout-card')
    if (importCard) {
      addClass(importCard, 'rh-dataset-import-card')
      const fields = upload.closest('.rh-fields-grid')
      addClass(fields, 'rh-dataset-import-fields')
      // Upload file pickers can also render text inputs; only decorate the name field.
      const nameField = [...(fields?.querySelectorAll('textarea,input[type="text"]') || [])].find(
        (node) => !upload.contains(node),
      )
      if (nameField && !upload.contains(nameField)) {
        addClass(nameField.closest('.block'), 'rh-dataset-import-name')
      }
      const result = [...importCard.querySelectorAll('textarea')].find((node) => !fields?.contains(node))
      if (result) {
        addClass(result.closest('.block'), 'rh-dataset-import-result')
        if (!result.placeholder) setAttribute(result, 'placeholder', '导入后将在这里显示结果。')
      }
      addClass(importCard.querySelector('.rh-actionbar'), 'rh-dataset-import-actions')
    }
    for (const [name, text] of [
      ['infer-backend', '选择模型推理服务。'],
      ['infer-dtype', '选择推理时使用的数据精度。'],
    ]) {
      const block = doc.querySelector('.rh-control-infer-' + name)
      const label = block?.querySelector(':scope>label')
      if (!label || label.querySelector('.rh-align-hint')) continue
      const field = label.querySelector(':scope>.wrap')
      if (field) {
        const hint = doc.createElement('p')
        hint.className = 'rh-align-hint'
        hint.textContent = text
        label.insertBefore(hint, field)
      }
    }
    // Native dropdowns use position:fixed but inherit a padded static position.
    // Measure their original wrapper; keep the options and their callbacks intact.
    for (const menu of doc.querySelectorAll('.block .wrap>.options[role="listbox"]')) {
      const rect = menu.parentElement.getBoundingClientRect()
      if (!rect.width || !Number.isFinite(rect.left)) continue
      const width = Math.min(rect.width, Math.max(0, win.innerWidth - 16))
      const left = Math.max(8, Math.min(rect.left, win.innerWidth - width - 8))
      const below = win.innerHeight - rect.bottom - 8,
        above = rect.top - 8
      const down = below >= 160 || below >= above
      setStyle(menu, 'left', `${left}px`)
      setStyle(menu, 'width', `${width}px`)
      setStyle(menu, 'top', down ? `${rect.bottom + 4}px` : 'auto')
      setStyle(menu, 'bottom', down ? 'auto' : `${win.innerHeight - rect.top + 4}px`)
      setStyle(menu, 'max-height', `${Math.max(0, Math.min(320, (down ? below : above) - 4))}px`)
    }
    for (const label of doc.querySelectorAll('.rh-control-train-dataset>label.container')) {
      if (label.querySelector('.rh-dataset-hint')) continue
      const field = label.querySelector(':scope>.wrap')
      if (field) {
        const hint = doc.createElement('p')
        hint.className = 'rh-dataset-hint'
        hint.textContent = '选择用于训练的数据集，支持多选。'
        label.insertBefore(hint, field)
      }
    }
    for (const button of doc.querySelectorAll('.tab-like-container .reset-button')) {
      setAttribute(button, 'aria-label', '恢复默认值')
      setAttribute(button, 'title', '恢复默认值')
    }
    for (const [index, button] of [...doc.querySelectorAll('.rh-advanced>.label-wrap')].entries()) {
      const panel = button.nextElementSibling
      if (!panel) continue
      if (!panel.id) panel.id = `${button.parentElement.id || 'rh-advanced-' + index}-panel`
      setAttribute(button, 'aria-controls', panel.id)
      setAttribute(button, 'aria-expanded', String(win.getComputedStyle(panel).display !== 'none'))
    }
  }
  const closeButton = (node) => node?.querySelector('button.rh-preview-close,.rh-preview-close button')
  const visible = (node) =>
    node.getClientRects().length > 0 &&
    win.getComputedStyle(node).display !== 'none' &&
    (!node.closest('[role="tabpanel"]') ||
      win.getComputedStyle(node.closest('[role="tabpanel"]')).display !== 'none')
  const close = () => closeButton(dialog)?.click()
  const release = () => {
    backdrop?.remove()
    backdrop = null
    if (previousFocus?.isConnected && visible(previousFocus)) previousFocus.focus({ preventScroll: true })
    previousFocus = null
    dialog = null
  }
  const sync = () => {
    queued = false
    polishControls()
    const current = [...doc.querySelectorAll('.rh-preview-dialog')].find(visible) || null
    if (current === dialog) return
    // Moving to another native section should also dismiss its old preview.
    if (dialog && !visible(dialog)) closeButton(dialog)?.click()
    release()
    if (!current) return
    dialog = current
    previousFocus = doc.activeElement
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', '数据集预览')
    dialog.setAttribute('tabindex', '-1')
    backdrop = doc.createElement('div')
    backdrop.className = 'rh-preview-backdrop'
    backdrop.setAttribute('aria-hidden', 'true')
    backdrop.addEventListener('click', close)
    doc.body.appendChild(backdrop)
    ;(closeButton(dialog) || dialog).focus({ preventScroll: true })
  }
  const schedule = () => {
    if (!queued) {
      queued = true
      win.requestAnimationFrame(sync)
    }
  }
  const keydown = (event) => {
    if (!dialog) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const nodes = [...dialog.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(
      (n) => !n.disabled && n.tabIndex >= 0 && visible(n),
    )
    if (!nodes.length) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = nodes[0],
      last = nodes[nodes.length - 1]
    if (event.shiftKey && (doc.activeElement === first || !dialog.contains(doc.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (doc.activeElement === last || !dialog.contains(doc.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }
  const observer = new win.MutationObserver(schedule)
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'data-rh-tune-section'],
  })
  doc.addEventListener('keydown', keydown, true)
  doc.addEventListener('scroll', schedule, true)
  win.addEventListener('resize', schedule)
  schedule()
  return () => {
    observer.disconnect()
    doc.removeEventListener('keydown', keydown, true)
    doc.removeEventListener('scroll', schedule, true)
    win.removeEventListener('resize', schedule)
    release()
  }
}
