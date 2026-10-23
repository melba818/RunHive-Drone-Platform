<?php

namespace app\admin\model;

use think\Model;

/**
 * Modemanage
 */
class Modemanage extends Model
{
    // 表名
    protected $name = 'modemanage';

    // 自动写入时间戳字段
    protected $autoWriteTimestamp = true;


    public function project(): \think\model\relation\BelongsTo
    {
        return $this->belongsTo(\app\admin\model\Project::class, 'project_id', 'id');
    }
}