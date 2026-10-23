<?php
/* Component harness: original Runos::exchange + real ThinkORM/PDO SQLite.
 * Api below adapts transport only. It is not the production ThinkPHP bootstrap.
 */
namespace app\common\controller {
    class HarnessResponse extends \Exception {
        public function __construct(public array $payload, public int $httpStatus) { parent::__construct('component response'); }
    }
    class Api {
        public $request;
        public function __construct($request) { $this->request=$request; }
        public function error($message,$data=[],$code=0,$type=null,$extend=[]):void {
            throw new HarnessResponse(['code'=>$code,'msg'=>$message,'data'=>$data],$extend['statusCode']??400);
        }
        public function success($message='',$data=[]):void { throw new HarnessResponse(['code'=>1,'msg'=>$message,'data'=>$data],200); }
    }
}
namespace {
    if (PHP_SAPI !== 'cli-server' || getenv('RUNOS_TEST_ISOLATED') !== '1') { throw new \RuntimeException('Isolated component harness only'); }
    $maps=[];$autoloadFiles=[];
    foreach(['topthink/think-orm','topthink/think-helper','psr/simple-cache','psr/log'] as $package){
        $base='/work/php/vendor/'.$package.'/';$metadata=json_decode(file_get_contents($base.'composer.json'),true);
        foreach($metadata['autoload']['psr-4']??[] as $prefix=>$paths)foreach((array)$paths as $path)$maps[$prefix][]=$base.$path.'/';
        foreach($metadata['autoload']['files']??[] as $file)$autoloadFiles[]=$base.$file;
    }
    uksort($maps,fn($a,$b)=>strlen($b)<=>strlen($a));
    spl_autoload_register(function($class)use($maps){
        foreach($maps as $prefix=>$paths)if(str_starts_with($class,$prefix))foreach($paths as $path){
            $file=$path.str_replace('\\','/',substr($class,strlen($prefix))).'.php';
            if(is_file($file)){require $file;return;}
        }
    });
    foreach($autoloadFiles as $file)require_once $file;
    require '/harness/Runos.php';
    class ComponentRequest {
        public function post($key,$default=''){return $_POST[$key]??$default;}
        public function getInput(){return file_get_contents('php://input');}
    }
    header('Content-Type: application/json');
    try {
        \think\facade\Db::setConfig(['default'=>'sqlite','connections'=>['sqlite'=>['type'=>'sqlite','database'=>getenv('RUNOS_COMPONENT_DB'),'prefix'=>'','debug'=>false,'fields_strict'=>true]]]);
        (new \app\api\controller\Runos(new ComponentRequest()))->exchange();
    } catch(\app\common\controller\HarnessResponse $result) {
        http_response_code($result->httpStatus);echo json_encode($result->payload,JSON_UNESCAPED_UNICODE);
    } catch(\Throwable $error) {
        /* This is harness exception handling, not evidence of the production error middleware. */
        file_put_contents('/results/php-component-errors.log',get_class($error).':'.$error->getMessage()."\n",FILE_APPEND);
        http_response_code(503);echo json_encode(['code'=>0,'msg'=>'component unavailable','data'=>[]]);
    }
}
