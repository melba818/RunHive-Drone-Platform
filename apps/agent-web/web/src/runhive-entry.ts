import { scopedStorage } from './lib/runhive-storage';

async function start() {
  const response = await fetch('/llm-center/agent/auth/me', { credentials: 'same-origin', cache: 'no-store' });
  const identity = await response.json() as { admin_id?: number; module?: string };
  const adminId = Number(identity.admin_id);
  if (!response.ok || !Number.isSafeInteger(adminId) || adminId <= 0 || identity.module !== 'agent') throw new Error('账号验证失败。');
  const prefix = `runhive.agent.${adminId}.`;
  const originalStorage = window.localStorage;
  Object.defineProperty(window, 'localStorage', { configurable: true, value: scopedStorage(originalStorage, adminId) });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: scopedStorage(window.sessionStorage, adminId) });
  // Expose only the numerical display identity. Cookies, credentials and tickets stay out of client state.
  Object.defineProperty(window, '__runhiveAgentIdentity', { value: Object.freeze({ admin_id: adminId, module: 'agent' }), configurable: false });
  let translating = false;
  window.addEventListener('storage', (event) => {
    if (translating) return;
    event.stopImmediatePropagation();
    if (event.key !== null && !event.key.startsWith(prefix)) return;
    translating = true;
    try { window.dispatchEvent(new StorageEvent('storage', { key: event.key?.slice(prefix.length) ?? null, oldValue: event.oldValue, newValue: event.newValue, url: event.url })); }
    finally { translating = false; }
  }, { capture: true });
  localStorage.setItem('penguin.lang', 'zh');
  localStorage.setItem('penguin.theme', 'light');
  localStorage.setItem('penguin.themeId', 'github');
  localStorage.setItem('penguin.textSize', 'xs');
  document.documentElement.lang = 'zh-CN';
  document.documentElement.classList.remove('dark');
  await import('./main');
}
void start().catch(() => {
  const root = document.getElementById('root');
  if (root) root.textContent = '工作区暂时无法打开，请通过上方按钮重新连接。';
});
