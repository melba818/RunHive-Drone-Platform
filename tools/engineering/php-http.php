<?php
/** Isolated ThinkPHP HTTP bootstrap. No production configuration or credentials. */
declare(strict_types=1);
if (getenv('RUNHIVE_TEST_ISOLATED') !== '1') { http_response_code(503); exit; }
$root = '/work/repo/services/php';
$vendor = '/work/framework/vendor';
$prefixes = ['app\\' => [$root . '/app/']];
$files = [];
foreach (glob($vendor . '/*/*/composer.json') as $file) {
    $base = dirname($file) . '/';
    $meta = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
    foreach (($meta['autoload']['psr-4'] ?? []) as $prefix => $dirs) {
        foreach ((array)$dirs as $dir) $prefixes[$prefix][] = $base . rtrim($dir, '/') . '/';
    }
    foreach (($meta['autoload']['files'] ?? []) as $rel) $files[] = $base . $rel;
}
uksort($prefixes, fn($a, $b) => strlen($b) <=> strlen($a));
spl_autoload_register(function ($class) use ($prefixes) {
    foreach ($prefixes as $prefix => $dirs) {
        if (!str_starts_with($class, $prefix)) continue;
        foreach ($dirs as $dir) {
            $file = $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) { require_once $file; return; }
        }
    }
});
foreach ($files as $file) require_once $file;
// The framework and original controller/base/model are real. This narrow test
// application deliberately does not load production plugins or MQTT services.
$app = new think\App('/work/phpapp/');
$app->config->set(['app_namespace'=>'app','with_route'=>true,'default_timezone'=>'UTC','show_error_msg'=>false,'error_message'=>'Test service unavailable'], 'app');
$app->config->set(['default'=>'mysql','connections'=>['mysql'=>[
    'type'=>'mysql', 'dsn'=>'mysql:unix_socket=/work/db/run.sock;dbname=runhive_test;charset=utf8mb4',
    'username'=>'root','password'=>'','database'=>'runhive_test','prefix'=>'','charset'=>'utf8mb4',
    'fields_strict'=>true,'fields_cache'=>false,'break_reconnect'=>false,'trigger_sql'=>false,
]]], 'database');
$app->config->set(['default'=>'file','stores'=>['file'=>['type'=>'File','path'=>'/work/phpapp/runtime/cache/']]], 'cache');
$app->config->set(['default'=>'file','channels'=>['file'=>['type'=>'File','path'=>'/work/phpapp/runtime/log/']]], 'log');
$app->initialize();
require_once $root . '/app/common.php';
$app->route->post('api/Runos/exchange', '\app\api\controller\Runos@exchange');
$http = $app->http;
$response = $http->run();
$response->send();
$http->end($response);
