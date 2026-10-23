<?php

namespace app\admin\controller;

use Throwable;
use app\common\controller\Backend;
use ZipArchive;
use modules\alioss\Alioss;

/**
 * 航线管理
 */
class Airline extends Backend
{
    /**
     * Airline模型对象
     * @var object
     * @phpstan-var \app\admin\model\Airline
     */
    protected object $model;

    protected array|string $preExcludeFields = ['id', 'create_time', 'update_time'];

    protected array $withJoinTable = ['project'];

    protected string|array $quickSearchField = ['id'];

    public function initialize(): void
    {
        parent::initialize();
        $this->model = new \app\admin\model\Airline();
    }

    /**
     * Prefer the DJI-uploaded local copy, then fetch from OSS when needed.
     */
    private function downloadRouteFile(string $url, string $destination, string $label): void
    {
        $urlPath     = parse_url($url, PHP_URL_PATH);
        $storageRoot = realpath(public_path() . 'storage');
        if (is_string($urlPath) && $storageRoot !== false && str_starts_with($urlPath, '/storage/')) {
            $localPath = realpath(public_path() . ltrim($urlPath, '/\\'));
            $prefix    = rtrim($storageRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
            $insideStorage = $localPath !== false && (DIRECTORY_SEPARATOR === '\\'
                ? stripos($localPath, $prefix) === 0
                : str_starts_with($localPath, $prefix));

            if ($insideStorage && is_file($localPath)) {
                if (!@copy($localPath, $destination)) {
                    throw new \RuntimeException($label . '本地文件复制失败。');
                }
                return;
            }
        }

        $temporaryFile = $destination . '.' . bin2hex(random_bytes(8)) . '.part';
        try {
            $response = (new \GuzzleHttp\Client([
                'connect_timeout' => 10,
                'timeout'         => 60,
            ]))->request('GET', $url, [
                'http_errors' => false,
                'sink'        => $temporaryFile,
            ]);
        } catch (Throwable $e) {
            @unlink($temporaryFile);
            throw new \RuntimeException($label . '下载失败，请检查网络连接和 DJI OSS 文件地址。', 0, $e);
        }

        $statusCode = $response->getStatusCode();
        if ($statusCode !== 200) {
            @unlink($temporaryFile);
            throw new \RuntimeException(sprintf(
                'DJI OSS 上的%s文件不可用（HTTP %d），请重新上传模板和航线文件后再保存。',
                $label,
                $statusCode
            ));
        }

        if (!is_file($temporaryFile) || filesize($temporaryFile) === 0 || !rename($temporaryFile, $destination)) {
            @unlink($temporaryFile);
            throw new \RuntimeException($label . '下载结果为空或无法写入本地临时目录。');
        }
    }

    /**
     * 查看
     * @throws Throwable
     */
    public function index(): void
    {
        // 如果是 select 则转发到 select 方法，若未重写该方法，其实还是继续执行 index
        if ($this->request->param('select')) {
            $this->select();
        }

        /**
         * 1. withJoin 不可使用 alias 方法设置表别名，别名将自动使用关联模型名称（小写下划线命名规则）
         * 2. 以下的别名设置了主表别名，同时便于拼接查询参数等
         * 3. paginate 数据集可使用链式操作 each(function($item, $key) {}) 遍历处理
         */
        list($where, $alias, $limit, $order) = $this->queryBuilder();
        $res = $this->model
            ->withJoin($this->withJoinTable, $this->withJoinType)
            ->visible(['project' => ['name']])
            ->alias($alias)
            ->where($where)
            ->order($order)
            ->paginate($limit);

        $this->success('', [
            'list'   => array_map(function($item) { $r=is_array($item)?$item:$item->toArray(); $r['revision']=\app\common\library\RouteDocument::revision($r); return $r; },$res->items()),
            'total'  => $res->total(),
            'remark' => get_route_remark(),
        ]);
    }

    /** JSON and native editor writes share this service; omitted fields are unchanged. */
    public function add(): void { $this->saveRoute(false); }
    public function edit(): void {
        if ($this->request->isPost() || $this->request->isPut() || $this->request->isPatch()) {$this->saveRoute(true);return;}
        $row=$this->accessibleRow($this->request->param('id'));
        $r=$row->toArray();$r['revision']=\app\common\library\RouteDocument::revision($r);
        $this->success('', ['row'=>$r]);
    }
    private function accessibleRow(mixed $id,bool $lock=false): \app\admin\model\Airline {
        $id=\app\common\library\RouteDocument::number($id,'id',1,2147483647,true);
        $q=$this->model->where('id',$id);if ($lock) $q=$q->lock(true);$row=$q->find();
        if (!$row) throw new \app\common\library\RouteValidation([['field'=>'id','code'=>'NOT_FOUND','message'=>'航线不存在。']],404);
        $ids=$this->getDataLimitAdminIds();
        if ($ids && !in_array($row[$this->dataLimitField],$ids)) throw new \app\common\library\RouteValidation([['field'=>'id','code'=>'FORBIDDEN','message'=>'当前账号无权访问此航线。']],403);
        return $row;
    }
    private function saveRoute(bool $edit): void {
        $newFiles=[];$tempDir=null;$saved=null;
        $this->model->startTrans();
        try {
            $D=\app\common\library\RouteDocument::class;
            $data=$this->request->post();
            if (!$data && str_contains((string)$this->request->header('content-type'),'application/json')) {
                try {$data=json_decode($this->request->getInput(),true,64,JSON_THROW_ON_ERROR);} catch (\JsonException) {$D::fail('$','JSON 格式无效。','INVALID_JSON',400);}
            }
            if (!is_array($data) || !$data) $D::fail('$','请提供需要保存的字段。','REQUIRED');
            $row=$edit?$this->accessibleRow($data['id']??$this->request->param('id'),true):null;
            $current=$row?$row->toArray():[];
            if (isset($data['revision']) && (!is_string($data['revision']) || !hash_equals($D::revision($current),$data['revision']))) $D::fail('revision','航线已被修改，请重新读取后提交。','VERSION_CONFLICT',409);
            unset($data['revision']);$data=$this->excludeFields($data);
            $allowed=['name','project_id','airline_floder_id','type','scene','kmz_json','template','wayline','point_num','total_point','mileage','execution_time','kmz','kmz_md5'];
            foreach (array_keys($data) as $k) if (!in_array($k,$allowed,true)) $D::fail($k,'此字段不受支持。','UNKNOWN_FIELD');
            if (isset($data['name'])) {
                $data['name']=trim($data['name']);
                if ($data['name']==='' || mb_strlen($data['name'])>80 || preg_match('/[<>:"\/\\\\|?*\x00-\x1f]/u',$data['name'])) $D::fail('name','名称须为 1 至 80 个字符，且不能包含文件路径字符。');
            } elseif (!$edit) $D::fail('name','请填写航线名称。','REQUIRED');
            $name=$data['name']??$current['name'];
            if (isset($data['project_id'])) $data['project_id']=$D::number($data['project_id'],'project_id',1,2147483647,true);
            elseif (!$edit) $D::fail('project_id','请选择所属项目。','REQUIRED');
            if ($edit && isset($data['project_id']) && $data['project_id']!=(int)$current['project_id']) $D::fail('project_id','此接口不支持迁移所属项目。','READ_ONLY');
            if ($edit && isset($data['airline_floder_id']) && $data['airline_floder_id']!=($current['airline_floder_id']??0)) $D::fail('airline_floder_id','此接口不支持迁移航线分组。','READ_ONLY');
            $project=\app\admin\model\Project::find($data['project_id']??$current['project_id']);
            if (!$project) $D::fail('project_id','项目不存在。','NOT_FOUND',404);
            $ids=$this->getDataLimitAdminIds();
            if ($ids && isset($project[$this->dataLimitField]) && !in_array($project[$this->dataLimitField],$ids)) $D::fail('project_id','当前账号无权访问此项目。','FORBIDDEN',403);
            $duplicates=$this->model->where('name',$name)->where('project_id',$data['project_id']??$current['project_id']);
            if ($edit) $duplicates=$duplicates->where('id','<>',$current['id']);
            if ($duplicates->lock(true)->find()) $D::fail('name','当前项目已有同名航线。','NAME_CONFLICT',409);
            $xml=null;
            if (array_key_exists('kmz_json',$data)) {
                $parsed=$D::parse($data['kmz_json']);$doc=$parsed['document'];unset($parsed['document']);
                $data=array_merge($data,$parsed);$data['kmz_json']=json_encode($doc,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
                $xml=[$D::xml($doc,$name),$D::xml($doc,$name,true)];
            } elseif (!$edit && !isset($data['template'],$data['wayline'])) $D::fail('kmz_json','请提供航线 JSON 或已上传的模板和航线文件。','REQUIRED');
            if ($xml || isset($data['template']) || isset($data['wayline'])) {
                $token=bin2hex(random_bytes(16));$relative='storage/routes/admin-'.$this->auth->id.'/'.$token;
                $dir=public_path().$relative;if (!mkdir($dir,0755,true)) throw new \RuntimeException('Cannot create route directory');
                foreach ([public_path().'storage/routes',public_path().'storage/routes/admin-'.$this->auth->id,$dir] as $directory) chmod($directory,0755);
                $newFiles=[$dir.'/template.kml',$dir.'/waylines.wpml',$dir.'/route.kmz'];
                if ($xml) {
                    foreach ([$xml[0],$xml[1]] as $i=>$content) if (file_put_contents($newFiles[$i],$content,LOCK_EX)===false) throw new \RuntimeException('Cannot write route XML');
                } else {
                    $endpoint=rtrim(env('oss.cdn_base','https://djiapis.oss-cn-chengdu.aliyuncs.com'),'/');
                    foreach (['template','wayline'] as $i=>$key) {
                        $url=$data[$key]??$current[$key]??null;
                        if (!is_string($url) || !str_starts_with($url,'/') || str_contains($url,'..')) $D::fail($key,'文件地址无效。');
                        $this->downloadRouteFile($endpoint.$url,$newFiles[$i],$key);
                    }
                }
                foreach (array_slice($newFiles,0,2) as $file) {
                    $content=file_get_contents($file);
                    if (stripos($content,'<!DOCTYPE')!==false || stripos($content,'<!ENTITY')!==false) $D::fail('kmz_json','航线文件不能包含实体声明。');
                    $dom=new \DOMDocument();if (!@$dom->loadXML($content,LIBXML_NONET) || $dom->documentElement->localName!=='kml') $D::fail('kmz_json','航线 XML 格式无效。');
                }
                $zip=new ZipArchive();if ($zip->open($newFiles[2],ZipArchive::CREATE|ZipArchive::EXCL)!==true) throw new \RuntimeException('Cannot create KMZ');
                if (!$zip->addFile($newFiles[0],'wpmz/template.kml') || !$zip->addFile($newFiles[1],'wpmz/waylines.wpml') || !$zip->close()) throw new \RuntimeException('Cannot finish KMZ');
                $data['template']='/'.$relative.'/template.kml';$data['wayline']='/'.$relative.'/waylines.wpml';
                $data['kmz']='/'.$relative.'/route.kmz';$data['kmz_md5']=md5_file($newFiles[2]);
                // Immutable version files also keep already dispatched task URLs intact.
                $upload=get_sys_config('','upload');
                if (($upload['upload_mode']??'')==='alioss' && !empty($upload['upload_access_id']) && !empty($upload['upload_secret_key']) && !empty($upload['upload_bucket']) && !empty($upload['upload_url'])) {
                    $oss=new \OSS\OssClient($upload['upload_access_id'],$upload['upload_secret_key'],$upload['upload_url'].'.aliyuncs.com');
                    $oss->uploadFile($upload['upload_bucket'],ltrim($data['kmz'],'/'),$newFiles[2]);
                }
            }
            if (!$edit && $this->dataLimit && $this->dataLimitFieldAutoFill) $data[$this->dataLimitField]=$this->auth->id;
            $target=$row??$this->model;
            if ($target->save($data)===false) throw new \RuntimeException('Database save failed');
            $saved=$this->model->where('id',$target['id'])->find()->toArray();$this->model->commit();$newFiles=[];
        } catch (\app\common\library\RouteValidation $e) {
            $this->model->rollback();$this->cleanupRouteFiles($newFiles);
            $this->error($e->getMessage(),['code'=>$e->status===409?'CONFLICT':'VALIDATION_FAILED','errors'=>$e->errors,'request_id'=>bin2hex(random_bytes(12))],0,null,['statusCode'=>$e->status]);
        } catch (Throwable $e) {
            $this->model->rollback();$this->cleanupRouteFiles($newFiles);trace('Route save failed: '.$e->getMessage(),'error');
            error_log('Route save failed: '.$e->getMessage());
            $this->error('航线保存失败，请稍后重试。',['code'=>'ROUTE_SAVE_FAILED','request_id'=>bin2hex(random_bytes(12))],0,null,['statusCode'=>503]);
        }
        $saved['revision']=\app\common\library\RouteDocument::revision($saved);
        $this->success($edit?'航线已更新。':'航线已创建。',['route'=>$saved,'status'=>$edit?200:201]);
    }
    private function cleanupRouteFiles(array $files): void {
        foreach ($files as $file) if (str_starts_with($file,public_path().'storage/routes/') && is_file($file)) @unlink($file);
        if ($files && is_dir(dirname($files[0]))) @rmdir(dirname($files[0]));
    }
}
