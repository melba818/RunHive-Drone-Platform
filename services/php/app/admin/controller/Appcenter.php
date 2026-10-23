<?php

namespace app\admin\controller;

use app\common\controller\Backend;
use app\common\library\RunosWorkspace;
use think\facade\Db;

/**
 * 应用中心
 */
class Appcenter extends Backend
{
    /**
     * Appcenter模型对象
     * @var object
     * @phpstan-var \app\admin\model\Appcenter
     */
    protected object $model;

    protected array|string $preExcludeFields = ['id', 'create_time', 'update_time'];

    protected string|array $quickSearchField = ['id'];

    // Launching RunOS still requires a valid RunHive administrator session.
    protected array $noNeedPermission = ['launchRunos', 'access'];

    public function initialize(): void
    {
        parent::initialize();
        $this->model = new \app\admin\model\Appcenter();
        $this->request->filter('clean_xss');
    }

    /** Ensure this administrator has an isolated workspace and issue an SSO ticket. */
    public function launchRunos(): void
    {
        $this->checkAccess();
        $app = Db::name('appcenter')
            ->where('name', 'RunOS')
            ->where('status', 1)
            ->find();
        if (!$app || empty($app['launch_url'])) {
            $this->error('RunOS 尚未配置启动地址');
        }

        $adminId = (int)$this->auth->id;
        if ($adminId <= 0) {
            $this->error('请先登录 RunHive');
        }
        RunosWorkspace::provision($adminId);

        $ticket = bin2hex(random_bytes(32));
        $now = time();
        Db::name('runos_sso_ticket')->insert([
            'ticket_hash' => hash('sha256', $ticket),
            'admin_id' => $adminId,
            'expires_at' => $now + 60,
            'consumed_at' => null,
            'create_time' => $now,
        ]);

        $launchUrl = rtrim((string)$app['launch_url'], '/');
        $requestHost = strtolower((string)$this->request->host(true));
        $lanHosts = array_filter(array_map('trim', explode(',', (string)getenv('RUNOS_LAN_HOSTS'))));
        if (in_array($requestHost, $lanHosts, true)) {
            $lanPort = (int)(getenv('RUNOS_LAN_PORT') ?: 14000);
            $launchPath = (string)(parse_url($launchUrl, PHP_URL_PATH) ?: '');
            $launchUrl = 'http://' . $requestHost . ':' . $lanPort . $launchPath;
        }

        $this->success('', [
            'launch_url' => $launchUrl,
            'ticket' => $ticket,
            'admin_id' => $adminId,
        ]);
    }

    /** Permission-only revalidation for an already resident workspace. */
    public function access(): void
    {
        $this->checkAccess();
        $this->success('', ['admin_id' => (int)$this->auth->id, 'allowed' => true]);
    }

    private function checkAccess(): void
    {
        if (!$this->auth->check('appcenter/index')) {
            $this->error('当前账号无权访问应用中心。', [], 0, null, ['statusCode' => 403]);
        }
    }


    /**
     * 若需重写查看、编辑、删除等方法，请复制 @see \app\admin\library\traits\Backend 中对应的方法至此进行重写
     */
}
