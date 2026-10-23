"""Account-owned tuning resource metadata and guarded lifecycle operations."""
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
import json,os,re,sqlite3,stat,tempfile,time,uuid

ACTIVE={'queued','starting','running'}
GROUPS=('data','train','eval','export')
class WorkspaceError(ValueError):
    def __init__(self,message,status=400):super().__init__(message);self.status=status

def name(value,slash=False):
    if not isinstance(value,str) or not value or len(value)>240 or any(ord(c)<32 or ord(c)==127 for c in value) or '\\' in value or ':' in value:
        raise WorkspaceError('资源名称无效。')
    parts=PurePosixPath(value)
    if parts.is_absolute() or any(p.startswith('.') for p in parts.parts) or (not slash and len(parts.parts)!=1) or str(parts)!=value:
        raise WorkspaceError('资源名称无效。')
    return value

def file_path(root,relative):
    relative=name(relative,True);root=Path(root)
    if root.is_symlink():raise WorkspaceError('资源路径无效。')
    p=root
    for part in PurePosixPath(relative).parts:
        p=p/part
        if p.is_symlink():raise WorkspaceError('资源路径无效。')
    if not p.is_file():raise WorkspaceError('资源不存在。',404)
    if p.stat().st_nlink!=1:raise WorkspaceError('资源路径无效。')
    return p

def atomic(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.workspace-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as stream:
            stream.write(data if isinstance(data,bytes) else data.encode('utf-8'));stream.flush();os.fsync(stream.fileno())
        os.replace(tmp,path)
        if os.name!='nt':
            directory=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

@contextmanager
def workspace_lock(root):
    import fcntl
    root=Path(root);path=root/'cache/workspace.lock';path.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(path,os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
    try:
        try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise WorkspaceError('资源正在更新，请稍后重试。',409)
        yield
    finally:os.close(fd)

class WorkspaceStore:
    def __init__(self,root,connection):
        self.root=Path(root);self._connection=connection
        with self.connection() as c:
            c.execute('''CREATE TABLE IF NOT EXISTS workspace_items(
              tenant INTEGER NOT NULL,kind TEXT NOT NULL,rid TEXT NOT NULL,label TEXT,
              pinned INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,
              deleted INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY(tenant,kind,rid))''')

    @contextmanager
    def connection(self):
        c=self._connection()
        try:
            with c:yield c
        finally:c.close()

    def tenant(self,tenant):
        if type(tenant)!=int or not 1<=tenant<=2147483647:raise WorkspaceError('账号标识无效。')
        root=self.root/'tenants'/f'admin-{tenant}'
        if root.is_symlink() or not root.is_dir():raise WorkspaceError('工作区不存在。',404)
        return root

    def metadata(self,c,tenant,kind,rid):
        row=c.execute('SELECT * FROM workspace_items WHERE tenant=? AND kind=? AND rid=?',(tenant,kind,rid)).fetchone()
        return dict(row) if row else dict(label=None,pinned=0,archived=0,deleted=0,revision=0)

    def index(self,root):
        path=file_path(root/'data','dataset_info.json')
        if path.stat().st_size>2*1024**2:raise WorkspaceError('数据集索引过大。')
        info=json.loads(path.read_text('utf-8'))
        if not isinstance(info,dict):raise WorkspaceError('数据集索引格式无效。')
        return info

    def resource(self,c,tenant,kind,rid,*,include_deleted=False):
        root=self.tenant(tenant);rid=name(rid,kind=='export')
        if kind not in {'dataset','job','export'}:raise WorkspaceError('资源类型无效。')
        meta=self.metadata(c,tenant,kind,rid)
        if meta['deleted'] and not include_deleted:raise WorkspaceError('资源已删除。',404)
        if kind=='job':
            row=c.execute('SELECT * FROM jobs WHERE tenant=? AND id=?',(tenant,rid)).fetchone()
            if row is None:raise WorkspaceError('任务不存在。',404)
            row=dict(row);args=json.loads(row['args']);group=row['operation']
            if group not in GROUPS:raise WorkspaceError('任务类型无效。')
            output=args.get('export_dir' if group=='export' else 'output_dir')
            label=Path(output).name if isinstance(output,str) else {'train':'微调任务','eval':'评估任务','export':'导出任务'}[group]+' · '+rid[:8]
            result={'kind':kind,'id':rid,'label':meta['label'] or label,'status':row['status'],'created':row['created'],'updated':row['updated'],
                'description':{'queued':'任务已进入队列。','starting':'任务正在启动。','running':'任务正在运行。','succeeded':'任务已完成。','failed':'任务未能完成，请检查数据和参数。','cancelled':'任务已取消。'}.get(row['status'],'任务状态已更新。')}
            return root,meta,result,group,row,args
        if kind=='dataset':
            entry=self.index(root).get(rid)
            if not isinstance(entry,dict):raise WorkspaceError('数据集不存在。',404)
            path=file_path(root/'data',entry.get('file_name'))
            group='data';result={'format':{'alpaca':'Alpaca','sharegpt':'ShareGPT'}.get(entry.get('formatting','alpaca'),'标准格式')}
        else:path=file_path(root/'exports',rid);group='export';result={}
        result.update(kind=kind,id=rid,label=meta['label'] or rid,size_bytes=path.stat().st_size,updated=path.stat().st_mtime)
        return root,meta,result,group,path,None

    def list(self,tenant):
        root=self.tenant(tenant);groups={k:[] for k in GROUPS}
        with self.connection() as c:
            identities=[('dataset',k) for k in list(self.index(root))[:200]]
            identities += [('job',r['id']) for r in c.execute('SELECT id FROM jobs WHERE tenant=? ORDER BY created DESC LIMIT 900',(tenant,))]
            for i,p in enumerate((root/'exports').rglob('*')):
                if i>=1000:break
                if p.is_file():identities.append(('export',p.relative_to(root/'exports').as_posix()))
            for kind,rid in identities:
                try:
                    _,meta,item,group,_,_=self.resource(c,tenant,kind,rid)
                    item.update(pinned=bool(meta['pinned']),archived=bool(meta['archived']),revision=meta['revision'])
                    if len(groups[group])<300:groups[group].append(item)
                except WorkspaceError:continue
            for items in groups.values():items.sort(key=lambda item:(not item['pinned'],-item['updated'],item['id']))
        return {'module':'tune','admin_id':tenant,'workspace':{'id':'default','name':'默认工作区'},'groups':[{'key':key,'items':items} for key,items in groups.items()]}

    def catalog(self,tenant):
        root=self.tenant(tenant)
        with self.connection() as c:
            return {k:v for k,v in self.index(root).items() if not any(self.metadata(c,tenant,'dataset',k)[field] for field in ['archived','deleted'])}

    def validate_selection(self,c,tenant,args):
        info=self.index(self.tenant(tenant))
        for field in ['dataset','eval_dataset']:
            for rid in str(args.get(field,'')).split(','):
                if not rid:continue
                meta=self.metadata(c,tenant,'dataset',rid)
                if rid not in info or meta['deleted'] or meta['archived']:raise WorkspaceError('所选数据集不可用，请重新选择。',409)

    def in_use(self,c,tenant,kind,rid):
        for row in c.execute("SELECT id,args FROM jobs WHERE tenant=? AND status IN ('queued','starting','running')",(tenant,)):
            args=json.loads(row['args'])
            if kind=='dataset' and any(rid in str(args.get(f,'')).split(',') for f in ['dataset','eval_dataset']):return True
            if kind=='export':
                output=args.get('export_dir','')
                if output=='/tenant/exports':return True
                if isinstance(output,str) and output.startswith('/tenant/exports/'):
                    prefix=output.removeprefix('/tenant/exports/').rstrip('/')
                    if rid==prefix or rid.startswith(prefix+'/'):return True
        return False

    def change(self,tenant,body):
        if not isinstance(body,dict) or set(body)-{'kind','id','action','label','revision'}:raise WorkspaceError('操作参数无效。')
        action=body.get('action');kind=body.get('kind');rid=body.get('id');revision=body.get('revision')
        if action not in {'pin','unpin','rename','archive','unarchive','delete'} or type(revision)!=int or revision<0:raise WorkspaceError('操作参数无效。')
        root=self.tenant(tenant)
        with workspace_lock(root),self.connection() as c:
            c.execute('BEGIN IMMEDIATE')
            _,meta,item,group,obj,args=self.resource(c,tenant,kind,rid)
            if meta['revision']!=revision:raise WorkspaceError('资源状态已更新，请刷新后重试。',409)
            if action in {'archive','delete'} and (kind=='job' and item['status'] in ACTIVE or kind!='job' and self.in_use(c,tenant,kind,rid)):
                raise WorkspaceError('资源正在使用，结束相关任务后再操作。',409)
            changes=dict(meta)
            if action=='rename':
                label=body.get('label')
                if not isinstance(label,str) or not label.strip() or len(label)>100 or any(ord(x)<32 or ord(x)==127 for x in label):raise WorkspaceError('名称应为 1 至 100 个字符。')
                changes['label']=label.strip()
            elif action in {'pin','unpin'}:changes['pinned']=int(action=='pin')
            elif action in {'archive','unarchive'}:changes['archived']=int(action=='archive')
            else:changes['deleted']=1
            # Commit the tombstone first. A disk failure never exposes a missing file
            # as usable; cleanup is retriable and only touches this resource.
            c.execute('INSERT INTO workspace_items(tenant,kind,rid,label,pinned,archived,deleted,revision) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant,kind,rid) DO UPDATE SET label=excluded.label,pinned=excluded.pinned,archived=excluded.archived,deleted=excluded.deleted,revision=excluded.revision',
                (tenant,kind,rid,changes['label'],changes['pinned'],changes['archived'],changes['deleted'],revision+1))
            if action=='delete' and kind=='job':
                c.execute('DELETE FROM jobs WHERE tenant=? AND id=?',(tenant,rid))
            c.commit()
            cleanup_pending=False
            if action=='delete' and kind!='job':
                # Keep the account-local bytes in a hidden removal area. Existing
                # task history retains immutable IDs and deletion status.
                try:
                    trash=root/'cache/workspace-deleted';trash.mkdir(exist_ok=True)
                    if trash.is_symlink():raise OSError('Invalid cleanup directory')
                    if kind=='dataset':
                        info=self.index(root);entry=info.pop(rid);atomic(root/'data/dataset_info.json',json.dumps(info,ensure_ascii=False))
                        if not any(v.get('file_name')==entry['file_name'] for v in info.values() if isinstance(v,dict)):
                            os.replace(obj,trash/(uuid.uuid4().hex+obj.suffix))
                    else:os.replace(obj,trash/(uuid.uuid4().hex+obj.suffix))
                except OSError:cleanup_pending=True
            return {'success':True,'revision':revision+1,'cleanup_pending':cleanup_pending}

    def import_dataset(self,tenant,body):
        if not isinstance(body,dict) or set(body)!={'name','cache_file'}:raise WorkspaceError('导入参数无效。')
        rid=name(body['name']);root=self.tenant(tenant)
        with workspace_lock(root),self.connection() as c:
            info=self.index(root)
            if rid in info or c.execute("SELECT 1 FROM workspace_items WHERE tenant=? AND kind='dataset' AND rid=?",(tenant,rid)).fetchone():
                raise WorkspaceError('数据集名称已使用，请使用其他名称。',409)
            source=file_path(root/'cache/gradio',body['cache_file'])
            if source.stat().st_size>64*1024**2 or source.suffix not in {'.json','.jsonl'}:raise WorkspaceError('请选择小于 64 MB 的 JSON 或 JSONL 数据集。')
            text=source.read_text('utf-8')
            rows=json.loads(text) if source.suffix=='.json' else [json.loads(line) for line in text.splitlines() if line.strip()]
            if not isinstance(rows,list) or not rows or not isinstance(rows[0],dict):raise WorkspaceError('数据集应为包含记录的列表。')
            sharegpt='conversations' in rows[0]
            for row in rows:
                if not isinstance(row,dict) or ('conversations' if sharegpt else 'instruction') not in row:raise WorkspaceError('请使用 Alpaca 或 ShareGPT 格式的数据集。')
                for field in ['images','videos','audios']:
                    media=row.get(field,[])
                    if not isinstance(media,list):raise WorkspaceError('数据集媒体字段格式无效。')
                    for value in media:
                        if isinstance(value,str) and value.startswith('/tenant/data/'):value=value.removeprefix('/tenant/data/')
                        file_path(root/'data',value)
            target=root/'data'/(rid+'.json')
            if target.exists() or target.is_symlink():raise WorkspaceError('数据集文件名称已使用，请使用其他名称。',409)
            atomic(target,json.dumps(rows,ensure_ascii=False))
            info[rid]={'file_name':target.name,**({'formatting':'sharegpt','columns':{'messages':'conversations'}} if sharegpt else {})}
            atomic(root/'data/dataset_info.json',json.dumps(info,ensure_ascii=False))
            c.execute('INSERT INTO workspace_items(tenant,kind,rid) VALUES(?,?,?)',(tenant,'dataset',rid))
            return {'success':True,'count':len(rows)}

    def detail(self,tenant,kind,rid):
        with self.connection() as c:
            root,meta,item,group,obj,args=self.resource(c,tenant,kind,rid)
            if kind=='job':
                log_path=root/'jobs'/rid/'console.log';log=''
                if log_path.exists():
                    safe=file_path(root/'jobs',rid+'/console.log')
                    with safe.open('rb') as f:f.seek(max(0,safe.stat().st_size-30000));log=f.read(30000).decode('utf-8','replace')
                log=re.sub(r'(?i)(api[_-]?key|authorization|password|token)\s*[:=]\s*[^\s,;]+',r'\1=[已隐藏]',log)
                log=re.sub(r'/home/[^\s"\']+|/opt/[^\s"\']+','[服务目录]',log)
                info=self.index(root)
                missing=[k for f in ['dataset','eval_dataset'] for k in str(args.get(f,'')).split(',') if k and (k not in info or self.metadata(c,tenant,'dataset',k)['deleted'])]
                return {'item':item,'log':log,'args':args,'missing_datasets':missing}
            return {'item':item}

    def dataset_file(self,tenant,rid):
        with self.connection() as c:return self.resource(c,tenant,'dataset',rid)[4]

    def preview(self,tenant,rid,page=0):
        if type(page)!=int or not 0<=page<=100:raise WorkspaceError('页码无效。')
        path=self.dataset_file(tenant,rid);start=page*10;rows=[]
        with path.open('r',encoding='utf-8') as f:
            if path.suffix=='.jsonl':
                i=0
                for line in f:
                    if len(line)>2*1024**2:raise WorkspaceError('单条样本过大，请下载查看。')
                    if line.strip():
                        if i>=start:rows.append(json.loads(line))
                        i+=1
                        if len(rows)==11:break
            elif path.suffix=='.json':
                buffer='';decoder=json.JSONDecoder();index=0;begun=False;need_comma=False
                while len(rows)<11:
                    if not buffer:buffer=f.read(65536)
                    buffer=buffer.lstrip()
                    if not begun:
                        if not buffer.startswith('['):raise WorkspaceError('数据集格式无效。')
                        buffer=buffer[1:];begun=True
                    buffer=buffer.lstrip()
                    if buffer.startswith(']'):break
                    if need_comma:
                        if not buffer:
                            more=f.read(65536)
                            if not more:raise WorkspaceError('数据集格式无效。')
                            buffer=more;continue
                        if not buffer.startswith(','):raise WorkspaceError('数据集格式无效。')
                        buffer=buffer[1:].lstrip();need_comma=False
                    try:row,end=decoder.raw_decode(buffer)
                    except json.JSONDecodeError:
                        more=f.read(65536)
                        if not more:raise WorkspaceError('数据集格式无效。')
                        buffer+=more
                        if len(buffer)>2*1024**2:raise WorkspaceError('单条样本过大，请下载查看。')
                        continue
                    if index>=start:rows.append(row)
                    index+=1;buffer=buffer[end:];need_comma=True
            else:raise WorkspaceError('此格式请下载查看。')
        return {'rows':rows[:10],'page':page,'has_next':len(rows)>10}
