<?php

namespace app\api\controller;

use app\common\controller\Api;
use app\common\library\RunosWorkspace;
use think\facade\Db;

/**
 * Narrow server-side bridge used by the isolated RunOS service.
 * The browser never receives the internal key or database credentials.
 */
class Runos extends Api
{
    /** Redeem an application-center ticket once, within its 60-second lifetime. */
    public function exchange(): void
    {
        $ticket = trim((string)$this->request->post('ticket', ''));
        if ($ticket === '') {
            $payload = json_decode((string)$this->request->getInput(), true);
            $ticket = is_array($payload) ? trim((string)($payload['ticket'] ?? '')) : '';
        }
        if ($ticket === '') {
            $payload = json_decode((string)$this->request->getInput(), true);
            $ticket = is_array($payload) ? trim((string)($payload['ticket'] ?? '')) : '';
        }
        if (!preg_match('/^[a-f0-9]{64}$/D', $ticket)) {
            $this->error('无效或已过期的 RunOS 登录票据', [], 0, null, ['statusCode' => 401]);
        }

        $now = time();
        $hash = hash('sha256', $ticket);
        $updated = Db::name('runos_sso_ticket')
            ->where('ticket_hash', $hash)
            ->where('expires_at', '>=', $now)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => $now]);

        if ($updated !== 1) {
            $this->error('无效或已过期的 RunOS 登录票据', [], 0, null, ['statusCode' => 401]);
        }

        $ticketRow = Db::name('runos_sso_ticket')->where('ticket_hash', $hash)->find();
        $admin = $ticketRow
            ? Db::name('admin')->where('id', (int)$ticketRow['admin_id'])->where('status', 'enable')->field('id,username,nickname')->find()
            : null;

        if (!$admin) {
            $this->error('RunHive 账号不可用', [], 0, null, ['statusCode' => 403]);
        }

        $this->success('', [
            'admin_id' => (int)$admin['id'],
            'username' => (string)$admin['username'],
            'nickname' => (string)$admin['nickname'],
        ]);
    }

    /** Read or update the signed-in administrator's RunOS settings. */
    public function settings(): void
    {
        $providedKey = trim((string)$this->request->header('x-runos-internal-key', ''));
        $secretPath = dirname(root_path()) . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'runos-internal-secret.txt';
        $expectedKey = is_file($secretPath) ? trim((string)file_get_contents($secretPath)) : '';
        if ($expectedKey === '' || $providedKey === '' || !hash_equals($expectedKey, $providedKey)) {
            $this->error('未授权的 RunOS 内部请求', [], 0, null, ['statusCode' => 401]);
        }

        $payload = json_decode((string)$this->request->getInput(), true);
        if (!is_array($payload)) {
            $payload = [];
        }
        $adminId = (int)($payload['admin_id'] ?? $this->request->get('admin_id/d', 0));
        if ($adminId <= 0 || !Db::name('admin')->where('id', $adminId)->where('status', 'enable')->find()) {
            $this->error('RunHive 账号不可用', [], 0, null, ['statusCode' => 403]);
        }
        $provisionedSettings = RunosWorkspace::provision($adminId);

        if (!$this->request->isPost()) {
            $this->success('', ['admin_id' => $adminId, 'settings' => $provisionedSettings]);
        }

        $input = $payload['settings'] ?? null;
        if (!is_array($input)) {
            $this->error('配置格式错误');
        }

        $settings = [];
        foreach (['models_path', 'datasets_path', 'output_path'] as $key) {
            $value = trim((string)($input[$key] ?? ''));
            if ($value === '' || strlen($value) > 1024 || str_contains($value, "\0")) {
                $this->error('RunOS 路径配置无效');
            }
            if (!RunosWorkspace::containsPath($adminId, $value, $key === 'models_path')) {
                $this->error('数据及导出路径须位于当前账号工作区，模型路径可使用平台共享目录');
            }
            $settings[$key] = $value;
        }
        $settings['use_gpu'] = filter_var($input['use_gpu'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $settings['gpu_device'] = substr(trim((string)($input['gpu_device'] ?? '0')), 0, 32);

        $now = time();
        $row = Db::name('runos_config')->where('admin_id', $adminId)->find();
        $values = [
            'config_json' => json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'config_version' => 1,
            'update_time' => $now,
        ];
        if ($row) {
            Db::name('runos_config')->where('admin_id', $adminId)->update($values);
        } else {
            $values['admin_id'] = $adminId;
            $values['create_time'] = $now;
            Db::name('runos_config')->insert($values);
        }

        $this->success('', ['admin_id' => $adminId, 'settings' => $settings]);
    }
}
