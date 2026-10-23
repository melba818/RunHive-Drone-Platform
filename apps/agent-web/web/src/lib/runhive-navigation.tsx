import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

export const AGENT_SECTIONS = { projects: '/chat/new', agents: '/agents', skills: '/skills', models: '/models', runs: '/runs', evaluations: '/benchmark' } as const;
export type AgentSection = keyof typeof AGENT_SECTIONS;
export function initialAgentPath(): string {
  const nativePath = location.pathname.slice('/llm-center/agent/ui'.length);
  if (nativePath.startsWith('/terminal') || nativePath.startsWith('/app/') || nativePath.startsWith('/chat/')) return nativePath + location.search;
  const section = new URLSearchParams(location.search).get('section') as AgentSection | null;
  return section && Object.hasOwn(AGENT_SECTIONS, section) ? AGENT_SECTIONS[section] : '/chat/new';
}
export function RunhiveNavigation() {
  const navigate = useNavigate(), current = useLocation();
  useEffect(() => {
    const identity = (window as Window & { __runhiveAgentIdentity?: { admin_id: number } }).__runhiveAgentIdentity;
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (!identity || event.source !== window.parent || event.origin !== location.origin
        || data?.source !== 'runhive-llm-shell' || data.type !== 'llm-section-change'
        || data.module !== 'agent' || Number(data.admin_id) !== identity.admin_id || !Object.hasOwn(AGENT_SECTIONS, data.section)) return;
      // An authentication handshake must not overwrite a conversation already opened by the user.
      if (data.section === 'projects' && current.pathname.startsWith('/chat/')) return;
      navigate(AGENT_SECTIONS[data.section as AgentSection]);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [navigate, current.pathname]);
  useEffect(() => {
    const identity = (window as Window & { __runhiveAgentIdentity?: { admin_id: number } }).__runhiveAgentIdentity;
    if (!identity || window.parent === window) return;
    const section: AgentSection = current.search.includes('rh_trace=1') ? 'runs'
      : current.pathname.startsWith('/agents') ? 'agents' : (current.pathname.startsWith('/skills') || current.pathname.startsWith('/plugins')) ? 'skills'
      : current.pathname.startsWith('/models') ? 'models' : current.pathname.startsWith('/runs') ? 'runs'
      : current.pathname.startsWith('/benchmark') ? 'evaluations' : 'projects';
    const frame = requestAnimationFrame(() => window.parent.postMessage({ source: 'llm-center-content', type: 'llm-section-ready', admin_id: identity.admin_id, module: 'agent', section }, location.origin));
    return () => cancelAnimationFrame(frame);
  }, [current.pathname, current.search]);
  return null;
}
