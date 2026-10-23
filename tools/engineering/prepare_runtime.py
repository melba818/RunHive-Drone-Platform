import pathlib,tarfile,subprocess,json,os,traceback,hashlib
assert os.environ.get('RUNHIVE_TEST_ISOLATED')=='1'
profile=json.loads(pathlib.Path('/work/repo/docs/dependencies/validation-profile.lock.json').read_text())
for name,want in profile['runtime_archives'].items():
 h=hashlib.sha256();size=0
 with open(name,'rb') as f:
  while b:=f.read(65536):h.update(b);size+=len(b)
 assert size==want['bytes'] and h.hexdigest()==want['sha256'],name
checks=[]
def extract(name,dest,budget):
 with tarfile.open(name) as t:
  members=t.getmembers();assert len(members)<2000 and sum(m.size for m in members)<budget
  assert all(m.isfile() and not m.name.startswith('/') and '..' not in pathlib.PurePosixPath(m.name).parts for m in members)
  t.extractall(dest,filter='data')
try:
 extract('/previous/php-runtime.tar.gz','/work/php',170*1024**2)
 extract('/previous/php-runtime-addons.tar.gz','/work/php',12*1024**2)
 extract('/harness/mariadb-runtime.tar.gz','/work/maria',100*1024**2)
 extract('/harness/framework-runtime-complete.tar.gz','/work/framework',8*1024**2)
 extract('/harness/mariadb-runtime-closure.tar.gz','/work/maria',12*1024**2)
 extract('/harness/mariadb-dump-runtime.tar.gz','/work/maria',12*1024**2)
 p=pathlib.Path('/work/php');m=pathlib.Path('/work/maria');lib=str(m/'usr/lib/x86_64-linux-gnu')+':'+str(p/'usr/lib/x86_64-linux-gnu')+':'+str(p/'lib/x86_64-linux-gnu')
 loader=str(p/'usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2');base=[loader,'--library-path',lib]
 modules=p/'usr/lib/php/20230831'
 # pdo_mysql and mysqlnd are public matching-version packages, not host extensions.
 php=base+[str(p/'usr/bin/php8.3'),'-n']
 for name in ['pdo','mysqlnd','pdo_mysql','pdo_sqlite','ctype','mbstring','tokenizer']:
  q=(m if name in ['mysqlnd','pdo_mysql'] else p)/'usr/lib/php/20230831'/ (name+'.so')
  assert q.is_file();php+=['-d','extension='+str(q)]
 for name,command in [('mariadb',base+[str(m/'usr/sbin/mariadbd'),'--no-defaults','--version']),('client',base+[str(m/'usr/bin/mariadb'),'--no-defaults','--version']),('dump',base+[str(m/'usr/bin/mariadb-dump'),'--no-defaults','--version']),('php',php+['-r','echo json_encode([PHP_VERSION,PDO::getAvailableDrivers()]);'])]:
  r=subprocess.run(command,capture_output=True,text=True,timeout=15);checks.append({'id':name,'status':'PASS' if r.returncode==0 else 'FAIL','exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
 assert all(x['status']=='PASS' for x in checks)
 pathlib.Path('/work/runtime.json').write_text(json.dumps({'php':php,'mariadb':base+[str(m/'usr/sbin/mariadbd')],'client':base+[str(m/'usr/bin/mariadb')],'dump':base+[str(m/'usr/bin/mariadb-dump')]}))
 result={'status':'PASS','checks':checks}
except Exception as ex:result={'status':'FAIL','checks':checks,'error':traceback.format_exc()[-2000:]}
print('API_STAGE_RESULT='+json.dumps(result),flush=True)
raise SystemExit(0 if result['status']=='PASS' else 1)
