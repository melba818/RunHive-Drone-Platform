<?php

namespace app\api\controller;

use app\common\controller\Api;
use app\common\library\LlmcenterSession;
use think\facade\Db;

/** Internal-only SSO bridge: the gateway presents the application-specific secret. */
class Llmcenter extends Api
{
    protected function payload(): array
    {
        $expected = LlmcenterSession::secret();
        $provided = trim((string)$this->request->header('x-llm-internal-key', ''));
        if ($provided === '' || !hash_equals($expected, $provided)) {
            $this->error('未授权的大模型中心内部请求', [], 0, null, ['statusCode' => 401]);
        }
        if (!$this->request->isPost()) {
            $this->error('请使用有效的内部请求', [], 0, null, ['statusCode' => 405]);
        }
        $payload = json_decode((string)$this->request->getInput(), true);
        $payload = is_array($payload) ? $payload : [];
        $module = (string)($payload['module'] ?? '');
        if (!isset(LlmcenterSession::AUDIENCES[$module])) {
            $this->error('中心类型无效', [], 0, null, ['statusCode' => 400]);
        }
        return $payload;
    }

    public function exchange(): void
    {
        $payload = $this->payload();
        $module = (string)$payload['module'];
        $ticket = (string)($payload['ticket'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/D', $ticket)) {
            $this->error('登录票据无效或已过期', [], 0, null, ['statusCode' => 401]);
        }
        $hash = hash('sha256', $ticket);
        $now = time();
        $handle = bin2hex(random_bytes(32));
        // The UPDATE is the single-use boundary; concurrent exchanges cannot both succeed.
        $updated = Db::name('llmcenter_sso_ticket')
            ->where('ticket_hash', $hash)
            ->where('audience', LlmcenterSession::audience($module))
            ->where('expires_at', '>', $now)
            ->where('revoked', 0)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => $now, 'session_handle_hash' => hash('sha256', $handle)]);
        if ($updated !== 1) {
            $this->error('登录票据无效或已过期', [], 0, null, ['statusCode' => 401]);
        }
        $row = Db::name('llmcenter_sso_ticket')->where('ticket_hash', $hash)->find();
        $identity = $row ? LlmcenterSession::identity($row, $module) : null;
        if (!$identity) {
            $this->error('Runhive 登录已失效或账号已停用', [], 0, null, ['statusCode' => 401]);
        }
        $identity['session_handle'] = $handle;
        $this->success('', $identity);
    }

    public function identity(): void
    {
        $payload = $this->payload();
        $handle = (string)($payload['session_handle'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/D', $handle)) {
            $this->error('大模型中心会话无效', [], 0, null, ['statusCode' => 401]);
        }
        $row = Db::name('llmcenter_sso_ticket')->where('session_handle_hash', hash('sha256', $handle))->whereNotNull('consumed_at')->find();
        $identity = $row ? LlmcenterSession::identity($row, (string)$payload['module']) : null;
        if (!$identity) {
            $this->error('Runhive 登录已失效或账号已停用', [], 0, null, ['statusCode' => 401]);
        }
        $this->success('', $identity);
    }

    public function revoke(): void
    {
        $payload = $this->payload();
        $handle = (string)($payload['session_handle'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/D', $handle)) {
            $this->error('大模型中心会话无效', [], 0, null, ['statusCode' => 401]);
        }
        Db::name('llmcenter_sso_ticket')->where('session_handle_hash', hash('sha256', $handle))->where('audience', LlmcenterSession::audience((string)$payload['module']))->update(['revoked' => 1]);
        $this->success('', ['revoked' => true]);
    }
}
