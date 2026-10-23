/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.19-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: fly
-- ------------------------------------------------------
-- Server version	10.11.19-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `nz_admin`
--

DROP TABLE IF EXISTS `nz_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_admin` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `username` varchar(20) NOT NULL DEFAULT '' COMMENT '用户名',
  `nickname` varchar(50) NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar` varchar(255) NOT NULL DEFAULT '' COMMENT '头像',
  `email` varchar(50) NOT NULL DEFAULT '' COMMENT '邮箱',
  `mobile` varchar(11) NOT NULL DEFAULT '' COMMENT '手机',
  `login_failure` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '登录失败次数',
  `last_login_time` bigint(16) unsigned DEFAULT NULL COMMENT '上次登录时间',
  `last_login_ip` varchar(50) NOT NULL DEFAULT '' COMMENT '上次登录IP',
  `password` varchar(255) NOT NULL DEFAULT '' COMMENT '密码',
  `salt` varchar(30) NOT NULL DEFAULT '' COMMENT '密码盐（废弃待删）',
  `motto` varchar(255) NOT NULL DEFAULT '' COMMENT '签名',
  `status` varchar(30) NOT NULL DEFAULT '' COMMENT '状态:enable=启用,disable=禁用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `hospital` varchar(255) DEFAULT NULL COMMENT '医院',
  `keshi` varchar(255) DEFAULT NULL COMMENT '科室',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `username` (`username`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='管理员表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_admin_group`
--

DROP TABLE IF EXISTS `nz_admin_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_admin_group` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `pid` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '上级分组',
  `name` varchar(100) NOT NULL DEFAULT '' COMMENT '组名',
  `rules` text DEFAULT NULL COMMENT '权限规则ID',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='管理分组表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_admin_group_access`
--

DROP TABLE IF EXISTS `nz_admin_group_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_admin_group_access` (
  `uid` int(11) unsigned NOT NULL COMMENT '管理员ID',
  `group_id` int(11) unsigned NOT NULL COMMENT '分组ID',
  KEY `uid` (`uid`) USING BTREE,
  KEY `group_id` (`group_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='管理分组映射表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_admin_log`
--

DROP TABLE IF EXISTS `nz_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_admin_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `admin_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '管理员ID',
  `username` varchar(20) NOT NULL DEFAULT '' COMMENT '管理员用户名',
  `url` varchar(1500) NOT NULL DEFAULT '' COMMENT '操作Url',
  `title` varchar(100) NOT NULL DEFAULT '' COMMENT '日志标题',
  `data` longtext DEFAULT NULL COMMENT '请求数据',
  `ip` varchar(50) NOT NULL DEFAULT '' COMMENT 'IP',
  `useragent` varchar(255) NOT NULL DEFAULT '' COMMENT 'User-Agent',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2176 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='管理员日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_admin_rule`
--

DROP TABLE IF EXISTS `nz_admin_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_admin_rule` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `pid` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '上级菜单',
  `type` enum('menu_dir','menu','button') NOT NULL DEFAULT 'menu' COMMENT '类型:menu_dir=菜单目录,menu=菜单项,button=页面按钮',
  `title` varchar(50) NOT NULL DEFAULT '' COMMENT '标题',
  `name` varchar(50) NOT NULL DEFAULT '' COMMENT '规则名称',
  `path` varchar(100) NOT NULL DEFAULT '' COMMENT '路由路径',
  `icon` varchar(50) NOT NULL DEFAULT '' COMMENT '图标',
  `menu_type` enum('tab','link','iframe') DEFAULT NULL COMMENT '菜单类型:tab=选项卡,link=链接,iframe=Iframe',
  `url` varchar(255) NOT NULL DEFAULT '' COMMENT 'Url',
  `component` varchar(100) NOT NULL DEFAULT '' COMMENT '组件路径',
  `keepalive` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '缓存:0=关闭,1=开启',
  `extend` enum('none','add_rules_only','add_menu_only') NOT NULL DEFAULT 'none' COMMENT '扩展属性:none=无,add_rules_only=只添加为路由,add_menu_only=只添加为菜单',
  `remark` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  `weigh` int(11) NOT NULL DEFAULT 0 COMMENT '权重',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `pid` (`pid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=236 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='菜单和权限规则表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_airline`
--

DROP TABLE IF EXISTS `nz_airline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_airline` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '航线名称',
  `project_id` int(10) unsigned DEFAULT NULL COMMENT '所属项目',
  `airline_floder_id` int(10) unsigned DEFAULT NULL COMMENT '所属文件夹',
  `type` enum('0','1') DEFAULT '0' COMMENT '航线类型:0=航点航线,1=面状航线',
  `template` varchar(255) NOT NULL DEFAULT '' COMMENT '模板文件',
  `wayline` varchar(255) NOT NULL DEFAULT '' COMMENT '航线文件',
  `kmz` varchar(255) NOT NULL DEFAULT '' COMMENT '航线打包',
  `point_num` int(10) DEFAULT NULL COMMENT '航点数量',
  `mileage` varchar(255) NOT NULL DEFAULT '' COMMENT '预计里程',
  `execution_time` varchar(255) NOT NULL DEFAULT '' COMMENT '预计时间',
  `kmz_md5` varchar(255) NOT NULL DEFAULT '' COMMENT 'kmzMD5',
  `kmz_json` longtext NOT NULL COMMENT '航线回显',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='航线管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_airline_floder`
--

DROP TABLE IF EXISTS `nz_airline_floder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_airline_floder` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '文件夹名称',
  `project_id` int(10) unsigned DEFAULT NULL COMMENT '所属项目',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='航线文件夹';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_algorithmbox`
--

DROP TABLE IF EXISTS `nz_algorithmbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_algorithmbox` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `appcenter_id` int(10) unsigned DEFAULT NULL COMMENT '所属应用',
  `avatar` varchar(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '算法名称',
  `pic` varchar(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `introduction` varchar(255) NOT NULL DEFAULT '' COMMENT '简介',
  `content` text DEFAULT NULL COMMENT '适用场景',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='算法盒子';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_appcenter`
--

DROP TABLE IF EXISTS `nz_appcenter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_appcenter` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '应用名称',
  `pic` varchar(255) NOT NULL DEFAULT '' COMMENT '应用图片',
  `introduction` varchar(255) NOT NULL DEFAULT '' COMMENT '应用简介',
  `content` text DEFAULT NULL COMMENT '应用详情',
  `launch_url` varchar(500) NOT NULL DEFAULT '' COMMENT '应用启动地址',
  `auth_mode` varchar(16) NOT NULL DEFAULT 'none' COMMENT '认证方式:none|sso',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=未开通,1=已开通',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='应用中心';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_area`
--

DROP TABLE IF EXISTS `nz_area`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_area` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `pid` int(11) unsigned DEFAULT NULL COMMENT '父id',
  `shortname` varchar(100) DEFAULT NULL COMMENT '简称',
  `name` varchar(100) DEFAULT NULL COMMENT '名称',
  `mergename` varchar(255) DEFAULT NULL COMMENT '全称',
  `level` tinyint(4) unsigned DEFAULT NULL COMMENT '层级:1=省,2=市,3=区/县',
  `pinyin` varchar(100) DEFAULT NULL COMMENT '拼音',
  `code` varchar(100) DEFAULT NULL COMMENT '长途区号',
  `zip` varchar(100) DEFAULT NULL COMMENT '邮编',
  `first` varchar(50) DEFAULT NULL COMMENT '首字母',
  `lng` varchar(50) DEFAULT NULL COMMENT '经度',
  `lat` varchar(50) DEFAULT NULL COMMENT '纬度',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `pid` (`pid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='省份地区表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_attachment`
--

DROP TABLE IF EXISTS `nz_attachment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_attachment` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `topic` varchar(20) NOT NULL DEFAULT '' COMMENT '细目',
  `admin_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '上传管理员ID',
  `user_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '上传用户ID',
  `url` varchar(255) NOT NULL DEFAULT '' COMMENT '物理路径',
  `width` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '宽度',
  `height` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '高度',
  `name` varchar(120) NOT NULL DEFAULT '' COMMENT '原始名称',
  `size` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '大小',
  `mimetype` varchar(100) NOT NULL DEFAULT '' COMMENT 'mime类型',
  `quote` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '上传(引用)次数',
  `storage` varchar(50) NOT NULL DEFAULT '' COMMENT '存储方式',
  `sha1` varchar(40) NOT NULL DEFAULT '' COMMENT 'sha1编码',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `last_upload_time` bigint(16) unsigned DEFAULT NULL COMMENT '最后上传时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=193 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='附件表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_captcha`
--

DROP TABLE IF EXISTS `nz_captcha`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_captcha` (
  `key` varchar(32) NOT NULL DEFAULT '' COMMENT '验证码Key',
  `code` varchar(32) NOT NULL DEFAULT '' COMMENT '验证码(加密后)',
  `captcha` text DEFAULT NULL COMMENT '验证码数据',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `expire_time` bigint(16) unsigned DEFAULT NULL COMMENT '过期时间',
  PRIMARY KEY (`key`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='验证码表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_config`
--

DROP TABLE IF EXISTS `nz_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_config` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(30) NOT NULL DEFAULT '' COMMENT '变量名',
  `group` varchar(30) NOT NULL DEFAULT '' COMMENT '分组',
  `title` varchar(50) NOT NULL DEFAULT '' COMMENT '变量标题',
  `tip` varchar(100) NOT NULL DEFAULT '' COMMENT '变量描述',
  `type` varchar(30) NOT NULL DEFAULT '' COMMENT '变量输入组件类型',
  `value` longtext DEFAULT NULL COMMENT '变量值',
  `content` longtext DEFAULT NULL COMMENT '字典数据',
  `rule` varchar(100) NOT NULL DEFAULT '' COMMENT '验证规则',
  `extend` varchar(255) NOT NULL DEFAULT '' COMMENT '扩展属性',
  `allow_del` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '允许删除:0=否,1=是',
  `weigh` int(11) NOT NULL DEFAULT 0 COMMENT '权重',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `name` (`name`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='系统配置';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_crud_log`
--

DROP TABLE IF EXISTS `nz_crud_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_crud_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `table_name` varchar(200) NOT NULL DEFAULT '' COMMENT '数据表名',
  `comment` varchar(255) NOT NULL DEFAULT '' COMMENT '注释',
  `table` text DEFAULT NULL COMMENT '数据表数据',
  `fields` longtext DEFAULT NULL COMMENT '字段数据',
  `sync` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '同步记录',
  `status` enum('delete','success','error','start') NOT NULL DEFAULT 'start' COMMENT '状态:delete=已删除,success=成功,error=失败,start=生成中',
  `connection` varchar(100) NOT NULL DEFAULT '' COMMENT '数据库连接配置标识',
  `create_time` bigint(20) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='CRUD记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_djilog`
--

DROP TABLE IF EXISTS `nz_djilog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_djilog` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sn` varchar(255) NOT NULL DEFAULT '' COMMENT '设备SN',
  `module` enum('0','3') DEFAULT '0' COMMENT '日志模块:0=飞行器,3=机场',
  `boot_index` int(10) DEFAULT NULL COMMENT '文件引索',
  `size` bigint(16) DEFAULT NULL COMMENT '日志大小',
  `start_time` bigint(16) unsigned DEFAULT NULL COMMENT '日志开始时间',
  `end_time` bigint(16) unsigned DEFAULT NULL COMMENT '日志结束时间',
  `status` enum('0','1') DEFAULT '0' COMMENT '已下载:0=未下载,1=已下载',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=992 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='日志管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_equipment`
--

DROP TABLE IF EXISTS `nz_equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_equipment` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `parent_id` int(10) DEFAULT NULL COMMENT '主网关',
  `manufacturer` enum('0','1') NOT NULL DEFAULT '0' COMMENT '设备厂商:0=大疆,1=道通',
  `model` enum('3-2-0','3-3-0','0-91-0','0-91-1','0-100-0','0-100-1') DEFAULT '3-2-0' COMMENT '设备型号:3-2-0=大疆机场2,3-3-0=大疆机场3,0-91-0=M3D,0-91-1=M3TD,0-100-0=M4D,0-100-1=M4TD',
  `type` enum('0','1','2','3') DEFAULT '3' COMMENT '设备类型:0=飞机类,1=负载类,2=遥控器类,3=机场类',
  `nickname` varchar(255) NOT NULL DEFAULT '' COMMENT '设备名称',
  `sn` varchar(255) NOT NULL DEFAULT '' COMMENT '设备sn',
  `project_id` int(10) unsigned DEFAULT NULL COMMENT '所属项目',
  `firmware_version` varchar(255) NOT NULL DEFAULT '' COMMENT '固件版本',
  `mode_code` enum('0','1','2','3','4','5') DEFAULT '0' COMMENT '工作状态:0=空闲中,1=现场调试,2=远程调试,3=固件升级中,4=作业中,5=待标定',
  `is_initialization` enum('0','1') DEFAULT '0' COMMENT '是否初始化:0=未初始化,1=已初始化',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='设备厂商管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_equipment_aircraft`
--

DROP TABLE IF EXISTS `nz_equipment_aircraft`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_equipment_aircraft` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '飞行器名称',
  `pic` varchar(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `firmware_version` varchar(255) NOT NULL DEFAULT '' COMMENT '固件版本',
  `scenarios` varchar(255) NOT NULL DEFAULT '' COMMENT '应用场景',
  `content` text DEFAULT NULL COMMENT '详情',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='飞行器市场';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_equipment_alarm`
--

DROP TABLE IF EXISTS `nz_equipment_alarm`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_equipment_alarm` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `equipment_id` int(10) unsigned DEFAULT NULL COMMENT '所属设备',
  `level` enum('0','1','2') DEFAULT '0' COMMENT '告警等级:0=通知,1=提醒,2=警告',
  `module` enum('0','1','2','3') DEFAULT '0' COMMENT '事件模块:0=飞行任务,1=设备管理,2=媒体,3=hms',
  `in_the_sky` enum('0','1') DEFAULT '0' COMMENT '是否飞行:0=在地上,1=在天上',
  `code` varchar(255) NOT NULL DEFAULT '' COMMENT '告警码',
  `device_type` varchar(255) NOT NULL DEFAULT '' COMMENT '设备类型',
  `imminent` enum('0','1') DEFAULT '0' COMMENT '是否及时性:0=否,1=是',
  `content` varchar(255) NOT NULL DEFAULT '' COMMENT '告警内容',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='设备警报';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_equipment_load`
--

DROP TABLE IF EXISTS `nz_equipment_load`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_equipment_load` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '负载名称',
  `pic` varchar(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `firmware_version` varchar(255) NOT NULL DEFAULT '' COMMENT '固件版本',
  `scenarios` varchar(255) NOT NULL DEFAULT '' COMMENT '应用场景',
  `content` text DEFAULT NULL COMMENT '详情',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='负载市场';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_errormsg`
--

DROP TABLE IF EXISTS `nz_errormsg`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_errormsg` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `code` varchar(255) NOT NULL DEFAULT '' COMMENT '错误码',
  `msg` varchar(255) NOT NULL DEFAULT '' COMMENT '错误内容',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='报错翻译';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_flightosd`
--

DROP TABLE IF EXISTS `nz_flightosd`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_flightosd` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sn` varchar(255) NOT NULL DEFAULT '' COMMENT '飞行器SN',
  `dock_sn` varchar(255) NOT NULL DEFAULT '' COMMENT '机场SN',
  `latitude` double DEFAULT NULL COMMENT '实时纬度',
  `longitude` double DEFAULT NULL COMMENT '实时经度',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=27263 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='任务轨迹';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_flightrecord`
--

DROP TABLE IF EXISTS `nz_flightrecord`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_flightrecord` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sn` varchar(255) NOT NULL DEFAULT '' COMMENT 'SN',
  `flight_id` varchar(255) DEFAULT NULL COMMENT '所属任务',
  `current_waypoint_index` int(10) DEFAULT NULL COMMENT '当前航点',
  `media_count` int(10) DEFAULT NULL COMMENT '媒体数量',
  `wayline_mission_state` enum('0','1','2','3','4','5','6','7','8','9') DEFAULT '0' COMMENT '任务状态:0=断连,1=不支持该航点,2=航线准备状态,可上传文件,可执行已有文件,3=航线文件上传中,4=触发开始命令，飞行器触发读航线等逻辑，还未开始任务，处于准备状态,5=进入航线,到第一个航点,6=航线执行,7=航线中断,8=航线恢复,9=航线结束',
  `track_id` varchar(255) NOT NULL DEFAULT '' COMMENT '航迹ID',
  `break_point_index` int(10) DEFAULT NULL COMMENT '断点序号',
  `break_point_state` enum('0','1') DEFAULT '0' COMMENT '断点状态:0=在航段上,1=在航点上',
  `break_point_progress` decimal(5,2) DEFAULT NULL COMMENT '航段进度',
  `break_point_wayline_id` int(10) DEFAULT NULL COMMENT '航线ID',
  `break_point_break_reason` enum('0','1','4','257','258','259','261','262','513','514','516','517','518','519','521','522','523','524','526','527','529','769','770','771','772','773','775','778','784','1281','1282','1283','1539','1547','1548','1549','1550','1551','1552','1553','1561','1563','1564','1565','1588','1595','1598','1602','65534','65535') DEFAULT '0' COMMENT '中断原因:0=无异常,1=Mission ID 不存在，航线任务未执行,4=请求开始/恢复航线任务时，航线文件加载出错,257=航线已经开始，不能再次开始,258=此状态下无法中断航线，只允许在航线执行状态时暂停航线,259=航线未开始，不能结束航线,261=飞行任务冲突，无法获取飞行器控制权，不允许在降落和返航中开始航线,262=该状态下无法恢复航线，只允许在航线暂停状态时恢复航线,513=飞行器超过限高高度,514=飞行器超过限远距离,516=飞行器触发限低,517=飞行器触发避障,518=RTK 信号差,519=接近禁飞区边界,521=超过机场限飞区限高,522=航线请求起飞失败,523=起飞任务执行失败,524=请求航线任务失败,526=请求航线 RTK 收敛任务失败,527=航线 RTK 收敛任务运行失败,529=有障碍物或者禁飞区域，导致航线无法到达,769=GPS 信号弱,770=遥控器档位不在 N 档,771=返航点未刷新,772=当前电量过低无法开始任务,773=低电量返航导致航线中断,775=遥控器与飞行器失联,778=飞行器在地面起桨，不允许开始航线,784=大风返航导致航线中断,1281=用户退出,1282=用户中断,1283=用户触发返航,1539=开始信息（航点 index 或者 progress）错误,1547=航线全局速度超过合理范围,1548=航点数量异常,1549=经纬度数据异常,1550=转弯截距异常,1551=航段最大速度超过合理范围,1552=航段目标速度超过合理范围,1553=航点 yaw 角度超过合理范围,1561=断点续飞的标志位设置错误,1563=航线生成失败,1564=航线运行失败,1565=航线避障紧急刹停,1588=无法识别的动作类型,1595=动作 ID 不能重复,1598=动作 ID 值不能为 65535,1602=动作组数量超过合理范围,65534=未知内部错误,65535=未知内部错误',
  `break_point_latitude` decimal(5,2) DEFAULT NULL COMMENT '断点纬度',
  `break_point_longitude` decimal(5,2) DEFAULT NULL COMMENT '断点经度',
  `break_point_height` decimal(5,2) DEFAULT NULL COMMENT '椭球高',
  `wayline_id` varchar(255) NOT NULL DEFAULT '' COMMENT '当前航线',
  `progress_current_step` enum('0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','65533','65534','65535') DEFAULT '0' COMMENT '执行步骤:0=初始状态,1=启动前检查，飞行器是否在执行航线中,2=启动前检查，机场是否退出工作模式,3=启动前检查，航线执行中,4=启动前检查，返航中,5=航线执行进入准备状态，开始等待任务下发,6=机场进入工作状态,7=进入开机检查准备工作和开盖准备工作,8=图传远程对频,9=等待飞行系统准备就绪，推送连接建立,10=等待 RTK 源监听有值上报,11=检查 RTK 源是否是机场源，如果不是要重新设置,12=等待飞行控制权通知,13=机场无控制权，抢夺飞行器控制权,14=自定义飞行区一致性检查,15=离线地图一致性检查,16=获取最新 KMZ URL,17=下载 KMZ,18=KMZ 上传中,19=染色配置,20=飞行器起飞参数设置，备降点设置，起飞高度设置，染色设置,21=飞行器 flyto 起飞参数设置,22=起飞机场检查降落机场准备状态,23=Home 点设置,24=触发执行航线,26=进入返航的检查准备工作,27=飞行器降落机场,28=降落以后的关盖,29=机场退出工作模式,30=机场异常恢复,31=机场上传飞行系统日志,32=相机录像状态检查,33=获取媒体文件数量,34=机场起飞开盖的异常恢复,35=通知任务结果,36=日志列表拉取 - 飞行器列表,37=日志列表拉取 - 拉取机场列表,38=日志列表拉取 - 上传日志列表结果,39=日志拉取-拉取飞行器日志,40=日志拉取-拉取机场日志,41=日志拉取-压缩飞行器日志,42=日志拉取-压缩机场日志,43=日志拉取-上传飞行器日志,44=日志拉取-上传机场日志,45=日志拉取-通知结果,46=自定义飞行区文件更新准备中,47=自定义飞行区更新中,48=离线地图更新准备中,49=离线地图更新中,65533=结束后等待服务回包,65534=无具体状态,65535=UNKNOWN',
  `progress_percent` int(10) DEFAULT NULL COMMENT '数字',
  `status` enum('canceled','failed','in_progress','ok','partially_done','paused','rejected','sent','timeout') DEFAULT 'canceled' COMMENT '任务状态:canceled=取消或终止,failed=失败,in_progress=执行中,ok=执行成功,partially_done=部分完成,paused=暂停,rejected=拒绝,sent=已下发,timeout=超时',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=11779 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='飞行记录';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_flighttask`
--

DROP TABLE IF EXISTS `nz_flighttask`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_flighttask` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) DEFAULT NULL,
  `bid` varchar(255) NOT NULL DEFAULT '' COMMENT '业务ID',
  `tid` varchar(255) NOT NULL DEFAULT '' COMMENT '事务ID',
  `airline_id` int(10) unsigned DEFAULT NULL COMMENT '任务执行航线',
  `equipment_id` int(10) unsigned DEFAULT NULL COMMENT '任务执行设备',
  `execute_time` bigint(16) unsigned DEFAULT NULL COMMENT '开始执行时间',
  `end_time` bigint(16) unsigned DEFAULT NULL COMMENT '任务结束时间',
  `task_type` enum('0','1') DEFAULT '0' COMMENT '任务类型:0=立即任务,1=定时任务',
  `file_url` varchar(255) NOT NULL DEFAULT '' COMMENT '航线文件URL',
  `file_fingerprint` varchar(255) NOT NULL DEFAULT '' COMMENT '航线文件签名',
  `rth_altitude` int(10) DEFAULT NULL COMMENT '返航高度',
  `rth_mode` enum('0','1') DEFAULT '0' COMMENT '返航高度模式:0=智能高度,1=设定高度',
  `out_of_control_action` enum('0','1','2') DEFAULT '0' COMMENT '遥控器失控动作:0=返航,1=悬停,2=降落',
  `exit_wayline_when_rc_lost` enum('0','1','2') DEFAULT '0' COMMENT '航线失控动作:0=继续执行航线任务,1=退出航线任务,2=执行遥控器失控动作',
  `wayline_precision_type` enum('0','1') DEFAULT '0' COMMENT '航线精度类型:0=GPS 任务,1=高精度 RTK 任务',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  `status` enum('canceled','failed','in_progress','ok','partially_done','paused','rejected','sent','timeout') DEFAULT 'canceled' COMMENT '执行状态:canceled=取消或终止,failed=失败,in_progress=执行中,ok=执行成功,partially_done=部分完成,paused=暂停,rejected=拒绝,sent=已下发,timeout=超时',
  `admin_id` int(10) unsigned DEFAULT NULL COMMENT '创建人',
  `error_code` varchar(255) NOT NULL DEFAULT '' COMMENT '错误码',
  `error_msg` varchar(255) NOT NULL DEFAULT '' COMMENT '错误原因',
  `total_point` int(10) DEFAULT NULL COMMENT '总航点',
  `now_point` int(10) DEFAULT NULL COMMENT '执行航点',
  `media_total` int(10) DEFAULT 0 COMMENT '媒体数量',
  `media_now` int(10) DEFAULT 0 COMMENT '上传数量',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=397 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='计划任务';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_hms`
--

DROP TABLE IF EXISTS `nz_hms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_hms` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `code` varchar(255) NOT NULL DEFAULT '' COMMENT '告警码',
  `en` varchar(1000) NOT NULL DEFAULT '' COMMENT '中文文案',
  `zh` varchar(255) NOT NULL DEFAULT '' COMMENT '英文文案',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='HMS管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_hmscenter`
--

DROP TABLE IF EXISTS `nz_hmscenter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_hmscenter` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `sn` varchar(255) NOT NULL DEFAULT '' COMMENT 'SN',
  `level` enum('0','1','2') DEFAULT '0' COMMENT '告警等级:0=通知,1=提醒,2=警告',
  `module` enum('0','1','2','3') DEFAULT '0' COMMENT '事件模块:0=飞行任务,1=设备管理,2=媒体,3=hms',
  `in_the_sky` enum('0','1') DEFAULT '0' COMMENT '是否飞行:0=在地上,1=在天上',
  `code` varchar(255) NOT NULL DEFAULT '' COMMENT '告警码',
  `device_type` varchar(255) NOT NULL DEFAULT '' COMMENT '设备类型',
  `imminent` enum('0','1') DEFAULT '0' COMMENT '是否及时:0=否,1=是',
  `component_index` int(10) DEFAULT NULL COMMENT '文案变量',
  `sensor_index` int(10) DEFAULT NULL COMMENT '文案变量',
  `message` varchar(255) NOT NULL DEFAULT '' COMMENT '转换消息',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=18380 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='健康告警';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_llmcenter_sso_ticket`
--

DROP TABLE IF EXISTS `nz_llmcenter_sso_ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_llmcenter_sso_ticket` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_hash` char(64) NOT NULL,
  `admin_id` bigint(20) unsigned NOT NULL,
  `audience` varchar(32) NOT NULL,
  `parent_token_cipher` text NOT NULL,
  `expires_at` bigint(20) unsigned NOT NULL,
  `consumed_at` bigint(20) unsigned DEFAULT NULL,
  `session_handle_hash` char(64) DEFAULT NULL,
  `session_expires_at` bigint(20) unsigned NOT NULL,
  `revoked` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `create_time` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_hash` (`ticket_hash`),
  UNIQUE KEY `session_handle_hash` (`session_handle_hash`),
  KEY `admin_expiry` (`admin_id`,`session_expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=238 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_media`
--

DROP TABLE IF EXISTS `nz_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_media` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `type` enum('0','1','2') DEFAULT '0' COMMENT '下拉框:0=图片,1=视频,2=其它',
  `sn` varchar(255) NOT NULL DEFAULT '' COMMENT 'SN',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '文件名称',
  `object_key` varchar(255) NOT NULL DEFAULT '' COMMENT '存储桶路径',
  `path` varchar(255) NOT NULL DEFAULT '' COMMENT '业务路径',
  `flight_id` varchar(255) NOT NULL DEFAULT '' COMMENT '任务ID',
  `drone_model_key` varchar(255) NOT NULL DEFAULT '' COMMENT '无人机型号',
  `payload_model_key` varchar(255) NOT NULL DEFAULT '' COMMENT '负载型号',
  `is_original` enum('0','1') DEFAULT '0' COMMENT '是否原图:0=否,1=是',
  `gimbal_yaw_degree` decimal(5,2) DEFAULT NULL COMMENT '云台偏航角',
  `absolute_altitude` decimal(5,2) DEFAULT NULL COMMENT '拍摄绝对高度',
  `relative_altitude` decimal(5,2) DEFAULT NULL COMMENT '拍摄相对高度',
  `c_time` varchar(255) DEFAULT NULL COMMENT '拍摄时间',
  `lat` double DEFAULT NULL COMMENT '拍摄位置纬度',
  `lng` double DEFAULT NULL COMMENT '拍摄位置经度',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=419 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='媒体管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_migrations`
--

DROP TABLE IF EXISTS `nz_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_migrations` (
  `version` bigint(20) NOT NULL,
  `migration_name` varchar(100) DEFAULT NULL,
  `start_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `breakpoint` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`version`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_modemanage`
--

DROP TABLE IF EXISTS `nz_modemanage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_modemanage` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '模型标识',
  `project_id` int(10) unsigned DEFAULT NULL COMMENT '所属项目',
  `url` varchar(255) NOT NULL DEFAULT '' COMMENT '模型地址',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '是否启用:0=关,1=开',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='模型管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_project`
--

DROP TABLE IF EXISTS `nz_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_project` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '项目名称',
  `introduction` varchar(255) NOT NULL DEFAULT '' COMMENT '简介',
  `longitude` varchar(255) NOT NULL DEFAULT '' COMMENT '经度',
  `latitude` varchar(255) NOT NULL DEFAULT '' COMMENT '纬度',
  `is_stop` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '云端阻飞:0=关,1=开',
  `wind_speed` int(10) DEFAULT NULL COMMENT '云端阻飞风速',
  `rainfall` enum('0','1','2','3') DEFAULT '0' COMMENT '云端阻飞雨量:0=无雨,1=小雨,2=中雨,3=大雨',
  `admin_id` int(10) unsigned DEFAULT NULL COMMENT '创建人',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='项目管理';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_project_admin`
--

DROP TABLE IF EXISTS `nz_project_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_project_admin` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `project_id` int(10) unsigned DEFAULT NULL COMMENT '项目名称',
  `admin_id` int(10) unsigned DEFAULT NULL COMMENT '管理员',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=关,1=开',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='项目成员';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_project_user`
--

DROP TABLE IF EXISTS `nz_project_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_project_user` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `project_id` int(10) unsigned DEFAULT NULL COMMENT '项目名称',
  `admin_id` int(10) unsigned DEFAULT NULL COMMENT '管理员',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=关,1=开',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='项目成员';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_runos_config`
--

DROP TABLE IF EXISTS `nz_runos_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_runos_config` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int(10) unsigned NOT NULL COMMENT 'NexusHive管理员ID',
  `config_json` longtext NOT NULL COMMENT 'RunOS账号配置JSON',
  `config_version` int(10) unsigned NOT NULL DEFAULT 1,
  `create_time` bigint(20) unsigned NOT NULL,
  `update_time` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_runos_config_admin` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RunOS账号配置';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_runos_sso_ticket`
--

DROP TABLE IF EXISTS `nz_runos_sso_ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_runos_sso_ticket` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `admin_id` int(10) unsigned NOT NULL,
  `expires_at` bigint(20) unsigned NOT NULL,
  `consumed_at` bigint(20) unsigned DEFAULT NULL,
  `create_time` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_runos_ticket_hash` (`ticket_hash`),
  KEY `idx_runos_ticket_expiry` (`expires_at`),
  KEY `idx_runos_ticket_admin` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=478 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RunOS一次性登录票据';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_security_data_recycle`
--

DROP TABLE IF EXISTS `nz_security_data_recycle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_security_data_recycle` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(50) NOT NULL DEFAULT '' COMMENT '规则名称',
  `controller` varchar(100) NOT NULL DEFAULT '' COMMENT '控制器',
  `controller_as` varchar(100) NOT NULL DEFAULT '' COMMENT '控制器别名',
  `data_table` varchar(100) NOT NULL DEFAULT '' COMMENT '对应数据表',
  `connection` varchar(100) NOT NULL DEFAULT '' COMMENT '数据库连接配置标识',
  `primary_key` varchar(50) NOT NULL DEFAULT '' COMMENT '数据表主键',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='回收规则表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_security_data_recycle_log`
--

DROP TABLE IF EXISTS `nz_security_data_recycle_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_security_data_recycle_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `admin_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '操作管理员',
  `recycle_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '回收规则ID',
  `data` text DEFAULT NULL COMMENT '回收的数据',
  `data_table` varchar(100) NOT NULL DEFAULT '' COMMENT '数据表',
  `connection` varchar(100) NOT NULL DEFAULT '' COMMENT '数据库连接配置标识',
  `primary_key` varchar(50) NOT NULL DEFAULT '' COMMENT '数据表主键',
  `is_restore` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '是否已还原:0=否,1=是',
  `ip` varchar(50) NOT NULL DEFAULT '' COMMENT '操作者IP',
  `useragent` varchar(255) NOT NULL DEFAULT '' COMMENT 'User-Agent',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='数据回收记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_security_sensitive_data`
--

DROP TABLE IF EXISTS `nz_security_sensitive_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_security_sensitive_data` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(50) NOT NULL DEFAULT '' COMMENT '规则名称',
  `controller` varchar(100) NOT NULL DEFAULT '' COMMENT '控制器',
  `controller_as` varchar(100) NOT NULL DEFAULT '' COMMENT '控制器别名',
  `data_table` varchar(100) NOT NULL DEFAULT '' COMMENT '对应数据表',
  `connection` varchar(100) NOT NULL DEFAULT '' COMMENT '数据库连接配置标识',
  `primary_key` varchar(50) NOT NULL DEFAULT '' COMMENT '数据表主键',
  `data_fields` text DEFAULT NULL COMMENT '敏感数据字段',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='敏感数据规则表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_security_sensitive_data_log`
--

DROP TABLE IF EXISTS `nz_security_sensitive_data_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_security_sensitive_data_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `admin_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '操作管理员',
  `sensitive_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '敏感数据规则ID',
  `data_table` varchar(100) NOT NULL DEFAULT '' COMMENT '数据表',
  `connection` varchar(100) NOT NULL DEFAULT '' COMMENT '数据库连接配置标识',
  `primary_key` varchar(50) NOT NULL DEFAULT '' COMMENT '数据表主键',
  `data_field` varchar(50) NOT NULL DEFAULT '' COMMENT '被修改字段',
  `data_comment` varchar(50) NOT NULL DEFAULT '' COMMENT '被修改项',
  `id_value` int(11) NOT NULL DEFAULT 0 COMMENT '被修改项主键值',
  `before` text DEFAULT NULL COMMENT '修改前',
  `after` text DEFAULT NULL COMMENT '修改后',
  `ip` varchar(50) NOT NULL DEFAULT '' COMMENT '操作者IP',
  `useragent` varchar(255) NOT NULL DEFAULT '' COMMENT 'User-Agent',
  `is_rollback` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '是否已回滚:0=否,1=是',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='敏感数据修改记录';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_test_build`
--

DROP TABLE IF EXISTS `nz_test_build`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_test_build` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `title` varchar(100) NOT NULL DEFAULT '' COMMENT '标题',
  `keyword_rows` varchar(100) NOT NULL DEFAULT '' COMMENT '关键词',
  `content` text DEFAULT NULL COMMENT '内容',
  `views` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '浏览量',
  `likes` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '有帮助数',
  `dislikes` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '无帮助数',
  `note_textarea` varchar(100) NOT NULL DEFAULT '' COMMENT '备注',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `weigh` int(11) NOT NULL DEFAULT 0 COMMENT '权重',
  `update_time` bigint(20) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(20) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='知识库表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_token`
--

DROP TABLE IF EXISTS `nz_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_token` (
  `token` varchar(50) NOT NULL DEFAULT '' COMMENT 'Token',
  `type` varchar(15) NOT NULL DEFAULT '' COMMENT '类型',
  `user_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '用户ID',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `expire_time` bigint(16) unsigned DEFAULT NULL COMMENT '过期时间',
  PRIMARY KEY (`token`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='用户Token表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_user`
--

DROP TABLE IF EXISTS `nz_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_user` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `group_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '分组ID',
  `username` varchar(32) NOT NULL DEFAULT '' COMMENT '用户名',
  `nickname` varchar(50) NOT NULL DEFAULT '' COMMENT '昵称',
  `email` varchar(50) NOT NULL DEFAULT '' COMMENT '邮箱',
  `mobile` varchar(11) NOT NULL DEFAULT '' COMMENT '手机',
  `avatar` varchar(255) NOT NULL DEFAULT '' COMMENT '头像',
  `gender` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '性别:0=未知,1=男,2=女',
  `birthday` date DEFAULT NULL COMMENT '生日',
  `money` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '余额',
  `score` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '积分',
  `last_login_time` bigint(16) unsigned DEFAULT NULL COMMENT '上次登录时间',
  `last_login_ip` varchar(50) NOT NULL DEFAULT '' COMMENT '上次登录IP',
  `login_failure` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '登录失败次数',
  `join_ip` varchar(50) NOT NULL DEFAULT '' COMMENT '加入IP',
  `join_time` bigint(16) unsigned DEFAULT NULL COMMENT '加入时间',
  `motto` varchar(255) NOT NULL DEFAULT '' COMMENT '签名',
  `password` varchar(255) NOT NULL DEFAULT '' COMMENT '密码',
  `salt` varchar(30) NOT NULL DEFAULT '' COMMENT '密码盐（废弃待删）',
  `status` varchar(30) NOT NULL DEFAULT '' COMMENT '状态:enable=启用,disable=禁用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `username` (`username`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='会员表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_user_group`
--

DROP TABLE IF EXISTS `nz_user_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_user_group` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(50) NOT NULL DEFAULT '' COMMENT '组名',
  `rules` text DEFAULT NULL COMMENT '权限节点',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='会员组表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_user_money_log`
--

DROP TABLE IF EXISTS `nz_user_money_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_user_money_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `user_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '会员ID',
  `money` int(11) NOT NULL DEFAULT 0 COMMENT '变更余额',
  `before` int(11) NOT NULL DEFAULT 0 COMMENT '变更前余额',
  `after` int(11) NOT NULL DEFAULT 0 COMMENT '变更后余额',
  `memo` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='会员余额变动表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_user_rule`
--

DROP TABLE IF EXISTS `nz_user_rule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_user_rule` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `pid` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '上级菜单',
  `type` enum('route','menu_dir','menu','nav_user_menu','nav','button') NOT NULL DEFAULT 'menu' COMMENT '类型:route=路由,menu_dir=菜单目录,menu=菜单项,nav_user_menu=顶栏会员菜单下拉项,nav=顶栏菜单项,button=页面按钮',
  `title` varchar(50) NOT NULL DEFAULT '' COMMENT '标题',
  `name` varchar(50) NOT NULL DEFAULT '' COMMENT '规则名称',
  `path` varchar(100) NOT NULL DEFAULT '' COMMENT '路由路径',
  `icon` varchar(50) NOT NULL DEFAULT '' COMMENT '图标',
  `menu_type` enum('tab','link','iframe') NOT NULL DEFAULT 'tab' COMMENT '菜单类型:tab=选项卡,link=链接,iframe=Iframe',
  `url` varchar(255) NOT NULL DEFAULT '' COMMENT 'Url',
  `component` varchar(100) NOT NULL DEFAULT '' COMMENT '组件路径',
  `no_login_valid` tinyint(4) unsigned NOT NULL DEFAULT 0 COMMENT '未登录有效:0=否,1=是',
  `extend` enum('none','add_rules_only','add_menu_only') NOT NULL DEFAULT 'none' COMMENT '扩展属性:none=无,add_rules_only=只添加为路由,add_menu_only=只添加为菜单',
  `remark` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  `weigh` int(11) NOT NULL DEFAULT 0 COMMENT '权重',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 1 COMMENT '状态:0=禁用,1=启用',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '更新时间',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `pid` (`pid`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='会员菜单权限规则表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_user_score_log`
--

DROP TABLE IF EXISTS `nz_user_score_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_user_score_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `user_id` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '会员ID',
  `score` int(11) NOT NULL DEFAULT 0 COMMENT '变更积分',
  `before` int(11) NOT NULL DEFAULT 0 COMMENT '变更前积分',
  `after` int(11) NOT NULL DEFAULT 0 COMMENT '变更后积分',
  `memo` varchar(255) NOT NULL DEFAULT '' COMMENT '备注',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='会员积分变动表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_valgorithmbox`
--

DROP TABLE IF EXISTS `nz_valgorithmbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_valgorithmbox` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL DEFAULT '' COMMENT '算法名称',
  `avatar` varchar(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `introduction` varchar(255) NOT NULL DEFAULT '' COMMENT '算法简介',
  `content` text DEFAULT NULL COMMENT '算法详情',
  `create_time` bigint(16) unsigned DEFAULT NULL COMMENT '创建时间',
  `update_time` bigint(16) unsigned DEFAULT NULL COMMENT '修改时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='视觉算法中心';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nz_workflow_grant`
--

DROP TABLE IF EXISTS `nz_workflow_grant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nz_workflow_grant` (
  `grant_hash` char(64) NOT NULL,
  `admin_id` int(10) unsigned NOT NULL,
  `workflow_id` char(32) NOT NULL,
  `definition_sha256` char(64) NOT NULL,
  `token_cipher` text NOT NULL,
  `expires_at` bigint(20) NOT NULL,
  `revoked` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` bigint(20) NOT NULL,
  PRIMARY KEY (`grant_hash`),
  KEY `workflow_owner` (`admin_id`,`workflow_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-23 16:25:37
