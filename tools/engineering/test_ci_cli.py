"""Negative CLI tests in disposable synthetic directories, never in the repository."""
import hashlib,json,pathlib,subprocess,sys,tempfile,unittest
CI=pathlib.Path(__file__).with_name('ci.py')
class AdmissionCLI(unittest.TestCase):
 def rejected(self,rel,body,category,wrong_hash=False):
  with tempfile.TemporaryDirectory(prefix='runhive-ci-negative-') as tmp:
   root=pathlib.Path(tmp);source=root/'source';source.mkdir();p=source/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body)
   want='0'*64 if wrong_hash else hashlib.sha256(body).hexdigest();manifest=root/'manifest.json';manifest.write_text(json.dumps({'commit':'synthetic-negative','files':{rel:want}}))
   result=subprocess.run([sys.executable,'-B','-I',str(CI),'--source',str(source),'--manifest',str(manifest)],capture_output=True,text=True,timeout=15)
   self.assertEqual(result.returncode,1);record=json.loads(result.stdout);self.assertEqual(record['status'],'FAIL')
   self.assertIn(category,record['checks'][0]['issues'][0]['categories'])
 def test_environment_file(self):self.rejected('.env',b'synthetic=1','secret-data-or-build-artifact')
 def test_dependency_artifact(self):self.rejected('node_modules/x.js',b'x','forbidden-path')
 def test_private_key(self):self.rejected('x.txt',('-----BEGIN '+'PRIVATE KEY-----').encode(),'private-key')
 def test_credential_default(self):self.rejected('config.php',("env('database."+"password', 'synthetic-value')").encode(),'php-credential-default')
 def test_next_key(self):self.rejected('x.json',json.dumps({'encryption'+'Key':'synthetic-negative-value'}).encode(),'next-encryption-key')
 def test_python_syntax(self):self.rejected('x.py',b'def broken(:','python-syntax:1')
 def test_model_weight(self):self.rejected('model.pt',b'synthetic','secret-data-or-build-artifact')
 def test_hash_mismatch(self):self.rejected('x.py',b'x=1\n','source-sha256-mismatch',True)
if __name__=='__main__':unittest.main(verbosity=2)
