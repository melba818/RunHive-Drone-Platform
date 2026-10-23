<?php

namespace app\common\library;

use app\admin\library\Auth;
use app\common\facade\Token;
use RuntimeException;
use think\facade\Db;

/** The parent Runhive bearer token is encrypted at rest and never sent to the iframe. */
class LlmcenterSession
{
    public const AUDIENCES = ['tune' => 'runhive-tune', 'agent' => 'runhive-agent'];
    public const MODULE_RULES = ['tune' => 'llmcenter', 'agent' => 'agentcenter'];

    public static function allowed(int $adminId, string $module): bool
    {
        return isset(self::MODULE_RULES[$module]) && Auth::instance()->check(self::MODULE_RULES[$module], $adminId);
    }

    public static function audience(string $module): string
    {
        if (!isset(self::AUDIENCES[$module])) {
            throw new RuntimeException('中心类型无效');
        }
        return self::AUDIENCES[$module];
    }

    public static function secret(): string
    {
        $path = (string)(getenv('LLM_INTERNAL_SECRET_FILE') ?: dirname(root_path()) . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'llm-center-internal-secret.txt');
        $value = is_file($path) ? trim((string)file_get_contents($path)) : '';
        if (strlen($value) < 64) {
            throw new RuntimeException('大模型中心内部认证尚未配置');
        }
        return $value;
    }

    public static function encryptParentToken(string $token, string $module): string
    {
        $nonce = random_bytes(12);
        $tag = '';
        $encrypted = openssl_encrypt($token, 'aes-256-gcm', hash('sha256', self::secret(), true), OPENSSL_RAW_DATA, $nonce, $tag, self::audience($module));
        if ($encrypted === false) {
            throw new RuntimeException('大模型中心登录签发失败');
        }
        return base64_encode($nonce . $tag . $encrypted);
    }

    public static function decryptParentToken(string $cipher, string $module): string
    {
        $raw = base64_decode($cipher, true);
        if ($raw === false || strlen($raw) < 29) {
            return '';
        }
        $token = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', hash('sha256', self::secret(), true), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), self::audience($module));
        return $token === false ? '' : $token;
    }

    public static function identity(array $row, string $module): ?array
    {
        if (($row['audience'] ?? '') !== self::audience($module) || !empty($row['revoked']) || (int)($row['session_expires_at'] ?? 0) <= time()) {
            return null;
        }
        $adminId = (int)($row['admin_id'] ?? 0);
        $parent = self::decryptParentToken((string)($row['parent_token_cipher'] ?? ''), $module);
        if ($adminId <= 0 || $parent === '' || !Token::check($parent, Auth::TOKEN_TYPE, $adminId)) {
            return null;
        }
        $admin = Db::name('admin')->where('id', $adminId)->where('status', 'enable')->field('id,username,nickname')->find();
        if (!$admin || !self::allowed($adminId, $module)) {
            return null;
        }
        return ['admin_id' => $adminId, 'module' => $module, 'username' => (string)$admin['username'], 'nickname' => (string)$admin['nickname'], 'expires_at' => (int)$row['session_expires_at']];
    }
}
