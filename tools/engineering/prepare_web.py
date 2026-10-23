"""Verify and unpack the public, pinned offline cache in bounded test tmpfs."""
import pathlib,json,hashlib,tarfile,zipfile,os
assert os.environ.get('RUNHIVE_TEST_ISOLATED')=='1'
profile=json.loads(pathlib.Path('/work/repo/docs/dependencies/browser-inputs.lock.json').read_text())
def verify(path,want):
 h=hashlib.sha256();n=0
 with open(path,'rb') as f:
  while b:=f.read(65536):h.update(b);n+=len(b)
 assert n==want['bytes'] and h.hexdigest()==want['sha256'],str(path)
verify('/seed/npm-cache.tar',profile['npm_cache']);verify('/seed/browser.zip',profile['browser'])
for item in profile['browser_runtime']:
 q=pathlib.Path('/browser-fonts' if item['name'].startswith('font:') else '/browser-libs')/item['name'].removeprefix('font:');verify(q,item)
total=0;count=0
with tarfile.open('/seed/npm-cache.tar') as t:
 for m in t:
  assert m.isfile() and m.name.startswith('_cacache/') and '..' not in pathlib.PurePosixPath(m.name).parts
  total+=m.size;count+=1;assert total<350*1024**2 and count<4000
  q=pathlib.Path('/cache')/m.name;q.parent.mkdir(parents=True,exist_ok=True)
  with q.open('xb') as f, t.extractfile(m) as source:
   while b:=source.read(65536):f.write(b)
expanded=0
with zipfile.ZipFile('/seed/browser.zip') as z:
 assert len(z.infolist())<500
 for m in z.infolist():
  name=pathlib.PurePosixPath(m.filename);assert not name.is_absolute() and '..' not in name.parts and name.parts[0]=='chrome-headless-shell-linux64'
  if m.is_dir():continue
  assert (m.external_attr>>16)&0o170000!=0o120000
  expanded+=m.file_size;assert expanded<350*1024**2
  q=pathlib.Path('/work/browser')/name;q.parent.mkdir(parents=True,exist_ok=True)
  with q.open('xb') as f,z.open(m) as source:
   while b:=source.read(65536):f.write(b)
  q.chmod(0o755 if q.name=='chrome-headless-shell' else 0o644)
print('API_STAGE_RESULT='+json.dumps({'status':'PASS','cache_files':count,'cache_bytes':total,'browser_bytes':expanded,'runtime_files':len(profile['browser_runtime'])}))
