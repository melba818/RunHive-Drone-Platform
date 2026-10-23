import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const {transform} = await import('esbuild').catch(() => import(new URL('../../../../frontend/node_modules/esbuild/lib/main.js', import.meta.url)))
const root=new URL('../src/',import.meta.url)
async function load(path){const code=(await transform(await readFile(new URL(path,root),'utf8'),{loader:'ts',format:'esm',target:'es2022'})).code;return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}
function storage(){const values=new Map();return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}}
test('账号草稿/目录/配置键隔离，clear不影响Runhive账号或其他用户',async()=>{const {scopedStorage}=await load('lib/runhive-storage.ts'),base=storage();base.setItem('adminInfo','fixture-parent-do-not-read');const a=scopedStorage(base,42),b=scopedStorage(base,43);a.setItem('penguin.draft','a');b.setItem('penguin.draft','b');assert.equal(a.getItem('penguin.draft'),'a');assert.equal(b.getItem('penguin.draft'),'b');assert.equal(a.getItem('adminInfo'),null);assert.equal(a.length,1);assert.equal(a.key(0),'penguin.draft');a.clear();assert.equal(b.getItem('penguin.draft'),'b');assert.equal(base.getItem('adminInfo'),'fixture-parent-do-not-read');assert.throws(()=>scopedStorage(base,0))})
test('API/SSE/文件URL同源前缀且不会重复prefix',async()=>{const {apiUrl}=await load('lib/server-context.ts');assert.equal(apiUrl('/api/me'),'/llm-center/agent/api/me');assert.equal(apiUrl('/api/events'),'/llm-center/agent/api/events');assert.equal(apiUrl('/api/files','host id'),'/llm-center/agent/server/host%20id/api/files');assert.equal(apiUrl('/llm-center/agent/api/me'),'/llm-center/agent/api/me')})
test('生成内容预览没有same-origin权限，初始展示不选择裸预览',async()=>{for(const path of ['features/workflows/workflow-tabs.tsx','features/chat/workspace-browser.tsx']){const source=await readFile(new URL(path,root),'utf8');assert.doesNotMatch(source,/sandbox="[^"]*allow-same-origin/)}const auth=await readFile(new URL('state/auth.tsx',root),'utf8');assert.match(auth,/setPreviewIsolated\(false\)/);assert.doesNotMatch(auth,/setPreviewIsolated\((res|me)\.previewIsolated\)/)})

test('技能SVG禁止脚本、SMIL链接、HTML和不安全属性，无DOM时安全降级',async()=>{
 const {sanitizeSkillIcon}=await load('features/skills/skill-icon.ts')
 for(const svg of ['<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>','<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>','<svg onload="alert(1)"></svg>','<svg><style>@import url(https://example.test)</style></svg>']) assert.equal(sanitizeSkillIcon(svg),null)
 assert.equal(sanitizeSkillIcon('<svg><path d="M0 0L1 1"/></svg>'),null)
})
test('真实XML解析器接受静态图形且拒绝SMIL、链接、样式、命名空间绕过',async(t)=>{
 const xml = await import(new URL('../../../node_modules/.pnpm/@xmldom+xmldom@0.8.13/node_modules/@xmldom/xmldom/lib/index.js', import.meta.url)).catch(()=>null)
 if(!xml){t.skip('XML parser fixture is available in the server build workspace');return}
 const oldParser=globalThis.DOMParser,oldSerializer=globalThis.XMLSerializer
 globalThis.DOMParser=xml.DOMParser;globalThis.XMLSerializer=xml.XMLSerializer
 try{
  const {sanitizeSkillIcon}=await load('features/skills/skill-icon.ts')
  const safe='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path stroke="currentColor" d="M0 0L1 1"/></svg>'
  assert.match(sanitizeSkillIcon(safe),/<path/)
  for(const svg of ['<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>','<svg><path onload="alert(1)"/></svg>','<svg><path style="fill:url(https://example.test)"/></svg>','<svg xmlns="http://www.w3.org/1999/xhtml"><path/></svg>','<svg><path fill="url(javascript:alert(1))"/></svg>'])assert.equal(sanitizeSkillIcon(svg),null)
 }finally{globalThis.DOMParser=oldParser;globalThis.XMLSerializer=oldSerializer}
})
test('预览cap限制同模块同origin，只传source pathname/query',async()=>{const {previewSource,previewUrl}=await load('lib/runhive-preview.ts'),origin='http://fixture.test';assert.equal(previewSource('/llm-center/agent/api/sessions/a/files/content?path=app%2Findex.html',origin),'/llm-center/agent/api/sessions/a/files/content?path=app%2Findex.html');const good='/llm-center/agent/preview/'+ 'a'.repeat(64)+'/index.html';assert.equal(previewUrl(good,origin),good);for(const bad of ['https://evil.test'+good,'/llm-center/tune/preview/'+ 'a'.repeat(64)+'/index.html',good+'?ticket=bad'])assert.throws(()=>previewUrl(bad,origin));assert.throws(()=>previewSource('/llm-center/tune/gradio_api/file=/tenant/secret',origin))})


test('内置技能只汉化展示名称和说明，原通信ID及用户自定义名称保持', async()=>{const {skillDisplayName,builtinSkillBrief}=await load('lib/runhive-skill-labels.ts');for(const id of ['a2ui','agent-evaluation','agent-initialization','agent-optimization','benchmark-design','bento-slides','browser-automation','data-analysis','firecrawl','llamafactory','ollama','penguin-config','penguin-orchestration','penguin-sdk','skill-porting','software-engineering','unified-llm-api','vllm','web-design']){assert.match(skillDisplayName(id),/[\u4e00-\u9fff]/u);assert.match(builtinSkillBrief(id),/[\u4e00-\u9fff]/u);assert.doesNotMatch(skillDisplayName(id)+builtinSkillBrief(id),/penguin|llama[- ]?factory/i)}assert.equal(skillDisplayName('我的技能'),'我的技能');assert.equal(builtinSkillBrief('__proto__'),undefined);assert.match(builtinSkillBrief('llamafactory'),/大模型微调入口/);assert.match(builtinSkillBrief('vllm'),/管理员/);assert.match(builtinSkillBrief('penguin-config'),/网页管理/);const source=await readFile(new URL('features/agents/skills-tab.tsx',root),'utf8');assert.match(source,/exportSkill\(skill\.name\)/);assert.match(source,/setRemoving\(skill\.name\)/)})
