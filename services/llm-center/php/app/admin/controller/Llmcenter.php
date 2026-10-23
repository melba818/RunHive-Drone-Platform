<?php

namespace app\admin\controller;

use app\common\controller\Backend;
use app\common\library\LlmcenterSession;
use think\facade\Db;

/** Dedicated large-model center. The existing model-management controller is unchanged. */
class Llmcenter extends Backend
{
    protected array $noNeedPermission = ['launch'];

    public function launch(): void
    {
        if (!$this->request->isPost()) {
            $this->error('请使用有效的启动请求', [], 0, null, ['statusCode' => 405]);
        }
        $payload = json_decode((string)$this->request->getInput(), true);
        $module = is_array($payload) ? (string)($payload['module'] ?? '') : '';
        if (!isset(LlmcenterSession::AUDIENCES[$module])) {
            $this->error('中心类型无效', [], 0, null, ['statusCode' => 400]);
        }
        $adminId = (int)$this->auth->id;
        $parentToken = $this->auth->getToken();
        if ($adminId <= 0 || $parentToken === '') {
            $this->error('请先登录 Runhive', [], 0, null, ['statusCode' => 401]);
        }
        if (!LlmcenterSession::allowed($adminId, $module)) {
            $this->error('当前账号无权访问该中心', [], 0, null, ['statusCode' => 403]);
        }
        $ticket = bin2hex(random_bytes(32));
        $now = time();
        Db::name('llmcenter_sso_ticket')->insert([
            'ticket_hash' => hash('sha256', $ticket),
            'admin_id' => $adminId,
            'audience' => LlmcenterSession::audience($module),
            'parent_token_cipher' => LlmcenterSession::encryptParentToken($parentToken, $module),
            'expires_at' => $now + 60,
            'consumed_at' => null,
            'session_handle_hash' => null,
            'session_expires_at' => $now + 28800,
            'revoked' => 0,
            'create_time' => $now,
        ]);
        // The browser passes this ticket in a URL fragment, never a query string.
        $this->success('', ['launch_url' => '/llm-center/' . $module . '/', 'ticket' => $ticket, 'admin_id' => $adminId, 'module' => $module]);
    }
}
