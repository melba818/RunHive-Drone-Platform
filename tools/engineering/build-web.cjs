'use strict';
// Run only in the approved, bounded, network-disabled validation container.
const cp=require('child_process'),fs=require('fs'),path=require('path'),crypto=require('crypto');
if(process.env.RUNHIVE_TEST_ISOLATED!=='1')throw Error('Explicit isolated runtime required');
const root='/work/repo/apps/runos-web',results=[];
for(const [cmd,args] of [['npm',['ci','--offline','--ignore-scripts','--include=dev','--no-audit','--no-fund','--cache=/cache']],['node',['node_modules/next/dist/bin/next','typegen']],['node',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']],['node',['node_modules/next/dist/bin/next','build','--webpack']]]){
 const r=cp.spawnSync(cmd,args,{cwd:root,env:{...process.env,CI:'1',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=2048',UV_THREADPOOL_SIZE:'2',RAYON_NUM_THREADS:'2',NPM_CONFIG_OFFLINE:'true'},encoding:'utf8',timeout:600000,maxBuffer:4*1024**2});
 results.push({command:[cmd,...args],exit:r.status,error:r.error?String(r.error):null,stdout:r.stdout,stderr:r.stderr});
 if(r.status!==0)break;
}
const result={status:results.length===4&&results.every(r=>r.exit===0)?'PASS':'FAIL',steps:results};
if(result.status==='PASS'){
 const built=root+'/.next/standalone';fs.cpSync(root+'/.next/static',built+'/.next/static',{recursive:true});if(fs.existsSync(root+'/public'))fs.cpSync(root+'/public',built+'/public',{recursive:true});
 result.artifact={kind:'Next standalone',source_manifest_sha256:crypto.createHash('sha256').update(fs.readFileSync('/work/source-manifest.json')).digest('hex'),build_id:fs.readFileSync(root+'/.next/BUILD_ID','utf8').trim()};
}
console.log('API_STAGE_RESULT='+JSON.stringify(result));process.exitCode=result.status==='PASS'?0:1;
