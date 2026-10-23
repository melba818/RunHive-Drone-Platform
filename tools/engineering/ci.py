#!/usr/bin/env python3
"""Offline source admission and syntax CI. No imports of business applications."""
import argparse,ast,hashlib,json,pathlib,re,sys,subprocess
FORBIDDEN={'.git','node_modules','__pycache__','.next','.venv','db-data','uploads'}
SECRETS=[('private-key',re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
 ('php-credential-default',re.compile(r"env\(\s*['\"](?:database\.(?:password|username|database)|[^'\"]*(?:secret|token|api_key))['\"]\s*,\s*['\"]([^'\"]+)['\"]",re.I)),
 ('next-encryption-key',re.compile(r'"encryptionKey"\s*:\s*"[^"\s]{12,}"'))]
def inspect(rel,data):
 issues=[];p=pathlib.PurePosixPath(rel)
 if p.is_absolute() or '..' in p.parts or any(x in FORBIDDEN for x in p.parts):issues.append('forbidden-path')
 if p.name=='.env' or p.suffix.lower() in {'.pem','.key','.p12','.pfx','.sqlite','.sqlite3','.pyc','.pt','.pth','.onnx'}:issues.append('secret-data-or-build-artifact')
 try:text=data.decode('utf-8-sig')
 except UnicodeError:return issues
 for category,regex in SECRETS:
  if regex.search(text):issues.append(category)
 if p.suffix=='.py':
  try:ast.parse(text,filename=rel)
  except SyntaxError as ex:issues.append('python-syntax:'+str(ex.lineno))
 return issues
def selftest():
 key=('-----BEGIN '+'PRIVATE KEY-----').encode()
 credential=("env('database."+"password', 'synthetic-negative-value')").encode()
 nextkey=json.dumps({'encryption'+'Key':'synthetic-negative-value'}).encode()
 cases=[('x/.env',b'x','secret-data-or-build-artifact'),('node_modules/x.js',b'x','forbidden-path'),('x.py',b'def x(:','python-syntax:1'),('x.txt',key,'private-key'),('config.php',credential,'php-credential-default'),('x.json',nextkey,'next-encryption-key')]
 for name,data,expected in cases:assert expected in inspect(name,data),(name,expected)
 assert not inspect('app.py',b'x = 1\n')
 return len(cases)+1
def main():
 a=argparse.ArgumentParser();a.add_argument('--source',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[2]);a.add_argument('--manifest',type=pathlib.Path);a.add_argument('--selftest',action='store_true');ns=a.parse_args()
 checks=[];issues=[];root=ns.source.resolve()
 if ns.selftest:checks.append({'id':'negative-admission-selftests','count':selftest(),'status':'PASS'})
 if ns.manifest:
  expected=json.loads(ns.manifest.read_text());files=expected['files'];commit=expected['commit']
 else:
  # Only tracked paths are admitted. Never recursively read the 146 ignored files.
  raw=subprocess.check_output(['git','-c','core.fsmonitor=false','ls-files','-z'],cwd=root)
  files={p:None for p in raw.decode().split('\0') if p};commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
 for rel,want in sorted(files.items()):
  p=root/rel
  if p.is_symlink() or p.resolve()!=p or not p.is_file():issues.append({'path':rel,'categories':['non-regular-or-escape']});continue
  b=p.read_bytes();sha=hashlib.sha256(b).hexdigest()
  found=inspect(rel,b)
  if want and sha!=(want['sha256'] if isinstance(want,dict) else want):found.append('source-sha256-mismatch')
  if found:issues.append({'path':rel,'categories':found})
 checks.append({'id':'tracked-source-admission-and-python-ast','status':'PASS' if not issues else 'FAIL','files':len(files),'issues':issues})
 blockers=[{'module':'portal','status':'BLOCKED','reason':'matching editable source unavailable'}, {'module':'full-training','status':'BLOCKED','reason':'controlled vendor/timm and unapproved weights excluded'}, {'module':'agent-and-llm-complete-deployment','status':'BLOCKED','reason':'module-specific dependency/runtime recovery not demonstrated by this profile'}]
 result={'status':'FAIL' if issues else 'PASS_WITH_BLOCKED_MODULES','commit':commit,'checks':checks,'blocked_modules':blockers}
 print(json.dumps(result,ensure_ascii=False));return 1 if issues else 0
if __name__=='__main__':sys.exit(main())
