<?php

namespace mqtt;

use app\admin\model\Equipment;
use dji\Airline;
use dji\Main;
use think\facade\Db;
use think\worker\Server;
use Workerman\Lib\Timer;
use Workerman\Worker;

// mqtt类继承think\worker\Server
class Mqtt extends Server
{
    // think-worker's class configuration is separate from worker_server.php.
    // Keep the listener local for this development deployment.
    protected $protocol = 'websocket';
    protected $host = '127.0.0.1';
    protected $port = 2345;

    private $connection = null;
    private $main = null;
    private $airline = null;
    
    /**
     * 订阅设备相关的所有主题
     * @param object $mqtt MQTT客户端实例
     * @param string $sn 设备序列号
     */
    private function subscribeEquipmentTopics($mqtt, $sn)
    {
        $topics = [
            "thing/product/{$sn}/events",
            "sys/product/{$sn}/status", 
            "thing/product/{$sn}/osd",
            "thing/product/{$sn}/requests",
            "thing/product/{$sn}/services_reply",
            "thing/product/{$sn}/flighttask_progress"
        ];
        
        foreach ($topics as $topic) {
            $mqtt->subscribe($topic);
        }
    }
    
    public function onWorkerStart($worker)
    {
        // workerman/mqtt 1.7 uses Workerman\Timer, while think-worker 4 pins
        // Workerman 3 where the same timer class is Workerman\Lib\Timer.
        if (!class_exists(\Workerman\Timer::class, false)) {
            class_alias(\Workerman\Lib\Timer::class, \Workerman\Timer::class);
        }

        $this->main = new Main();
        $this->airline = new Airline();
        $options = [
            'keepalive' => 60,
            'client_id' => "PUBLISH0001",
            'clean_session' => true,
            'reconnect_period' => 10,
        ];
        $mqttUsername = (string) env('mqtt.username', '');
        $mqttPassword = (string) env('mqtt.password', '');
        if ($mqttUsername !== '') {
            $options['username'] = $mqttUsername;
        }
        if ($mqttPassword !== '') {
            $options['password'] = $mqttPassword;
        }
        $mqttHost = (string) env('mqtt.host', '127.0.0.1');
        $mqttPort = (int) env('mqtt.port', 1883);
        $mqtt = new \Workerman\Mqtt\Client("mqtt://{$mqttHost}:{$mqttPort}", $options);
        //获取设备
        $list = Equipment::select();
        $this->connection = $mqtt;
        // 订阅mqtt主题消息
        $mqtt->onConnect = function ($mqtt) use ($list) {
            // 订阅系统设备添加主题
            $mqtt->subscribe('system/equipment/set/equipment_add');

            // 新接入设备在入库前会先请求平台配置。订阅通配符主题，
            // 让首次注册时的 config 请求也能被处理；设备入库后仍保留精确订阅。
            foreach ([
                'thing/product/+/events',
                'thing/product/+/osd',
                'thing/product/+/requests',
                'thing/product/+/services_reply',
                'thing/product/+/flighttask_progress',
                'sys/product/+/status',
            ] as $topic) {
                $mqtt->subscribe($topic);
            }
            
            // 批量订阅设备相关主题
            foreach ($list as $equipment) {
                $this->subscribeEquipmentTopics($mqtt, $equipment['sn']);
            }
        };
        $mqtt->onMessage = function ($topic, $content,$mqtt) {
            $topicArr = explode('/', $topic);
            if(count($topicArr) == 4){
                $data = json_decode($content, true);
                $data['sn'] = $topicArr[2];
                switch($topicArr[3]){
                    case 'equipment_add':
                        //新设备入场 增加对应订阅
                        $this->subscribeEquipmentTopics($mqtt, $data['new_sn']);
                        break;
                    case 'events':
                        $this->main->responseEvents($data);
                        break;
                    case 'requests':
                        $this->main->responseRequest($data);
                        break;
                    case 'services_reply':
                        $this->main->responseServicesReply($data);
                        break;
                    case 'osd':
                        //同步订阅子设备
                        if(isset($data['data']['sub_device']['device_sn'])){
                            $this->connection->subscribe('thing/product/' . $data['data']['sub_device']['device_sn'] . '/osd');
                        }
                        $this->main->responseOsd($data);
                        break;
                    case 'status':
                        $this->main->responseStatus($data);
                        break;
                }
            }
        };
        $mqtt->connect();
        $inner_text_worker = new Worker('text://127.0.0.1:1884'); //内部调用端口
        $inner_text_worker->onMessage = function ($connection, $message) {
            $arr = json_decode($message, true);
            $topic = $arr['topic'];
            unset($arr['topic']);
            if (isset($this->connection)) {
                $this->connection->publish($topic, json_encode($arr));
                $connection->send('ok');
            } else {
                $connection->send('error: MQTT connection not initialized');
            }
        };
        $inner_text_worker->listen();

        Timer::add(5, function () {
            $tast_list = Db::name('flighttask')->where('status','sent')->where('execute_time','<=',time())->select();
            print_r(count($tast_list));
            if ($tast_list) {
                if (count($tast_list) > 0) {
                    $this->airline->flighttaskReady($tast_list);
                }
            }
        });
    }
}
