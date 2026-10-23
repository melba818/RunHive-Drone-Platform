import {Environment,toolCall} from '/opt/penguin/lib/node_modules/@prismshadow/penguin-core/dist/index.js';
import fs from 'node:fs/promises';
const agent='/data/default_project/agents/default_agent';
const scratch=agent+'/scratchpad/sdk-boundary-fixture';
await fs.mkdir(scratch,{recursive:true});
const token=(await fs.readFile('/data/api-token','utf8')).trim();
const secrets=[token,...['LLM_INSTANCE_KEY','LLM_AGENT_BROKER_TOKEN','PENGUIN_SEED_ADMIN_PASSWORD'].map(k=>process.env[k]).filter(Boolean)];
await fs.symlink('/data/api-token','/workspace/sdk-token-link').catch(e=>{if(e.code!=='EEXIST')throw e;});
const defs=[{name:'read_file',description:'测试读取',permission:'r'},{name:'write_file',description:'测试写入',permission:'rw'}];
function environment(readonly){return new Environment({workspaceDir:'/workspace',sessionScratchpadDir:scratch,toolConfig:{customTools:defs,mcpServers:[]},confineSpawn:()=> (argv,opts)=>({argv:['python3','/opt/runtime/agent_sandbox.py','--workspace',opts.workspaceDir,'--agent-dir',agent,'--scratchpad',opts.scratchpadDir,...(readonly?['--read-only']:[]),'--',...argv]})});}
async function call(env,name,args){let result;for await(const m of env.executeTool({toolCall:toolCall({name,arguments:JSON.stringify(args),toolCallId:'sdk_fixture'})})){if(m.payload.type==='tool_call_output')result=m.payload;}if(!result)throw Error('工具未返回');if(secrets.some(s=>JSON.stringify(result).includes(s)))throw Error('认证内容被工具读取');return result;}
const records=[];
for(const readonly of [false,true]){
 const env=environment(readonly);
 try{
  if(!readonly){const r=await call(env,'write_file',{file_path:'sdk-allowed.txt',content:'允许工作区文件'});if(r.stop_reason!=='completed')throw Error('工作区写入失败');records.push({case:'sdk_write_workspace',passed:true});}
  const r=await call(env,'read_file',{file_path:'sdk-allowed.txt'});if(r.stop_reason!=='completed'||!r.output.includes('允许工作区文件'))throw Error('工作区读取失败');records.push({case:'sdk_read_workspace_'+readonly,passed:true});
  for(const path of ['/data/api-token','/proc/1/environ','/workspace/sdk-token-link']){const r=await call(env,'read_file',{file_path:path});console.log(JSON.stringify({case:path,readonly,stop:r.stop_reason,outputLength:r.output?.length??0}));if(r.stop_reason!=='fatal'&&!(path==='/proc/1/environ'&&(r.output?.length??0)<100))throw Error('目录边界未拒绝：'+path);records.push({case:'sdk_read_denied_or_empty_'+path+'_'+readonly,passed:true});}
  if(readonly){const r=await call(env,'write_file',{file_path:'readonly-forbidden.txt',content:'不得写入'});if(r.stop_reason!=='fatal')throw Error('只读未生效');records.push({case:'sdk_readonly_write_denied',passed:true});}
 }finally{env.dispose();}
}
await fs.writeFile('/workspace/sdk-sandbox-verification.json',JSON.stringify(records,null,2));
console.log(JSON.stringify({passed:records.length,native_sdk_tools:true,landlock:true}));
