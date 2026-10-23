<?php

namespace dji;

use think\facade\Log;
use dji\Log as DjiLog;

class Main
{
    protected $airline = null;
    protected $hms = null;
    protected $osd = null;


    public function __construct()
    {
        $this->airline = new Airline();
        $this->hms = new Hms();
        $this->osd = new Osd();
    }

    public function responseEvents($param)
    {
        // if (isset($param['method']) && $param['method'] == 'flighttask_ready') {
        //     $this->airline->flighttaskReady($param);
        // }
        if (isset($param['method']) && $param['method'] == 'hms') {
            $this->hms->save($param);
        }
        if (isset($param['method']) && $param['method'] == 'flighttask_progress') {
            $this->airline->flighttask_progress($param);
        }
        if (isset($param['need_reply']) && $param['need_reply'] == 1) {
            $other = [];
            $other['result'] = 0;
            $this->eventReply($param, $other);
        }
        if (isset($param['method']) && $param['method'] == 'file_upload_callback') {
            $this->airline->file_upload_callback($param);
        }
    }

    public function responseOsd($param)
    {
        // print_r($param);
        if (isset($param['data']['best_link_gateway'])) {
            $this->osd->osdSave($param);
        }
    }

    public function responseStatus($param)
    {
        if (isset($param['method']) && $param['method'] == 'update_topo') {
            $other = [];
            $other['result'] = 0;
            $this->osd->statusReady($param, $other);
        }
    }


    public function responseRequest($param)
    {
        if (isset($param['method']) && $param['method'] == 'config') {
            $this->configReady($param);
        }
        if (isset($param['method']) && $param['method'] == 'airport_bind_status') {
            $this->airportBindStatus($param);
        }
        if (isset($param['method']) && $param['method'] == 'airport_organization_get') {
            $this->airportOrganizationGet($param);
        }
        if (isset($param['method']) && $param['method'] == 'airport_organization_bind') {
            $this->airportOrganizationBind($param);
        }
        if (isset($param['method']) && $param['method'] == 'flighttask_resource_get') {
            $this->airline->resourceReady($param);
        }
        if (isset($param['method']) && $param['method'] == 'storage_config_get') {
            if ($param['data'] && $param['data']['module'] < 1) {
                $this->airline->storageConfigReady($param);
            }
        }
    }

    /**
     * Reply to a newly connected Dock's Cloud API configuration request.
     * DJI credentials remain empty in local simulator mode unless configured
     * in the server environment.
     */
    private function configReady($param)
    {
        $response = [
            'bid' => $param['bid'] ?? '',
            'tid' => $param['tid'] ?? '',
            'timestamp' => round(microtime(true) * 1000),
            'method' => 'config',
            'topic' => 'thing/product/' . ($param['sn'] ?? '') . '/requests_reply',
            'data' => [
                'app_id' => (string) env('dji.app_id', ''),
                'app_key' => (string) env('dji.app_key', ''),
                'app_license' => (string) env('dji.app_license', ''),
            ],
        ];

        return publish($response);
    }

    /**
     * Report simulator devices as unbound until the configured binding code is
     * presented in airport_organization_bind.
     */
    private function airportBindStatus($param)
    {
        $devices = $param['data']['devices'] ?? [];
        $bindStatus = [];
        foreach ($devices as $device) {
            $bindStatus[] = [
                'sn' => (string) ($device['sn'] ?? ''),
                'is_device_bind_organization' => false,
                'organization_id' => '',
                'organization_name' => '',
                'device_callsign' => '',
            ];
        }

        return $this->requestReply($param, [
            'result' => 0,
            'output' => ['bind_status' => $bindStatus],
        ]);
    }

    private function airportOrganizationGet($param)
    {
        $expectedOrganizationId = (string) env('dji.organization_id', '');
        $expectedBindingCode = (string) env('dji.device_binding_code', '');
        $requestData = $param['data'] ?? [];
        $valid = $expectedOrganizationId !== ''
            && $expectedBindingCode !== ''
            && hash_equals($expectedOrganizationId, (string) ($requestData['organization_id'] ?? ''))
            && hash_equals($expectedBindingCode, (string) ($requestData['device_binding_code'] ?? ''));

        return $this->requestReply($param, [
            'result' => $valid ? 0 : 210231,
            'output' => $valid ? [
                'organization_name' => (string) env('dji.organization_name', 'RunHive'),
            ] : new \stdClass(),
        ]);
    }

    private function airportOrganizationBind($param)
    {
        $expectedOrganizationId = (string) env('dji.organization_id', '');
        $expectedBindingCode = (string) env('dji.device_binding_code', '');
        $bindDevices = $param['data']['bind_devices'] ?? [];
        $errInfos = [];

        foreach ($bindDevices as $device) {
            $valid = $expectedOrganizationId !== ''
                && $expectedBindingCode !== ''
                && hash_equals($expectedOrganizationId, (string) ($device['organization_id'] ?? ''))
                && hash_equals($expectedBindingCode, (string) ($device['device_binding_code'] ?? ''));
            $errInfos[] = [
                'sn' => (string) ($device['sn'] ?? ''),
                'err_code' => $valid ? 0 : 210231,
            ];
        }

        return $this->requestReply($param, [
            'result' => 0,
            'output' => ['err_infos' => $errInfos],
        ]);
    }

    private function requestReply($param, $data)
    {
        return publish([
            'bid' => $param['bid'] ?? '',
            'tid' => $param['tid'] ?? '',
            'timestamp' => round(microtime(true) * 1000),
            'method' => $param['method'] ?? '',
            'topic' => 'thing/product/' . ($param['sn'] ?? '') . '/requests_reply',
            'data' => $data,
        ]);
    }

    public function responseServicesReply($param)
    {
        if (isset($param['method']) && $param['method'] == 'fileupload_list') {
            $djilog = new DjiLog();
            $djilog->saveLog($param);
        }
        if (isset($param['method']) && $param['method'] == 'flighttask_prepare') {
            $djilog = new DjiLog();
            $this->airline->flighttaskErrot($param);
        }
    }

    protected function eventReply($param, $other)
    {
        $data = [];
        $data['bid'] = $param['bid'];
        $data['tid'] = $param['tid'];
        $data['timestamp'] = round(microtime(true) * 1000);
        $data['method'] = $param['method'];
        $data['topic'] = 'thing/product/' . $param['sn'] . '/events_reply';
        $data['data'] = $other;
        $result = publish($data);
        if ($result) {
            return true;
        } else {
            return false;
        }
    }
}
