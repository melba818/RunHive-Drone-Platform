import { useNavigate } from 'react-router';
import { SkillsTab } from '../agents/skills-tab';
import { agentDisplayName, projectDisplayName, useProject } from '../../state/project';
import { useSessions } from '../../state/sessions';

export function RunhiveSkillsPage() {
  const { agents, currentAgent, setCurrentAgentId, reloadAgents, agentsLoading } = useProject();
  return <section className="h-full overflow-auto p-6">
    <div className="mb-5 flex items-center gap-4"><label htmlFor="rh-skills-agent">选择智能体</label>
      <select id="rh-skills-agent" className="rounded-md border border-line bg-surface px-3 py-2" value={currentAgent?.agentId ?? ''} onChange={(event) => setCurrentAgentId(event.target.value)}>
        {agents.map((agent) => <option key={agent.agentId} value={agent.agentId}>{agentDisplayName(agent)}</option>)}
      </select>
    </div>
    {currentAgent ? <SkillsTab key={currentAgent.agentId} agentId={currentAgent.agentId} onConfigChanged={reloadAgents} /> : <p className="text-gray-500">{agentsLoading ? '正在加载智能体…' : '请先在智能体管理中创建智能体，再管理其技能。'}</p>}
  </section>;
}

export function RunhiveRunsPage() {
  const { currentProject, agents, setCurrentAgentId } = useProject();
  const { sessions, liveStatuses, loading, reload, hasMoreFor, loadMoreFor } = useSessions();
  const navigate = useNavigate();
  const statuses: Record<string, string> = { idle: '已结束', compacting: '上下文整理中', running: '运行中', executing: '运行中', awaiting_approval: '待审批', waiting: '等待中', error: '未完成', interrupted: '已中止' };
  const open = (session: typeof sessions[number], trace: boolean) => {
    setCurrentAgentId(session.agentId);
    navigate(`/chat/${encodeURIComponent(session.sessionId)}${trace ? '?rh_trace=1' : ''}`);
  };
  return <section className="h-full overflow-auto p-6">
    <div className="mb-5 flex items-center justify-between"><p>{currentProject ? projectDisplayName(currentProject) : '当前项目'} · 运行记录</p><button className="rounded-md border border-line px-3 py-1.5 text-brand-600" onClick={() => void reload()}>刷新记录</button></div>
    <table className="w-full text-left"><thead><tr className="border-b border-line text-gray-500"><th className="p-3">对话</th><th>智能体</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>{sessions.map((session) => <tr key={session.sessionId} className="border-b border-line"><td className="p-3">{session.title || '未命名对话'}</td><td>{agents.find((agent) => agent.agentId === session.agentId)?.name || session.agentId}</td><td>{statuses[String(liveStatuses.get(session.sessionId) ?? session.status)] ?? '已记录'}</td><td className="space-x-3"><button className="text-brand-600" onClick={() => open(session, false)}>查看对话</button><button className="text-brand-600" disabled={!session.hasTrace} onClick={() => open(session, true)}>查看执行轨迹</button></td></tr>)}</tbody>
    </table>
    {agents.some((agent) => hasMoreFor(agent.agentId, 'active')) && <button className="mt-4 rounded-md border border-line px-3 py-2 text-brand-600" onClick={() => void loadMoreFor(agents.map((agent) => agent.agentId), 'active')}>加载更多记录</button>}
    {!sessions.length && <p className="py-8 text-center text-gray-500">{loading ? '正在加载运行记录…' : '当前项目暂无运行记录。'}</p>}
  </section>;
}
