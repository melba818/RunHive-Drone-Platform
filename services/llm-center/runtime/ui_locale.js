// Native Gradio controls use the built-in Simplified Chinese locale.
(() => {
  try {
    Object.defineProperty(window.navigator, 'language', { configurable: true, get: () => 'zh-CN' });
    Object.defineProperty(window.navigator, 'languages', { configurable: true, get: () => ['zh-CN'] });
  } catch (_) {}
  document.documentElement.lang = 'zh-CN';
  document.documentElement.classList.remove('dark');
  const sections = ['workspace', 'data', 'train', 'eval', 'chat', 'export'];
  let wanted = new URLSearchParams(location.search).get('section') || 'workspace';
  if (!sections.includes(wanted)) wanted = 'workspace';
  let adminId = 0, readySection = '', scheduled = false, applyToken='';
  const announce = (type, section, message) => {
    if (!adminId || window.parent === window) return;
    window.parent.postMessage({ source: 'llm-center-content', type, module: 'tune', admin_id: adminId, section, ...(type.startsWith('llm-resource-')&&applyToken?{token:applyToken}:{}), ...(message ? { message } : {}) }, location.origin);
  };
  const activate = () => {
    scheduled = false;
    const root = document.querySelector('#runhive-tune-sections');
    // Current Gradio wraps the tablist in .tab-wrapper; older builds used
    // .tab-nav directly. ARIA identifies the real controls in both layouts.
    const nav = root?.querySelector('[role="tablist"]') || root?.querySelector('.tab-nav');
    const buttons = nav?.querySelectorAll('button[role="tab"]');
    const index = sections.indexOf(wanted), button = nav?.querySelector(`button[role="tab"][data-tab-id="${wanted}"]`)
      || nav?.querySelector(`button[role="tab"][aria-controls="rh-tune-section-${wanted}"]`) || buttons?.[index];
    if (!button || !adminId) return;
    document.body.dataset.rhTuneSection = wanted;
    if (button.getAttribute('aria-selected') !== 'true') { button.click(); return; }
    const panel = document.getElementById(`rh-tune-section-${wanted}`);
    if (!panel || panel.hidden || getComputedStyle(panel).display === 'none') return;
    if (['train', 'eval', 'chat'].includes(wanted) && !Array.from(panel.querySelectorAll('button')).some((node) => /[\u3400-\u9fff]/u.test(node.textContent))) return;
    if (readySection !== wanted) { readySection = wanted; announce('llm-section-ready', wanted); }
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(activate); } };
  window.addEventListener('rh-resource-applied', () => announce('llm-resource-success', wanted));
  window.addEventListener('rh-resource-failed', () => announce('llm-resource-failed', wanted));
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-rh-job-id]');
    if (!button || !adminId) return;
    const rect = button.getBoundingClientRect();
    window.parent.postMessage({ source:'llm-center-content',type:'llm-resource-menu',module:'tune',admin_id:adminId,
      resource:button.dataset.rhJobId,kind:'job',rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height} },location.origin);
  });
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window.parent || event.origin !== location.origin || data?.source !== 'runhive-llm-shell'
      || data.module !== 'tune' || Number(data.admin_id) !== adminId) return;
    if (data.type === 'llm-resource-refresh') {
      const refresh = document.getElementById('rh-task-refresh');
      (refresh?.matches('button') ? refresh : refresh?.querySelector('button'))?.click();
      return;
    }
    if (data.type === 'llm-resource-apply' && /^(restore:)?[a-f0-9]{48}$/.test(data.token)) {
      const input = document.querySelector('#rh-resource-apply textarea, #rh-resource-apply input');
      if (!input) { announce('llm-resource-failed',wanted); return; }
      applyToken=data.token; const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(input,data.token);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
    if (data.type !== 'llm-section-change' || !sections.includes(data.section)) return;
    wanted = data.section; readySection = '';
    const url = new URL(location.href); url.searchParams.set('section', wanted); history.replaceState(null, '', url);
    schedule();
  });
  const start = async () => {
    try {
      const response = await fetch('/llm-center/tune/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Number.isSafeInteger(Number(data.admin_id)) || Number(data.admin_id) <= 0 || data.module !== 'tune') throw Error('auth');
      adminId = Number(data.admin_id);
      new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden', 'style'] });
      schedule();
    } catch (_) {
      // The outer shell owns reauthentication and the user-facing failure state.
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
