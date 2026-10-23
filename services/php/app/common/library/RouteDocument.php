<?php
namespace app\common\library;

/** Shared route JSON validation and WPML serialization for UI, REST and MCP. */
class RouteValidation extends \RuntimeException
{
    public function __construct(public array $errors, public int $status = 422) { parent::__construct('航线参数校验未通过。'); }
}

class RouteDocument
{
    public static function contract(): array { return json_decode(file_get_contents(__DIR__.'/route-contract.json'), true, 512, JSON_THROW_ON_ERROR); }
    public static function fail(string $field, string $message, string $code='INVALID_VALUE', int $status=422): never {
        throw new RouteValidation([['field'=>$field,'code'=>$code,'message'=>$message]], $status);
    }
    public static function number(mixed $value, string $field, float $min, float $max, bool $integer=false): int|float {
        if (is_bool($value) || (!is_int($value) && !is_float($value) && !(is_string($value) && preg_match('/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/D', $value)))) self::fail($field,'此字段须为有效数值。','INVALID_NUMBER');
        $n=0+$value;
        if (!is_finite((float)$n) || $n<$min || $n>$max || ($integer && floor($n)!=$n)) self::fail($field,"数值须在 {$min} 至 {$max} 之间".($integer?'，且为整数。':'。'),'OUT_OF_RANGE');
        return $integer?(int)$n:$n;
    }
    private static function normalize(mixed $v, string $path, array $rules, int $depth=0, string $key=''): mixed {
        if ($depth>32) self::fail($path,'数据嵌套超过允许层级。','TOO_DEEP');
        if (isset($rules[$key])) return self::number($v,$path,$rules[$key][0],$rules[$key][1],$rules[$key][2]??false);
        if (is_array($v)) {
            $out=[];foreach ($v as $k=>$child) {
                if (is_string($k) && !preg_match('/^[A-Za-z_][A-Za-z0-9_.-]*$/D',$k)) self::fail($path,'字段名称无效。','INVALID_FIELD');
                $out[$k]=self::normalize($child,$path.(is_int($k)?"[{$k}]":'.'.$k),$rules,$depth+1,(string)$k);
            }return $out;
        }
        if (!is_scalar($v) || (is_string($v) && (strlen($v)>16000 || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$v)))) self::fail($path,'字段内容无效。');
        return $v;
    }
    private static function coordinates(mixed $value, string $path, bool $latitudeFirst=false): array {
        $parts=is_string($value)?explode(',',$value):$value;
        if (!is_array($parts) || count($parts)<2 || count($parts)>3) self::fail($path,'坐标须包含经度、纬度及可选高度。','INVALID_COORDINATES');
        $a=self::number(is_string($parts[0])?trim($parts[0]):$parts[0],$path.'[0]',$latitudeFirst?-85:-180,$latitudeFirst?85:180);
        $b=self::number(is_string($parts[1])?trim($parts[1]):$parts[1],$path.'[1]',$latitudeFirst?-180:-85,$latitudeFirst?180:85);
        return [$a,$b,isset($parts[2])?self::number(is_string($parts[2])?trim($parts[2]):$parts[2],$path.'[2]',-500,10000):0];
    }
    public static function parse(mixed $raw): array {
        $c=self::contract();
        if (is_string($raw)) {
            if (strlen($raw)>$c['max_bytes']) self::fail('kmz_json','航线内容不能超过 4 MB。','TOO_LARGE');
            try {$raw=json_decode($raw,true,64,JSON_THROW_ON_ERROR);} catch (\JsonException) {
                // The legacy request filter HTML-escapes string form fields.
                try {$raw=json_decode(html_entity_decode($raw,ENT_QUOTES|ENT_HTML5,'UTF-8'),true,64,JSON_THROW_ON_ERROR);} catch (\JsonException) {self::fail('kmz_json','JSON 格式无效。','INVALID_JSON',400);}
            }
        }
        if (!is_array($raw) || array_is_list($raw)) self::fail('kmz_json','航线内容须为 JSON 对象。','INVALID_TYPE');
        if (strlen(json_encode($raw))>$c['max_bytes']) self::fail('kmz_json','航线内容不能超过 4 MB。','TOO_LARGE');
        foreach (array_keys($raw) as $key) if (!in_array($key,['missionConfig','Folder','shipStartPoint','shipLanes','routePlanner','droneroute'],true)) self::fail('kmz_json.'.$key,'此字段不受支持。','UNKNOWN_FIELD');
        if (isset($raw['droneroute'])) {
            $editor=$raw['droneroute'];
            if (!is_array($editor) || array_diff(array_keys($editor),['version','pois']) || ($editor['version']??null)!=='0.5.0' || !is_array($editor['pois']??null) || !array_is_list($editor['pois']) || count($editor['pois'])>1000) self::fail('kmz_json.droneroute','兴趣点信息无效。');
            $ids=[];
            foreach ($editor['pois'] as $i=>&$poi) {
                $path='kmz_json.droneroute.pois['.$i.']';
                if (!is_array($poi) || array_diff(array_keys($poi),['id','name','latitude','longitude','height']) || !is_string($poi['id']??null) || $poi['id']==='' || strlen($poi['id'])>100 || isset($ids[$poi['id']]) || !is_string($poi['name']??null) || mb_strlen($poi['name'])>100) self::fail($path,'兴趣点名称或标识无效。');
                $ids[$poi['id']]=true;
                $poi['latitude']=self::number($poi['latitude']??null,$path.'.latitude',-85,85);
                $poi['longitude']=self::number($poi['longitude']??null,$path.'.longitude',-180,180);
                $poi['height']=self::number($poi['height']??0,$path.'.height',-500,10000);
            } unset($poi);
            $raw['droneroute']=$editor;
        }
        foreach (['missionConfig','Folder'] as $key) if (!isset($raw[$key]) || !is_array($raw[$key]) || array_is_list($raw[$key])) self::fail('kmz_json.'.$key,'缺少必需的配置对象。','REQUIRED');
        // The legacy document is authoritative. An embedded planner snapshot may be stale after an API edit.
        $planner=$raw['routePlanner']??null;unset($raw['routePlanner'],$raw['shipLanes'],$raw['shipStartPoint']);
        $d=self::normalize($raw,'kmz_json',$c['numeric_fields']);$f=&$d['Folder'];$m=&$d['missionConfig'];
        if (($f['templateType']??'waypoint')!=='waypoint') self::fail('kmz_json.Folder.templateType','当前编辑接口支持航点航线。','UNSUPPORTED_TYPE');
        foreach (['flyToWaylineMode','finishAction','exitOnRCLost','executeRCLostAction','globalTransitionalSpeed','droneInfo','payloadInfo'] as $key) if (!isset($m[$key])) self::fail('kmz_json.missionConfig.'.$key,'此配置为必填项。','REQUIRED');
        foreach (['executeHeightMode','autoFlightSpeed','Placemark'] as $key) if (!isset($f[$key])) self::fail('kmz_json.Folder.'.$key,'此配置为必填项。','REQUIRED');
        if (!in_array($f['executeHeightMode'],['WGS84','relativeToStartPoint','realTimeFollowSurface'],true)) self::fail('kmz_json.Folder.executeHeightMode','高度基准无效。');
        $points=&$f['Placemark'];
        if (!is_array($points) || !array_is_list($points) || count($points)<2 || count($points)>$c['max_points']) self::fail('kmz_json.Folder.Placemark','航线需要 2 至 5000 个航点。','OUT_OF_RANGE');
        $lanes=[];$distance=0;$duration=0;
        foreach ($points as $i=>&$p) {
            $path='kmz_json.Folder.Placemark['.$i.']';
            if (!is_array($p) || array_is_list($p)) self::fail($path,'航点须为对象。','INVALID_TYPE');
            $xyz=self::coordinates($p['Point']['coordinates']??null,$path.'.Point.coordinates');
            if (!isset($p['index'])) $p['index']=$i;
            if ($p['index']!==$i) self::fail($path.'.index','航点编号须与航点顺序一致。','INVALID_INDEX');
            $height=$p['executeHeight']??$p['height']??$p['ellipsoidHeight']??(($p['useGlobalHeight']??0)?($f['globalHeight']??null):null);
            if ($height===null) self::fail($path.'.executeHeight','缺少航点高度。','REQUIRED');
            $speed=($p['useGlobalSpeed']??0)?$f['autoFlightSpeed']:($p['waypointSpeed']??$f['autoFlightSpeed']);
            $p['executeHeight']=$height;$p['height']=$p['height']??$height;$p['ellipsoidHeight']=$p['ellipsoidHeight']??$height;
            $p['waypointSpeed']=$p['waypointSpeed']??$speed;$p['Point']['coordinates']=$xyz[0].','.$xyz[1];
            foreach (['waypointHeadingParam','waypointTurnParam'] as $param) {
                $global=$param==='waypointHeadingParam'?'globalWaypointHeadingParam':null;
                if (!isset($p[$param])) {
                    if ($global && isset($f[$global])) $p[$param]=$f[$global];
                    elseif ($param==='waypointTurnParam' && isset($f['globalWaypointTurnMode'])) $p[$param]=['waypointTurnMode'=>$f['globalWaypointTurnMode'],'waypointTurnDampingDist'=>0];
                }
            }
            $groups=$p['actionGroup']??[];
            if ($groups && !array_is_list($groups)) $groups=[$groups];
            foreach ($groups as $g=>$group) {
                $gp=$path.'.actionGroup'.(array_is_list($p['actionGroup'])?"[{$g}]":'');
                if (!is_array($group)) self::fail($gp,'动作组须为对象。');
                foreach (['actionGroupId','actionGroupStartIndex','actionGroupEndIndex','actionGroupMode','actionTrigger','action'] as $key) if (!isset($group[$key])) self::fail($gp.'.'.$key,'动作组配置缺失。','REQUIRED');
                if ($group['actionGroupStartIndex']>$group['actionGroupEndIndex'] || $group['actionGroupEndIndex']>=count($points)) self::fail($gp.'.actionGroupEndIndex','动作组范围超出当前航线。','OUT_OF_RANGE');
                if (!is_array($group['action']) || !array_is_list($group['action'])) self::fail($gp.'.action','动作须为数组。');
                foreach ($group['action'] as $a=>$action) foreach (['actionId','actionActuatorFunc','actionActuatorFuncParam'] as $key) if (!isset($action[$key])) self::fail($gp.".action[{$a}].".$key,'动作配置缺失。','REQUIRED');
            }
            $lanes[]=[$xyz[0],$xyz[1],$height];
            if ($i>0) {
                $prev=$lanes[$i-1];$r=deg2rad($xyz[1]-$prev[1]);$s=deg2rad($xyz[0]-$prev[0]);
                $a=sin($r/2)**2+cos(deg2rad($prev[1]))*cos(deg2rad($xyz[1]))*sin($s/2)**2;
                $segment=hypot(6371000*2*asin(min(1,sqrt($a))),$height-$prev[2]);$distance+=$segment;$duration+=$segment/$speed;
            }
            foreach ($groups as $group) foreach ($group['action'] as $action) if ($action['actionActuatorFunc']==='hover') $duration+=$action['actionActuatorFuncParam']['hoverTime']??0;
        }unset($p);
        if (isset($m['takeOffRefPoint']) && $m['takeOffRefPoint']!=='') {$start=self::coordinates($m['takeOffRefPoint'],'kmz_json.missionConfig.takeOffRefPoint',true);$start=[$start[1],$start[0],$start[2]];}
        else {$start=[$lanes[0][0],$lanes[0][1],0];$m['takeOffRefPoint']=$start[1].','.$start[0].',0';}
        $d['shipStartPoint']=[$start];$d['shipLanes']=$lanes;
        // Reconstruct editor state from the authoritative document; stale snapshots can hide action edits.
        return ['document'=>$d,'point_num'=>count($points),'total_point'=>count($points),'mileage'=>round($distance,2),'execution_time'=>(int)ceil($duration)];
    }
    private static function escape(mixed $v): string { return htmlspecialchars(is_bool($v)?(string)(int)$v:(string)$v,ENT_XML1|ENT_QUOTES,'UTF-8'); }
    private static function element(string $key,mixed $value,string $prefix='wpml:'): string {
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_.-]*$/D',$key)) self::fail('kmz_json','XML 字段名称无效。');
        if (is_array($value) && array_is_list($value)) {
            if (!$value) return '';
            if (is_array($value[0])) return implode('',array_map(fn($v)=>self::element($key,$v,$prefix),$value));
            $value=implode(',',array_map(fn($v)=>self::escape($v),$value));$escaped=true;
        }
        $content=is_array($value)?self::elements($value):(($escaped??false)?$value:self::escape($value));
        return '<'.$prefix.$key.'>'.$content.'</'.$prefix.$key.'>';
    }
    private static function elements(array $values): string { $out='';foreach ($values as $k=>$v) $out.=self::element($k,$v);return $out; }
    public static function xml(array $d,string $name,bool $wayline=false): string {
        $f=$d['Folder'];$points=$f['Placemark'];unset($f['Placemark']);
        if ($wayline) $f=array_intersect_key($f,array_flip(['templateId','waylineId','executeHeightMode','autoFlightSpeed']));
        else unset($f['executeHeightMode'],$f['waylineId']);
        $body=self::elements($f);
        foreach ($points as $i=>$p) {
            $point='<Point><coordinates>'.self::escape($p['Point']['coordinates']).'</coordinates></Point>';unset($p['Point'],$p['isRisky']);
            if ($wayline) unset($p['height'],$p['ellipsoidHeight'],$p['useGlobalHeight'],$p['useGlobalSpeed'],$p['useGlobalHeading'],$p['useGlobalHeadingParam'],$p['useGlobalTurnParam']);
            else unset($p['executeHeight']);
            if (isset($p['useGlobalHeading']) && !isset($p['useGlobalHeadingParam'])) {$p['useGlobalHeadingParam']=$p['useGlobalHeading'];unset($p['useGlobalHeading']);}
            $body.='<Placemark><name>'.($i+1).'</name>'.$point.self::elements($p).'</Placemark>';
        }
        return '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6"><Document><name>'.self::escape($name).'</name><wpml:missionConfig>'.self::elements($d['missionConfig']).'</wpml:missionConfig><Folder>'.$body.'</Folder></Document></kml>';
    }
    public static function revision(array $r): string { $v=array_intersect_key($r,array_flip(['id','name','project_id','airline_floder_id','type','scene','kmz_json','kmz_md5','update_time']));ksort($v);return hash('sha256',json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)); }
}
