'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),cp=require('child_process'),crypto=require('crypto');
function untar(buf,root,maxBytes){
 let off=0,total=0,count=0,links=[],pax={};const seen=new Set();fs.mkdirSync(root,{recursive:true});
 while(off+512<=buf.length){
  const h=buf.subarray(off,off+512);off+=512;if(h.every(x=>x===0))break;
  const field=(a,b)=>h.subarray(a,b).toString().replace(/\0.*$/s,'');
  const size=parseInt(field(124,136).trim()||'0',8),mode=parseInt(field(100,108).trim()||'644',8),type=field(156,157)||'0';
  if(type==='g'){if(size>65536)throw Error('Global PAX budget');const text=buf.subarray(off,off+size).toString();if(/(?:^|\n)\d+ (?:path|linkpath)=/.test(text))throw Error('Global path override');off+=Math.ceil(size/512)*512;continue;}
  if(type==='x'){
   const data=buf.subarray(off,off+size);let i=0;pax={};
   while(i<data.length){const space=data.indexOf(32,i),len=Number(data.subarray(i,space).toString());if(!Number.isSafeInteger(len)||len<=0||i+len>data.length)throw Error('Invalid PAX');const pair=data.subarray(space+1,i+len-1).toString(),eq=pair.indexOf('=');pax[pair.slice(0,eq)]=pair.slice(eq+1);i+=len;}
   off+=Math.ceil(size/512)*512;continue;
  }
  const name=pax.path||((field(345,500)?field(345,500)+'/':'')+field(0,100)),link=pax.linkpath||field(157,257);pax={};
  if(!Number.isSafeInteger(size)||size<0||name.startsWith('/')||name.split('/').includes('..')||seen.has(name))throw Error('Unsafe archive member');
  const dst=path.resolve(root,name);if(!dst.startsWith(root+'/'))throw Error('Archive escape');seen.add(name);total+=size;count++;if(total>maxBytes||count>10000)throw Error('Archive budget');
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  if(type==='0')fs.writeFileSync(dst,buf.subarray(off,off+size),{flag:'wx',mode:mode&0o111?0o755:0o644});
  else if(type==='2'){const target=link,resolved=path.resolve(path.dirname(dst),target);if(!resolved.startsWith(root+'/'))throw Error('Link escape');links.push([dst,target]);}
  else if(type==='5')fs.mkdirSync(dst,{recursive:true});else throw Error('Unsupported archive type '+type);
  off+=Math.ceil(size/512)*512;
 }
 for(const [dst,target] of links)fs.symlinkSync(target,dst);
 return {count,bytes:total};
}
try{
 let a={reused:false};if(!fs.existsSync('/work/input/validation-requirements.txt')){const b=fs.readFileSync('/seed/public-input.tar');const m=JSON.parse(fs.readFileSync('/harness/input-map.json')).inputs.public_input;if(b.length!==m.bytes||crypto.createHash('sha256').update(b).digest('hex')!==m.sha256)throw Error('Public seed SHA mismatch');a=untar(b,'/work/input',200*1024**2)}else a={reused:true};
 const p=fs.readFileSync('/work/input/python.tar.gz');let py=fs.existsSync('/work/python/bin/python3.12')?{reused:true}:untar(zlib.gunzipSync(p),'/work',160*1024**2);
 let w=fs.existsSync('/work/wheels')?{reused:true}:untar(fs.readFileSync('/work/input/wheels.tar'),'/work/wheels',150*1024**2);
 fs.mkdirSync('/work/site3',{recursive:true});fs.mkdirSync('/work/synthetic',{recursive:true});fs.mkdirSync('/work/pip-tmp',{recursive:true});untar(fs.readFileSync('/harness/approved-baseline.tar'),'/work/repo',32*1024**2);process.env.LD_LIBRARY_PATH='/harness/oslibs';process.env.TMPDIR='/work/pip-tmp';
 const bin='/work/python/bin/python3.12';
 const probe=cp.spawnSync(bin,['-I','-c','import sys,ssl,sqlite3;print(sys.version);print(ssl.OPENSSL_VERSION)'],{encoding:'utf8',timeout:15000});
 if(probe.status!==0)throw Error('Interpreter failed '+probe.stderr);
 const args=['-I','-m','pip','--isolated','--disable-pip-version-check','install','--no-index','--find-links=/work/wheels','--require-hashes','--no-deps','--no-compile','--no-cache-dir','--ignore-installed','--target=/work/site3','-r','/work/input/validation-requirements.txt'];
 const install=cp.spawnSync(bin,args,{encoding:'utf8',timeout:180000,maxBuffer:2*1024**2});
 fs.chmodSync('/work',0o755);fs.copyFileSync('/harness/source-manifest.json','/work/source-manifest.json');
 const result={status:install.status===0?'PASS':'FAIL',stage:'prepare',python:probe.stdout.trim(),interpreter_exit:probe.status,install_exit:install.status,install_command:[bin,...args],install_stdout:install.stdout,install_stderr:install.stderr,archives:{input:a,python:py,wheels:w}};
 fs.writeFileSync('/results/prepare.json',JSON.stringify(result));console.log('API_STAGE_RESULT='+JSON.stringify(result));process.exitCode=result.status==='PASS'?0:1;
}catch(e){console.log('API_STAGE_RESULT='+JSON.stringify({status:'FAIL',stage:'prepare',error:String(e.stack)}));process.exitCode=1;}
