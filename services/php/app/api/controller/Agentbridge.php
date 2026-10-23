<?php
namespace app\api\controller;

use app\common\controller\Api;
use app\common\library\LlmcenterSession;
use app\admin\library\Auth;
use think\facade\Db;
use GuzzleHttp\Client;
use Throwable;
use app\common\facade\Token;

/** Internal platform adapter. Every call retains the parent account and native RBAC. */
class Agentbridge extends Api
{
    private const RESOURCES = [
        'applications' => 'Appcenter', 'routes' => 'Airline', 'devices' => 'Equipment',
        'flight_tasks' => 'Flighttask', 'flight_records' => 'Flightrecord', 'telemetry' => 'Flightosd',
        'projects' => 'Project', 'media' => 'Media', 'model_assets' => 'Modemanage', 'alerts' => 'Hms',
    ];
    private const FIELDS = [
        'applications' => ['name','status','content','icon','launch_url'],
        'projects' => ['name','remark'],
        'routes' => ['name','project_id','airline_floder_id','type','scene','kmz_json','revision'],
    ];

    public function call(): void
    {
        $provided = (string)$this->request->header('x-llm-internal-key', '');
        if ($provided === '' || !hash_equals(LlmcenterSession::secret(), $provided)) {
            $this->error('内部请求未授权。', [], 0, null, ['statusCode'=>401]);
        }
        if (!$this->request->isPost()) $this->error('请求方式无效。', [], 0, null, ['statusCode'=>405]);
        $input = (string)$this->request->getInput();
        if (strlen($input) > 4194304) $this->error('请求内容过大。', [], 0, null, ['statusCode'=>413]);
        $body = json_decode($input, true);
        $delegated = is_array($body) && isset($body['workflow_handle']);
        $handle = is_array($body) ? ($body[$delegated ? 'workflow_handle' : 'session_handle'] ?? '') : '';
        if (!is_string($handle) || !preg_match('/^[a-f0-9]{64}$/D', $handle)) $this->deny();
        if ($delegated) {
            $row = Db::name('workflow_grant')->where('grant_hash', hash('sha256', $handle))->where('revoked', 0)->where('expires_at', '>', time())->find();
            if (!$row || !LlmcenterSession::allowed((int)$row['admin_id'], 'agent')) $this->deny();
            if (($body['workflow_id'] ?? '') !== $row['workflow_id'] || !hash_equals($row['definition_sha256'], (string)($body['definition_sha256'] ?? ''))) $this->deny();
            $identity = ['admin_id'=>(int)$row['admin_id']];
            $parent = LlmcenterSession::decryptParentToken((string)$row['token_cipher'], 'agent');
            $allowedActions = ['catalog','authorize_runos','runos_launch','authorize_tune','query','media_resolve'];
            if (!in_array($body['action'] ?? '', $allowedActions, true)) $this->forbidden();
            if (($body['action'] ?? '') === 'query' && !in_array($body['params']['resource'] ?? '', ['routes','devices','flight_tasks','media','projects'], true)) $this->forbidden();
        } else {
            $row = Db::name('llmcenter_sso_ticket')->where('session_handle_hash', hash('sha256', $handle))->whereNotNull('consumed_at')->find();
            $identity = $row ? LlmcenterSession::identity($row, 'agent') : null;
            if (!$identity) $this->deny();
            $parent = LlmcenterSession::decryptParentToken((string)$row['parent_token_cipher'], 'agent');
        }
        if (($body['tenant_id'] ?? null) !== $identity['admin_id']) $this->deny();
        $auth = Auth::instance();
        if (!$auth->init($parent) || (int)$auth->id !== $identity['admin_id']) $this->deny();
        $action = $body['action'] ?? '';
        $params = $body['params'] ?? [];
        if (!is_string($action) || !is_array($params)) $this->error('操作参数无效。', [], 0, null, ['statusCode'=>400]);
        if ($action === 'workflow_grant' || $action === 'workflow_revoke') {
            // Only a current human session may enable or revoke background grants.
            if ($delegated || !preg_match('/^[a-f0-9]{32}$/D', (string)($params['workflow_id'] ?? ''))) $this->forbidden();
            $workflowId = $params['workflow_id'];
            $grants = Db::name('workflow_grant')->where('admin_id', $identity['admin_id'])->where('workflow_id', $workflowId)->where('revoked', 0)->select();
            foreach ($grants as $grant) {
                Token::delete(LlmcenterSession::decryptParentToken((string)$grant['token_cipher'], 'agent'));
            }
            Db::name('workflow_grant')->where('admin_id', $identity['admin_id'])->where('workflow_id', $workflowId)->update(['revoked'=>1]);
            if ($action === 'workflow_revoke') $this->success('', ['tenant_id'=>$identity['admin_id'], 'revoked'=>true]);
            if (!preg_match('/^[a-f0-9]{64}$/D', (string)($params['definition_sha256'] ?? ''))) $this->invalid();
            $grantHandle = bin2hex(random_bytes(32));
            $machineToken = bin2hex(random_bytes(32));
            $duration = 30 * 86400;
            if (!Token::set($machineToken, Auth::TOKEN_TYPE, $identity['admin_id'], $duration)) $this->error('后台授权创建失败。', [], 0, null, ['statusCode'=>503]);
            try {
                Db::name('workflow_grant')->insert(['grant_hash'=>hash('sha256',$grantHandle),'admin_id'=>$identity['admin_id'],
                    'workflow_id'=>$workflowId,'definition_sha256'=>$params['definition_sha256'],
                    'token_cipher'=>LlmcenterSession::encryptParentToken($machineToken,'agent'),'expires_at'=>time()+$duration,'revoked'=>0,'created_at'=>time()]);
            } catch (Throwable $exception) { Token::delete($machineToken); throw $exception; }
            $this->success('', ['tenant_id'=>$identity['admin_id'],'workflow_handle'=>$grantHandle,'expires_at'=>time()+$duration]);
        }
        if ($action === 'catalog') {
            $resources = [];
            foreach (self::RESOURCES as $name=>$controller) {
                if ($auth->check(strtolower($controller).'/index')) {
                    $resources[$name] = ['read'=>true, 'create'=>isset(self::FIELDS[$name]) && $auth->check(strtolower($controller).'/add'), 'update'=>isset(self::FIELDS[$name]) && $auth->check(strtolower($controller).'/edit')];
                }
            }
            $this->success('', ['tenant_id'=>$identity['admin_id'], 'resources'=>$resources, 'tune'=>LlmcenterSession::allowed($identity['admin_id'],'tune'), 'flight_dispatch'=>$auth->check('flighttask/add')]);
        }
        if ($action === 'authorize_tune') {
            if (!LlmcenterSession::allowed($identity['admin_id'], 'tune')) $this->forbidden();
            $this->success('', ['tenant_id'=>$identity['admin_id'], 'allowed'=>true]);
        }
        if ($action === 'authorize_runos' || $action === 'runos_launch') {
            $this->permission($auth, 'appcenter/index');
            if ($action === 'authorize_runos') $this->success('', ['tenant_id'=>$identity['admin_id'],'allowed'=>true]);
            $result=$this->native('Appcenter','launchRunos','POST',[],$parent,90);
            if (($result['admin_id']??0)!==$identity['admin_id'] || empty($result['ticket'])) $this->error('应用登录信息无效。',[],0,null,['statusCode'=>503]);
            // Ticket remains on this authenticated internal channel and is consumed by
            // the connector. It is never included in Agent tool or browser responses.
            $this->success('', ['tenant_id'=>$identity['admin_id'],'ticket'=>$result['ticket']]);
        }
        $resource = $params['resource'] ?? '';
        if (!is_string($resource) || !isset(self::RESOURCES[$resource])) $this->invalid();
        $controller = self::RESOURCES[$resource];
        if ($action === 'media_resolve') {
            if ($resource !== 'media' || array_diff(array_keys($params), ['resource', 'id'])) $this->invalid();
            $this->permission($auth, 'media/index');
            $id = $this->integer($params['id'] ?? null, 1, 2147483647);
            $result = $this->native('Media', 'index', 'GET', ['limit'=>1, 'search'=>[['field'=>'id','operator'=>'=','val'=>(string)$id]]], $parent);
            if (empty($result['list'])) $this->error('媒体不存在或无权访问。', [], 0, null, ['statusCode'=>404]);
            $asset = $result['list'][0];
            $path = (string)($asset['path'] ?? '');
            $decoded = rawurldecode($path);
            for ($round = 0; $round < 2; $round++) $decoded = rawurldecode($decoded);
            if (str_contains($decoded, '\\')) $this->invalid();
            if ($path === '' || preg_match('/[\x00-\x20]/u', $path) || preg_match('~(?:^|/)\.\.(?:/|$)~', $decoded)) $this->invalid();
            if (str_starts_with($path, '/storage/') || str_starts_with($path, '/uploads/')) {
                $url = 'http://127.0.0.1:1819' . $path;
            } else {
                $upload = get_sys_config('', 'upload');
                $origin = parse_url((string)($upload['upload_url'] ?? ''));
                $urlParts = parse_url($path);
                if (!is_array($origin) || !is_array($urlParts) || empty($origin['host']) || empty($urlParts['host']) || !in_array($urlParts['scheme'] ?? '', ['http','https'], true)
                    || strtolower($urlParts['host'] ?? '') !== strtolower($origin['host'] ?? '')
                    || ($urlParts['scheme'] ?? '') !== ($origin['scheme'] ?? '')
                    || ($urlParts['port'] ?? (($urlParts['scheme'] ?? '') === 'https' ? 443 : 80)) !== ($origin['port'] ?? (($origin['scheme'] ?? '') === 'https' ? 443 : 80))
                    || isset($urlParts['user']) || isset($urlParts['pass'])) {
                    $this->error('媒体文件不在已配置的存储服务中，请通过资源库上传。', [], 0, null, ['statusCode'=>422]);
                }
                $url = $path;
            }
            $this->success('', ['tenant_id'=>$identity['admin_id'], 'asset'=>$this->redact($asset), 'download_url'=>$url]);
        }
        if ($action === 'query') {
            if (array_diff(array_keys($params), ['resource','id','page','limit','filters'])) $this->invalid();
            $this->permission($auth, strtolower($controller).'/index');
            $query = ['page'=>$this->integer($params['page'] ?? 1, 1, 10000), 'limit'=>$this->integer($params['limit'] ?? 20,1,100)];
            $filters = $params['filters'] ?? [];
            if (!is_array($filters) || count($filters)>6) $this->invalid();
            if (isset($params['id'])) $filters['id'] = $this->integer($params['id'],1,2147483647);
            $allowed = ['id','name','status','project_id','equipment_id','airline_id','sn','nickname'];
            if ($resource === 'media') $allowed[] = 'flight_id';
            foreach ($filters as $field=>$value) {
                if (!in_array($field,$allowed,true) || !is_scalar($value) || strlen((string)$value)>160) $this->invalid();
                $query['search'][] = ['field'=>$field, 'operator'=>in_array($field,['name','nickname'],true)?'LIKE':'=', 'val'=>(string)$value];
            }
            $result = $this->native($controller, 'index', 'GET', $query, $parent);
            if ($resource==='routes') foreach ($result['list']??[] as $i=>$route) if (is_string($route['kmz_json']??null)) {$decoded=json_decode($route['kmz_json'],true);if (is_array($decoded)) $result['list'][$i]['kmz_json']=$decoded;}
            $this->success('', ['tenant_id'=>$identity['admin_id'], 'result'=>$this->redact($result)]);
        }
        if ($action === 'flight_validate' || $action === 'flight_dispatch') {
            if ($resource !== 'flight_tasks') $this->invalid();
            $this->permission($auth,'flighttask/add');
            $data = $params['data'] ?? [];
            $allowed = ['name','equipment_id','airline_id','task_type','execute_time','rth_altitude','rth_mode','out_of_control_action','exit_wayline_when_rc_lost','wayline_precision_type'];
            if (!is_array($data) || array_diff(array_keys($data),$allowed)) $this->invalid();
            $data['equipment_id']=$this->integer($data['equipment_id'] ?? null,1,2147483647);
            $data['airline_id']=$this->integer($data['airline_id'] ?? null,1,2147483647);
            $data['task_type']=$this->integer($data['task_type'] ?? null,0,1);
            $data['name']=$this->text($data['name'] ?? '',100);
            if ($data['task_type']===1) $data['execute_time']=$this->integer($data['execute_time'] ?? null,time()+30,time()+31536000);
            else $data['execute_time']=time();
            $data['rth_altitude']=$this->integer($data['rth_altitude'] ?? null,20,500);
            foreach (['rth_mode'=>1,'out_of_control_action'=>2,'exit_wayline_when_rc_lost'=>1,'wayline_precision_type'=>1] as $key=>$max) $data[$key]=$this->integer($data[$key] ?? 0,0,$max);
            // Query through the native controllers, preserving their data-level restrictions.
            foreach (['devices'=>['Equipment',$data['equipment_id']], 'routes'=>['Airline',$data['airline_id']]] as $kind=>$ref) {
                $this->permission($auth,strtolower($ref[0]).'/index');
                $v=$this->native($ref[0],'index','GET',['limit'=>1,'search'=>[['field'=>'id','operator'=>'=','val'=>(string)$ref[1]]]],$parent);
                if (empty($v['list'])) $this->error('设备或航线不存在，或当前账号无权访问。',[],0,null,['statusCode'=>404]);
                $entities[$kind]=$this->redact($v['list'][0]);
            }
            if (str_starts_with((string)($entities['routes']['kmz']??''),'/storage/routes/')) {
                $upload=get_sys_config('','upload');
                // Locally saved geometry is valid for editing. A device task also
                // needs a real, configured download service before it can be dispatched.
                if (!is_array($upload) || ($upload['upload_mode']??'')!=='alioss' || empty($upload['upload_access_id']) || empty($upload['upload_secret_key']) || empty($upload['upload_bucket']) || empty($upload['upload_url'])) {
                    $this->error('航线文件下载服务尚未配置。',['code'=>'ROUTE_DOWNLOAD_UNAVAILABLE','errors'=>[['field'=>'airline_id','code'=>'NOT_READY','message'=>'请先配置设备可访问的航线文件存储服务。']]],0,null,['statusCode'=>422]);
                }
            }
            if ($action==='flight_validate') $this->success('', ['tenant_id'=>$identity['admin_id'],'data'=>$data,'entities'=>$entities]);
            $result=$this->native('Flighttask','add','POST',$data,$parent,35);
            $this->success('', ['tenant_id'=>$identity['admin_id'],'result'=>$this->redact($result)]);
        }
        if (in_array($action,['route_create','route_update','route_validate'],true)) {
            if ($resource!=='routes' || array_diff(array_keys($params),['resource','id','data'])) $this->invalid();
            $edit=$action==='route_update';$data=$params['data']??[];
            if (!is_array($data)) $this->invalid();
            $contract=\app\common\library\RouteDocument::contract();
            foreach (array_keys($data) as $key) if (!in_array($key,['name','project_id','airline_floder_id','type','scene','kmz_json','revision'],true)) {
                $this->error('航线参数校验未通过。',['code'=>'VALIDATION_FAILED','errors'=>[['field'=>$key,'code'=>'UNKNOWN_FIELD','message'=>'此字段不受支持。']]],0,null,['statusCode'=>422]);
            }
            if ($action==='route_validate') {
                $this->permission($auth,'airline/index');
                try {$parsed=\app\common\library\RouteDocument::parse($data['kmz_json']??null);}
                catch (\app\common\library\RouteValidation $e) {$this->error($e->getMessage(),['code'=>'VALIDATION_FAILED','errors'=>$e->errors],0,null,['statusCode'=>$e->status]);}
                $this->success('', ['tenant_id'=>$identity['admin_id'],'result'=>$parsed]);
            }
            if (array_key_exists('kmz_json',$data)) {
                try {$data['kmz_json']=\app\common\library\RouteDocument::parse($data['kmz_json'])['document'];}
                catch (\app\common\library\RouteValidation $e) {$this->error($e->getMessage(),['code'=>'VALIDATION_FAILED','errors'=>$e->errors],0,null,['statusCode'=>$e->status]);}
            }
            $this->permission($auth,$edit?'airline/edit':'airline/add');$this->permission($auth,'airline/index');$this->permission($auth,'project/index');
            if ($edit) {
                $data['id']=$this->integer($params['id']??null,1,2147483647);
                if (empty($data['revision'])) $this->error('航线参数校验未通过。',['code'=>'VALIDATION_FAILED','errors'=>[['field'=>'revision','code'=>'REQUIRED','message'=>'请提供查询结果中的航线版本。']]],0,null,['statusCode'=>422]);
            }
            $result=$this->native('Airline',$edit?'edit':'add','POST',$data,$parent,90);
            if (isset($result['route']['kmz_json']) && is_string($result['route']['kmz_json'])) $result['route']['kmz_json']=json_decode($result['route']['kmz_json'],true);
            $this->success('', ['tenant_id'=>$identity['admin_id'],'result'=>['completed'=>true]+$this->redact($result)]);
        }
        if ($action !== 'create' && $action !== 'update') $this->invalid();
        if (!isset(self::FIELDS[$resource])) $this->invalid();
        if (array_diff(array_keys($params),['resource','id','data'])) $this->invalid();
        $nativeAction = $action==='create'?'add':'edit';
        $this->permission($auth,strtolower($controller).'/'.$nativeAction);
        $data = $params['data'] ?? [];
        if (!is_array($data) || !$data || array_diff(array_keys($data),self::FIELDS[$resource])) $this->invalid();
        if (isset($data['name'])) $data['name']=$this->text($data['name'],100);
        if ($action==='create' && empty($data['name'])) $this->invalid();
        if (isset($data['status'])) $data['status']=$this->integer($data['status'],0,1);
        if (isset($data['project_id'])) $data['project_id']=$this->integer($data['project_id'],1,2147483647);
        foreach (['remark','content','icon','launch_url'] as $field) {
            if (isset($data[$field]) && (!is_string($data[$field]) || strlen($data[$field])>8000)) $this->invalid();
        }
        if (isset($data['launch_url'])) {
            $u=parse_url($data['launch_url']);
            if (!$u || isset($u['user']) || isset($u['pass']) || !in_array($u['scheme'] ?? '',['http','https'],true)) $this->invalid();
        }
        if ($resource==='routes' && $action==='create') $this->error('创建航线需要使用航线规划操作。',[],0,null,['statusCode'=>400]);
        if ($action==='update') $data['id']=$this->integer($params['id'] ?? null,1,2147483647);
        $result = $this->native($controller,$nativeAction,'POST',$data,$parent);
        $this->success('', ['tenant_id'=>$identity['admin_id'],'result'=>$this->redact($result)]);
    }

    private function native(string $controller,string $action,string $method,array $data,string $parent,int $timeout=15): array
    {
        try {
            $url='http://127.0.0.1/index.php';
            $options=['headers'=>['ba-token'=>$parent,'Accept'=>'application/json'],'allow_redirects'=>false,'http_errors'=>false,'connect_timeout'=>3,'timeout'=>$timeout];
            $options['query']=['s'=>'/admin/'.$controller.'/'.$action]+($method==='GET'?$data:[]);
            if ($method!=='GET') {
                if ($controller==='Airline' && is_array($data['kmz_json']??null)) $data['kmz_json']=json_encode($data['kmz_json'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
                $options['form_params']=$data;
            }
            $res=(new Client())->request($method,$url,$options);
            $body=json_decode((string)$res->getBody(),true);
        } catch (Throwable) {$this->error('业务接口暂时不可用。',[],0,null,['statusCode'=>503]);}
        if (!is_array($body) || ($body['code'] ?? 0)!==1) {
            $msg=is_array($body) && is_string($body['msg'] ?? null)?$body['msg']:'业务操作未完成。';
            $status=$res->getStatusCode();$status=in_array($status,[400,401,403,404,409,413,422,503],true)?$status:400;
            $error=is_array($body['data']??null)?$body['data']:[];
            $this->error($msg,$this->redact($error),0,null,['statusCode'=>$status]);
        }
        return is_array($body['data'] ?? null)?$body['data']:['completed'=>true];
    }
    private function permission(Auth $auth,string $rule): void {if (!$auth->check($rule)) $this->forbidden();}
    private function forbidden(): never {$this->error('当前账号无权执行此操作。',[],0,null,['statusCode'=>403]);}
    private function deny(): never {$this->error('平台登录已失效，请重新进入 Agent 中心。',[],0,null,['statusCode'=>401]);}
    private function invalid(): never {$this->error('操作参数无效。',[],0,null,['statusCode'=>400]);}
    private function integer(mixed $value,int $min,int $max): int {
        if (!(is_int($value) || (is_string($value) && preg_match('/^\d+$/D',$value)))) $this->invalid();
        $n=(int)$value;if ($n<$min || $n>$max) $this->invalid();return $n;
    }
    private function text(mixed $value,int $max): string {
        if (!is_string($value) || $value==='' || mb_strlen($value)>$max || preg_match('/[\x00-\x1f<>]/u',$value)) $this->invalid();return $value;
    }
    private function redact(mixed $value): mixed {
        if (!is_array($value)) return $value;
        $out=[];foreach ($value as $k=>$v) {
            if (is_string($k) && preg_match('/password|secret|token|api[_-]?key|access[_-]?(id|key)|credentials?/i',$k)) continue;
            $out[$k]=$this->redact($v);
        }return $out;
    }
}
