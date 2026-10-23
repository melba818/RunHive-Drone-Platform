<?php

namespace app\common\library;

use RuntimeException;
use think\facade\Db;

/** Provision and validate one persistent RunOS workspace per RunHive admin. */
class RunosWorkspace
{
    public static function rootForAdmin(int $adminId): string
    {
        if ($adminId <= 0) {
            throw new RuntimeException('Invalid RunHive administrator ID');
        }

        return dirname(root_path()) . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'runos-data'
            . DIRECTORY_SEPARATOR . 'admin-' . $adminId;
    }

    /** Create the empty workspace and its initial database settings once. */
    public static function provision(int $adminId): array
    {
        $root = self::rootForAdmin($adminId);
        $sharedRoot = self::rootForAdmin((int)(getenv('RUNOS_PLATFORM_CONFIG_ADMIN_ID') ?: 1));
        foreach (['models', 'compute_nodes'] as $sharedName) {
            $sharedPath = $sharedRoot . DIRECTORY_SEPARATOR . $sharedName;
            if (!is_dir($sharedPath) && !mkdir($sharedPath, 0775, true) && !is_dir($sharedPath)) {
                throw new RuntimeException('Could not create shared RunOS configuration directory');
            }
        }
        $paths = [
            'models_path' => $sharedRoot . DIRECTORY_SEPARATOR . 'models',
            'datasets_path' => $root . DIRECTORY_SEPARATOR . 'datasets',
            'output_path' => $root . DIRECTORY_SEPARATOR . 'exports',
        ];

        foreach (array_merge(array_values($paths), [
            $root . DIRECTORY_SEPARATOR . 'snapshots',
            $root . DIRECTORY_SEPARATOR . 'temp',
            $root . DIRECTORY_SEPARATOR . 'videos',
            $root . DIRECTORY_SEPARATOR . 'alerts',
        ]) as $directory) {
            if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                throw new RuntimeException('Could not create RunOS account workspace');
            }
        }

        // New accounts use the platform configuration; retain any existing private model files.
        foreach (['models', 'compute_nodes'] as $sharedName) {
            $alias = $root . DIRECTORY_SEPARATOR . $sharedName;
            if ($root !== $sharedRoot && !file_exists($alias) && !is_link($alias)) {
                if (!symlink($sharedRoot . DIRECTORY_SEPARATOR . $sharedName, $alias)) {
                    throw new RuntimeException('Could not link shared RunOS configuration directory');
                }
            }
        }

        $row = Db::name('runos_config')->where('admin_id', $adminId)->find();
        if (!$row) {
            $now = time();
            $settings = $paths + ['use_gpu' => true, 'gpu_device' => '0'];
            Db::name('runos_config')->insert([
                'admin_id' => $adminId,
                'config_json' => json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'config_version' => 1,
                'create_time' => $now,
                'update_time' => $now,
            ]);
            return $settings;
        }

        $settings = json_decode((string)$row['config_json'], true);
        return is_array($settings) ? array_replace($settings, ['models_path' => $paths['models_path']]) : $paths;
    }

    public static function containsPath(int $adminId, string $path, bool $allowSharedModels = false): bool
    {
        $root = realpath(self::rootForAdmin($adminId));
        $resolved = realpath($path);
        if ($root === false || $resolved === false) {
            return false;
        }

        if ($allowSharedModels) {
            $shared = realpath(self::rootForAdmin((int)(getenv('RUNOS_PLATFORM_CONFIG_ADMIN_ID') ?: 1)) . DIRECTORY_SEPARATOR . 'models');
            if ($shared !== false && ($resolved === $shared || str_starts_with($resolved, rtrim($shared, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR))) {
                return true;
            }
        }
        $prefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $comparison = DIRECTORY_SEPARATOR === '\\' ? strncasecmp($resolved, $prefix, strlen($prefix)) : strncmp($resolved, $prefix, strlen($prefix));
        return $comparison === 0;
    }
}
