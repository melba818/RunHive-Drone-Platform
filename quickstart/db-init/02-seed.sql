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
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `nz_admin_group`
--

/*!40000 ALTER TABLE `nz_admin_group` DISABLE KEYS */;
INSERT INTO `nz_admin_group` (`id`, `pid`, `name`, `rules`, `status`, `update_time`, `create_time`) VALUES (1,0,'超级管理组','*',1,1753156058,1753156058),
(2,1,'一级管理员','1,89,21,22,26,25,24,23,27,31,30,29,28,32,37,36,35,34,33,38,40,39,41,43,42,44,45,88,77,47,46,48,51,50,49,52,54,53,78,83,82,81,80,79,55,56,60,59,58,57,61,65,64,63,62,66,70,69,68,67,71,75,74,73,72,84,87,86,85,211,213,212,219,218,205,210,209,208,207,206,199,204,203,202,201,200,193,198,197,196,195,194,187,192,191,190,189,188,181,186,185,184,183,182,167,172,171,170,169,168,159,164,163,162,161,160,153,158,157,156,155,154,147,152,151,150,149,148,220,225,224,223,222,221,146,134,166,139,138,137,136,135,128,133,132,131,130,129,122,165,127,126,125,124,123,116,121,120,119,118,117,103,174,180,179,178,177,176,175,140,145,144,143,142,141,104,173,109,108,107,106,105,90,94,95,93,92,91,217,216,215,214,96,101,100,99,98,97,76,226,231,230,229,228,227,232,233,234,235',1,1791392006,1753156058),
(3,2,'二级管理员','21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43',1,1753156058,1753156058),
(4,3,'三级管理员','55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75',1,1753156058,1753156058);
/*!40000 ALTER TABLE `nz_admin_group` ENABLE KEYS */;

--
-- Dumping data for table `nz_admin_rule`
--

/*!40000 ALTER TABLE `nz_admin_rule` DISABLE KEYS */;
INSERT INTO `nz_admin_rule` (`id`, `pid`, `type`, `title`, `name`, `path`, `icon`, `menu_type`, `url`, `component`, `keepalive`, `extend`, `remark`, `weigh`, `status`, `update_time`, `create_time`) VALUES (1,0,'menu','数据看板','dashboard','dashboard','fa fa-dashboard','tab','','/src/views/backend/dashboard.vue',1,'none','Remark lang',1182,1,1755082657,1753156058),
(2,0,'menu_dir','权限管理','auth','auth','fa fa-group',NULL,'','',0,'none','',283,1,1753156058,1753156058),
(3,2,'menu','角色组管理','auth/group','auth/group','fa fa-group','tab','','/src/views/backend/auth/group/index.vue',1,'none','Remark lang',282,1,1753156058,1753156058),
(4,3,'button','查看','auth/group/index','','',NULL,'','',0,'none','',0,1,1753156058,1753156058),
(5,3,'button','添加','auth/group/add','','',NULL,'','',0,'none','',1,1,1755678295,1753156058),
(6,3,'button','编辑','auth/group/edit','','',NULL,'','',0,'none','',2,1,1755678295,1753156058),
(7,3,'button','删除','auth/group/del','','',NULL,'','',0,'none','',3,1,1755678295,1753156058),
(8,2,'menu','管理员管理','auth/admin','auth/admin','el-icon-UserFilled','tab','','/src/views/backend/auth/admin/index.vue',1,'none','',281,1,1753156058,1753156058),
(9,8,'button','查看','auth/admin/index','','',NULL,'','',0,'none','',4,1,1755678295,1753156058),
(10,8,'button','添加','auth/admin/add','','',NULL,'','',0,'none','',5,1,1755678295,1753156058),
(11,8,'button','编辑','auth/admin/edit','','',NULL,'','',0,'none','',6,1,1755678295,1753156058),
(12,8,'button','删除','auth/admin/del','','',NULL,'','',0,'none','',7,1,1755678295,1753156058),
(13,2,'menu','菜单规则管理','auth/rule','auth/rule','el-icon-Grid','tab','','/src/views/backend/auth/rule/index.vue',1,'none','',280,1,1753156058,1753156058),
(14,13,'button','查看','auth/rule/index','','',NULL,'','',0,'none','',8,1,1755678295,1753156058),
(15,13,'button','添加','auth/rule/add','','',NULL,'','',0,'none','',9,1,1755678295,1753156058),
(16,13,'button','编辑','auth/rule/edit','','',NULL,'','',0,'none','',10,1,1755678295,1753156058),
(17,13,'button','删除','auth/rule/del','','',NULL,'','',0,'none','',11,1,1755678295,1753156058),
(18,13,'button','快速排序','auth/rule/sortable','','',NULL,'','',0,'none','',12,1,1755678295,1753156058),
(19,2,'menu','管理员日志管理','auth/adminLog','auth/adminLog','el-icon-List','tab','','/src/views/backend/auth/adminLog/index.vue',1,'none','',279,1,1753156058,1753156058),
(20,19,'button','查看','auth/adminLog/index','','',NULL,'','',0,'none','',13,1,1755678295,1753156058),
(21,0,'menu_dir','会员管理','user','user','fa fa-drivers-license',NULL,'','',0,'none','',278,1,1753156058,1753156058),
(22,21,'menu','会员管理','user/user','user/user','fa fa-user','tab','','/src/views/backend/user/user/index.vue',1,'none','',277,1,1753156058,1753156058),
(23,22,'button','查看','user/user/index','','',NULL,'','',0,'none','',14,1,1755678295,1753156058),
(24,22,'button','添加','user/user/add','','',NULL,'','',0,'none','',15,1,1755678295,1753156058),
(25,22,'button','编辑','user/user/edit','','',NULL,'','',0,'none','',16,1,1755678295,1753156058),
(26,22,'button','删除','user/user/del','','',NULL,'','',0,'none','',17,1,1755678295,1753156058),
(27,21,'menu','会员分组管理','user/group','user/group','fa fa-group','tab','','/src/views/backend/user/group/index.vue',1,'none','',276,1,1753156058,1753156058),
(28,27,'button','查看','user/group/index','','',NULL,'','',0,'none','',18,1,1755678295,1753156058),
(29,27,'button','添加','user/group/add','','',NULL,'','',0,'none','',19,1,1755678295,1753156058),
(30,27,'button','编辑','user/group/edit','','',NULL,'','',0,'none','',20,1,1755678295,1753156058),
(31,27,'button','删除','user/group/del','','',NULL,'','',0,'none','',21,1,1755678295,1753156058),
(32,21,'menu','会员规则管理','user/rule','user/rule','fa fa-th-list','tab','','/src/views/backend/user/rule/index.vue',1,'none','',275,1,1753156058,1753156058),
(33,32,'button','查看','user/rule/index','','',NULL,'','',0,'none','',22,1,1755678295,1753156058),
(34,32,'button','添加','user/rule/add','','',NULL,'','',0,'none','',23,1,1755678295,1753156058),
(35,32,'button','编辑','user/rule/edit','','',NULL,'','',0,'none','',24,1,1755678295,1753156058),
(36,32,'button','删除','user/rule/del','','',NULL,'','',0,'none','',25,1,1755678295,1753156058),
(37,32,'button','快速排序','user/rule/sortable','','',NULL,'','',0,'none','',26,1,1755678295,1753156058),
(38,21,'menu','会员余额管理','user/moneyLog','user/moneyLog','el-icon-Money','tab','','/src/views/backend/user/moneyLog/index.vue',1,'none','',274,1,1753156058,1753156058),
(39,38,'button','查看','user/moneyLog/index','','',NULL,'','',0,'none','',27,1,1755678295,1753156058),
(40,38,'button','添加','user/moneyLog/add','','',NULL,'','',0,'none','',28,1,1755678295,1753156058),
(41,21,'menu','会员积分管理','user/scoreLog','user/scoreLog','el-icon-Discount','tab','','/src/views/backend/user/scoreLog/index.vue',1,'none','',273,1,1753156058,1753156058),
(42,41,'button','查看','user/scoreLog/index','','',NULL,'','',0,'none','',29,1,1755678295,1753156058),
(43,41,'button','添加','user/scoreLog/add','','',NULL,'','',0,'none','',30,1,1755678295,1753156058),
(44,0,'menu_dir','常规管理','routine','routine','fa fa-cogs',NULL,'','',0,'none','',272,1,1753156058,1753156058),
(45,44,'menu','系统配置','routine/config','routine/config','el-icon-Tools','tab','','/src/views/backend/routine/config/index.vue',1,'none','',271,1,1753156058,1753156058),
(46,45,'button','查看','routine/config/index','','',NULL,'','',0,'none','',31,1,1755678295,1753156058),
(47,45,'button','编辑','routine/config/edit','','',NULL,'','',0,'none','',32,1,1755678295,1753156058),
(48,44,'menu','附件管理','routine/attachment','routine/attachment','fa fa-folder','tab','','/src/views/backend/routine/attachment/index.vue',1,'none','Remark lang',270,1,1753156058,1753156058),
(49,48,'button','查看','routine/attachment/index','','',NULL,'','',0,'none','',33,1,1755678295,1753156058),
(50,48,'button','编辑','routine/attachment/edit','','',NULL,'','',0,'none','',34,1,1755678295,1753156058),
(51,48,'button','删除','routine/attachment/del','','',NULL,'','',0,'none','',35,1,1755678295,1753156058),
(52,44,'menu','个人资料','routine/adminInfo','routine/adminInfo','fa fa-user','tab','','/src/views/backend/routine/adminInfo.vue',1,'none','',269,1,1753156058,1753156058),
(53,52,'button','查看','routine/adminInfo/index','','',NULL,'','',0,'none','',36,1,1755678295,1753156058),
(54,52,'button','编辑','routine/adminInfo/edit','','',NULL,'','',0,'none','',37,1,1755678295,1753156058),
(55,0,'menu_dir','数据安全管理','security','security','fa fa-shield',NULL,'','',0,'none','',268,1,1753156058,1753156058),
(56,55,'menu','数据回收站','security/dataRecycleLog','security/dataRecycleLog','fa fa-database','tab','','/src/views/backend/security/dataRecycleLog/index.vue',1,'none','',267,1,1753156058,1753156058),
(57,56,'button','查看','security/dataRecycleLog/index','','',NULL,'','',0,'none','',38,1,1755678295,1753156058),
(58,56,'button','删除','security/dataRecycleLog/del','','',NULL,'','',0,'none','',39,1,1755678295,1753156058),
(59,56,'button','还原','security/dataRecycleLog/restore','','',NULL,'','',0,'none','',40,1,1755678295,1753156058),
(60,56,'button','查看详情','security/dataRecycleLog/info','','',NULL,'','',0,'none','',41,1,1755678295,1753156058),
(61,55,'menu','敏感数据修改记录','security/sensitiveDataLog','security/sensitiveDataLog','fa fa-expeditedssl','tab','','/src/views/backend/security/sensitiveDataLog/index.vue',1,'none','',266,1,1753156058,1753156058),
(62,61,'button','查看','security/sensitiveDataLog/index','','',NULL,'','',0,'none','',42,1,1755678295,1753156058),
(63,61,'button','删除','security/sensitiveDataLog/del','','',NULL,'','',0,'none','',43,1,1755678295,1753156058),
(64,61,'button','回滚','security/sensitiveDataLog/rollback','','',NULL,'','',0,'none','',44,1,1755678295,1753156058),
(65,61,'button','查看详情','security/sensitiveDataLog/info','','',NULL,'','',0,'none','',45,1,1755678295,1753156058),
(66,55,'menu','数据回收规则管理','security/dataRecycle','security/dataRecycle','fa fa-database','tab','','/src/views/backend/security/dataRecycle/index.vue',1,'none','Remark lang',265,1,1753156058,1753156058),
(67,66,'button','查看','security/dataRecycle/index','','',NULL,'','',0,'none','',46,1,1755678295,1753156058),
(68,66,'button','添加','security/dataRecycle/add','','',NULL,'','',0,'none','',47,1,1755678295,1753156058),
(69,66,'button','编辑','security/dataRecycle/edit','','',NULL,'','',0,'none','',48,1,1755678295,1753156058),
(70,66,'button','删除','security/dataRecycle/del','','',NULL,'','',0,'none','',49,1,1755678295,1753156058),
(71,55,'menu','敏感字段规则管理','security/sensitiveData','security/sensitiveData','fa fa-expeditedssl','tab','','/src/views/backend/security/sensitiveData/index.vue',1,'none','Remark lang',264,1,1753156058,1753156058),
(72,71,'button','查看','security/sensitiveData/index','','',NULL,'','',0,'none','',50,1,1755678295,1753156058),
(73,71,'button','添加','security/sensitiveData/add','','',NULL,'','',0,'none','',51,1,1755678295,1753156058),
(74,71,'button','编辑','security/sensitiveData/edit','','',NULL,'','',0,'none','',52,1,1755678295,1753156058),
(75,71,'button','删除','security/sensitiveData/del','','',NULL,'','',0,'none','',53,1,1755678295,1753156058),
(76,0,'menu','BuildAdmin','buildadmin','buildadmin','local-logo','link','https://doc.buildadmin.com','',0,'none','',54,0,1755678295,1753156058),
(77,45,'button','添加','routine/config/add','','',NULL,'','',0,'none','',55,1,1755678295,1753156058),
(78,0,'menu','模块市场','moduleStore/moduleStore','moduleStore','el-icon-GoodsFilled','tab','','/src/views/backend/module/index.vue',1,'none','',269,1,1753156058,1753156058),
(79,78,'button','查看','moduleStore/moduleStore/index','','',NULL,'','',0,'none','',56,1,1755678295,1753156058),
(80,78,'button','安装','moduleStore/moduleStore/install','','',NULL,'','',0,'none','',57,1,1755678295,1753156058),
(81,78,'button','调整状态','moduleStore/moduleStore/changeState','','',NULL,'','',0,'none','',58,1,1755678295,1753156058),
(82,78,'button','卸载','moduleStore/moduleStore/uninstall','','',NULL,'','',0,'none','',59,1,1755678295,1753156058),
(83,78,'button','更新','moduleStore/moduleStore/update','','',NULL,'','',0,'none','',60,1,1755678295,1753156058),
(84,0,'menu','CRUD代码生成','crud/crud','crud/crud','fa fa-code','tab','','/src/views/backend/crud/index.vue',1,'none','',263,1,1753156058,1753156058),
(85,84,'button','查看','crud/crud/index','','',NULL,'','',0,'none','',61,1,1755678295,1753156058),
(86,84,'button','生成','crud/crud/generate','','',NULL,'','',0,'none','',62,1,1755678295,1753156058),
(87,84,'button','删除','crud/crud/delete','','',NULL,'','',0,'none','',63,1,1755678295,1753156058),
(88,45,'button','删除','routine/config/del','','',NULL,'','',0,'none','',64,1,1755678295,1753156058),
(89,1,'button','查看','dashboard/index','','',NULL,'','',0,'none','',65,1,1755678295,1753156058),
(90,103,'menu','设备管理','device','equipment/device','fa fa-circle-o','tab','','/src/views/backend/equipment/device/index.vue',1,'add_rules_only','',66,1,1755678295,1753164713),
(91,90,'button','查看','equipment/index','','',NULL,'','',0,'none','',67,1,1755678295,1753164713),
(92,90,'button','添加','equipment/add','','',NULL,'','',0,'none','',68,1,1755678295,1753164713),
(93,90,'button','编辑','equipment/edit','','',NULL,'','',0,'none','',69,1,1755678295,1753164713),
(94,90,'button','删除','equipment/del','','',NULL,'','',0,'none','',71,1,1755678295,1753164713),
(95,90,'button','快速排序','equipment/sortable','','',NULL,'','',0,'none','',70,1,1755678295,1753164713),
(96,0,'menu','项目管理','project','project','','tab','','/src/views/backend/project/index.vue',1,'none','',73,1,1755678295,1753167519),
(97,96,'button','查看','project/index','','',NULL,'','',0,'none','',74,1,1755678295,1753167519),
(98,96,'button','添加','project/add','','',NULL,'','',0,'none','',75,1,1755678295,1753167519),
(99,96,'button','编辑','project/edit','','',NULL,'','',0,'none','',76,1,1755678295,1753167519),
(100,96,'button','删除','project/del','','',NULL,'','',0,'none','',77,1,1755678295,1753167519),
(101,96,'button','快速排序','project/sortable','','',NULL,'','',0,'none','',78,1,1755678295,1753167519),
(103,0,'menu_dir','设备管理','equipment','equipment','fa fa-circle-o','tab','/src/views/backend/equipment/index.vue','/src/views/backend/equipment/index.vue',0,'none','',79,1,1755678295,1753168093),
(104,103,'menu','飞行器市场','aircraft','equipment/aircraft','fa fa-circle-o','tab','','/src/views/backend/equipment/aircraft/index.vue',1,'add_rules_only','',80,1,1755678295,1753168093),
(105,104,'button','查看','equipment/aircraft/index','','',NULL,'','',0,'none','',81,1,1755678295,1753168093),
(106,104,'button','添加','equipment/aircraft/add','','',NULL,'','',0,'none','',82,1,1755678295,1753168093),
(107,104,'button','编辑','equipment/aircraft/edit','','',NULL,'','',0,'none','',83,1,1755678295,1753168093),
(108,104,'button','删除','equipment/aircraft/del','','',NULL,'','',0,'none','',84,1,1755678295,1753168093),
(109,104,'button','快速排序','equipment/aircraft/sortable','','',NULL,'','',0,'none','',85,1,1755678295,1753168093),
(116,0,'menu','项目成员','project/user','project/user','fa fa-circle-o','tab','','/src/views/backend/project/user/index.vue',1,'none','',86,1,1755678295,1753170076),
(117,116,'button','查看','project/user/index','','',NULL,'','',0,'none','',87,1,1755678295,1753170076),
(118,116,'button','添加','project/user/add','','',NULL,'','',0,'none','',88,1,1755678295,1753170076),
(119,116,'button','编辑','project/user/edit','','',NULL,'','',0,'none','',89,1,1755678295,1753170076),
(120,116,'button','删除','project/user/del','','',NULL,'','',0,'none','',90,1,1755678295,1753170076),
(121,116,'button','快速排序','project/user/sortable','','',NULL,'','',0,'none','',91,1,1755678295,1753170076),
(122,0,'menu','应用中心','appcenter','appcenter','','tab','','/src/views/backend/appcenter/index.vue',1,'none','',92,1,1755678295,1753170620),
(123,122,'button','查看','appcenter/index','','',NULL,'','',0,'none','',93,1,1755678295,1753170620),
(124,122,'button','添加','appcenter/add','','',NULL,'','',0,'none','',94,1,1755678295,1753170620),
(125,122,'button','编辑','appcenter/edit','','',NULL,'','',0,'none','',95,1,1755678295,1753170621),
(126,122,'button','删除','appcenter/del','','',NULL,'','',0,'none','',96,1,1755678295,1753170621),
(127,122,'button','快速排序','appcenter/sortable','','',NULL,'','',0,'none','',97,1,1755678295,1753170621),
(128,0,'menu','算法盒子','algorithmbox','algorithmbox','','tab','','/src/views/backend/algorithmbox/index.vue',1,'none','',98,1,1755678295,1753170838),
(129,128,'button','查看','algorithmbox/index','','',NULL,'','',0,'none','',99,1,1755678295,1753170838),
(130,128,'button','添加','algorithmbox/add','','',NULL,'','',0,'none','',100,1,1755678295,1753170838),
(131,128,'button','编辑','algorithmbox/edit','','',NULL,'','',0,'none','',101,1,1755678295,1753170838),
(132,128,'button','删除','algorithmbox/del','','',NULL,'','',0,'none','',102,1,1755678295,1753170838),
(133,128,'button','快速排序','algorithmbox/sortable','','',NULL,'','',0,'none','',103,1,1755678295,1753170838),
(134,0,'menu','视觉算法中心','valgorithmbox','valgorithmbox','','tab','','/src/views/backend/valgorithmbox/index.vue',1,'none','',104,1,1755678295,1753171002),
(135,134,'button','查看','valgorithmbox/index','','',NULL,'','',0,'none','',105,1,1755678295,1753171002),
(136,134,'button','添加','valgorithmbox/add','','',NULL,'','',0,'none','',106,1,1755678295,1753171002),
(137,134,'button','编辑','valgorithmbox/edit','','',NULL,'','',0,'none','',107,1,1755678295,1753171002),
(138,134,'button','删除','valgorithmbox/del','','',NULL,'','',0,'none','',108,1,1755678295,1753171002),
(139,134,'button','快速排序','valgorithmbox/sortable','','',NULL,'','',0,'none','',109,1,1755678295,1753171002),
(140,103,'menu','设备警报','equipment/alarm','equipment/alarm','','tab','','/src/views/backend/equipment/alarm/index.vue',1,'none','',110,0,1755678295,1753172881),
(141,140,'button','查看','equipment/alarm/index','','',NULL,'','',0,'none','',111,1,1755678295,1753172881),
(142,140,'button','添加','equipment/alarm/add','','',NULL,'','',0,'none','',112,1,1755678295,1753172881),
(143,140,'button','编辑','equipment/alarm/edit','','',NULL,'','',0,'none','',113,1,1755678295,1753172881),
(144,140,'button','删除','equipment/alarm/del','','',NULL,'','',0,'none','',114,1,1755678295,1753172881),
(145,140,'button','快速排序','equipment/alarm/sortable','','',NULL,'','',0,'none','',115,1,1755678295,1753172881),
(146,0,'menu','飞行空间','flightSpace','flightSpace','fa fa-circle-o','tab','','/src/views/backend/flightSpace/index.vue',1,'none','',116,1,1755678295,1754272910),
(147,0,'menu','航线管理','airline','airline','','tab','','/src/views/backend/airline/index.vue',1,'none','',117,1,1755678295,1754289468),
(148,147,'button','查看','airline/index','','',NULL,'','',0,'none','',118,1,1755678295,1754289468),
(149,147,'button','添加','airline/add','','',NULL,'','',0,'none','',119,1,1755678295,1754289468),
(150,147,'button','编辑','airline/edit','','',NULL,'','',0,'none','',120,1,1755678295,1754289468),
(151,147,'button','删除','airline/del','','',NULL,'','',0,'none','',121,1,1755678295,1754289468),
(152,147,'button','快速排序','airline/sortable','','',NULL,'','',0,'none','',122,1,1755678295,1754289468),
(153,0,'menu','计划任务','flighttask','flighttask','','tab','','/src/views/backend/flighttask/index.vue',1,'none','',123,1,1755678295,1754291286),
(154,153,'button','查看','flighttask/index','','',NULL,'','',0,'none','',124,1,1755678295,1754291286),
(155,153,'button','添加','flighttask/add','','',NULL,'','',0,'none','',125,1,1755678295,1754291286),
(156,153,'button','编辑','flighttask/edit','','',NULL,'','',0,'none','',126,1,1755678295,1754291286),
(157,153,'button','删除','flighttask/del','','',NULL,'','',0,'none','',127,1,1755678295,1754291286),
(158,153,'button','快速排序','flighttask/sortable','','',NULL,'','',0,'none','',128,1,1755678295,1754291286),
(159,0,'menu','日志管理','djilog','djilog','','tab','','/src/views/backend/djilog/index.vue',1,'none','',129,1,1755678295,1754980882),
(160,159,'button','查看','djilog/index','','',NULL,'','',0,'none','',130,1,1755678295,1754980882),
(161,159,'button','添加','djilog/add','','',NULL,'','',0,'none','',131,1,1755678295,1754980882),
(162,159,'button','编辑','djilog/edit','','',NULL,'','',0,'none','',132,1,1755678295,1754980882),
(163,159,'button','删除','djilog/del','','',NULL,'','',0,'none','',133,1,1755678295,1754980882),
(164,159,'button','快速排序','djilog/sortable','','',NULL,'','',0,'none','',134,1,1755678295,1754980882),
(165,122,'menu','应用详情','appcenter/detail','appcenter/detail','fa fa-circle-o','tab','','/src/views/backend/appcenter/detail/index.vue',0,'add_rules_only','',135,1,1755678295,1755074697),
(166,134,'menu','详情','valgorithmbox/detail','valgorithmbox/detail','fa fa-circle-o','tab','','/src/views/backend/valgorithmbox/detail/index.vue',0,'add_rules_only','',136,1,1755678295,1755077912),
(167,0,'menu','飞行记录','flightrecord','flightrecord','','tab','','/src/views/backend/flightrecord/index.vue',1,'none','',137,1,1755678295,1755078076),
(168,167,'button','查看','flightrecord/index','','',NULL,'','',0,'none','',138,1,1755678295,1755078076),
(169,167,'button','添加','flightrecord/add','','',NULL,'','',0,'none','',139,1,1755678295,1755078076),
(170,167,'button','编辑','flightrecord/edit','','',NULL,'','',0,'none','',140,1,1755678295,1755078076),
(171,167,'button','删除','flightrecord/del','','',NULL,'','',0,'none','',141,1,1755678295,1755078076),
(172,167,'button','快速排序','flightrecord/sortable','','',NULL,'','',0,'none','',142,1,1755678295,1755078076),
(173,104,'menu','飞行器详情','equipment/aircraft/detail','equipment/aircraft/detail','fa fa-circle-o','tab','','/src/views/backend/equipment/aircraft/detail.vue',0,'add_rules_only','',143,1,1755678295,1755078977),
(174,103,'menu','负载市场','equipment/load','equipment/load','fa fa-circle-o','tab','','/src/views/backend/equipment/load/index.vue',1,'add_rules_only','',144,1,1755678295,1755088144),
(175,174,'button','查看','equipment/load/index','','',NULL,'','',0,'none','',145,1,1755678295,1755088144),
(176,174,'button','添加','equipment/load/add','','',NULL,'','',0,'none','',146,1,1755678295,1755088144),
(177,174,'button','编辑','equipment/load/edit','','',NULL,'','',0,'none','',147,1,1755678295,1755088144),
(178,174,'button','删除','equipment/load/del','','',NULL,'','',0,'none','',148,1,1755678295,1755088144),
(179,174,'button','快速排序','equipment/load/sortable','','',NULL,'','',0,'none','',149,1,1755678295,1755088144),
(180,174,'menu','负载详情','equipment/load/detail','equipment/load/detail','fa fa-circle-o','tab','','/src/views/backend/equipment/load/detail.vue',0,'add_rules_only','',150,1,1755678295,1755088924),
(181,0,'menu','HMS管理','hms','hms','','tab','','/src/views/backend/hms/index.vue',1,'none','',151,1,1755678295,1755142835),
(182,181,'button','查看','hms/index','','',NULL,'','',0,'none','',152,1,1755678295,1755142835),
(183,181,'button','添加','hms/add','','',NULL,'','',0,'none','',153,1,1755678295,1755142835),
(184,181,'button','编辑','hms/edit','','',NULL,'','',0,'none','',154,1,1755678295,1755142835),
(185,181,'button','删除','hms/del','','',NULL,'','',0,'none','',155,1,1755678295,1755142835),
(186,181,'button','快速排序','hms/sortable','','',NULL,'','',0,'none','',156,1,1755678295,1755142835),
(187,0,'menu','健康告警','hmscenter','hmscenter','','tab','','/src/views/backend/hmscenter/index.vue',1,'none','',157,1,1755678295,1755150717),
(188,187,'button','查看','hmscenter/index','','',NULL,'','',0,'none','',158,1,1755678295,1755150717),
(189,187,'button','添加','hmscenter/add','','',NULL,'','',0,'none','',159,1,1755678295,1755150717),
(190,187,'button','编辑','hmscenter/edit','','',NULL,'','',0,'none','',160,1,1755678295,1755150717),
(191,187,'button','删除','hmscenter/del','','',NULL,'','',0,'none','',161,1,1755678295,1755150717),
(192,187,'button','快速排序','hmscenter/sortable','','',NULL,'','',0,'none','',162,1,1755678295,1755150717),
(193,0,'menu','媒体管理','media','media','','tab','','/src/views/backend/media/index.vue',1,'none','',163,1,1755678295,1755180442),
(194,193,'button','查看','media/index','','',NULL,'','',0,'none','',164,1,1755678295,1755180442),
(195,193,'button','添加','media/add','','',NULL,'','',0,'none','',165,1,1755678295,1755180442),
(196,193,'button','编辑','media/edit','','',NULL,'','',0,'none','',166,1,1755678295,1755180442),
(197,193,'button','删除','media/del','','',NULL,'','',0,'none','',167,1,1755678295,1755180442),
(198,193,'button','快速排序','media/sortable','','',NULL,'','',0,'none','',168,1,1755678295,1755180442),
(199,0,'menu','任务轨迹','flightosd','flightosd','','tab','','/src/views/backend/flightosd/index.vue',1,'none','',169,1,1755678295,1755191552),
(200,199,'button','查看','flightosd/index','','',NULL,'','',0,'none','',170,1,1755678295,1755191552),
(201,199,'button','添加','flightosd/add','','',NULL,'','',0,'none','',171,1,1755678295,1755191552),
(202,199,'button','编辑','flightosd/edit','','',NULL,'','',0,'none','',172,1,1755678295,1755191552),
(203,199,'button','删除','flightosd/del','','',NULL,'','',0,'none','',173,1,1755678295,1755191552),
(204,199,'button','快速排序','flightosd/sortable','','',NULL,'','',0,'none','',174,1,1755678295,1755191552),
(205,0,'menu','报错翻译','errormsg','errormsg','','tab','','/src/views/backend/errormsg/index.vue',1,'none','',175,1,1755678295,1755247097),
(206,205,'button','查看','errormsg/index','','',NULL,'','',0,'none','',176,1,1755678295,1755247097),
(207,205,'button','添加','errormsg/add','','',NULL,'','',0,'none','',177,1,1755678295,1755247097),
(208,205,'button','编辑','errormsg/edit','','',NULL,'','',0,'none','',178,1,1755678295,1755247097),
(209,205,'button','删除','errormsg/del','','',NULL,'','',0,'none','',179,1,1755678295,1755247097),
(210,205,'button','快速排序','errormsg/sortable','','',NULL,'','',0,'none','',180,1,1755678295,1755247097),
(211,0,'menu','设置','auth','auth','fa fa-circle-o','tab','','/src/views/backend/auth/index.vue',0,'none','',181,1,1755678295,1755676558),
(212,211,'button','删除','auth/del','','fa fa-circle-o','tab','','',0,'none','',182,1,1755678295,1755678204),
(213,211,'button','编辑','auth/edit','','fa fa-circle-o','tab','','',0,'none','',183,1,1755678295,1755678240),
(214,103,'button','查看','equipment/index','','fa fa-circle-o','tab','','',0,'none','',0,1,1755678355,1755678355),
(215,103,'button','删除','equipment/del','','fa fa-circle-o','tab','','',0,'none','',0,1,1755678383,1755678383),
(216,103,'button','添加','equipment/add','','fa fa-circle-o','tab','','',0,'none','',0,1,1755678406,1755678406),
(217,103,'button','编辑','equipment/edit','','fa fa-circle-o','tab','','',0,'none','',0,1,1755678432,1755678432),
(218,211,'button','添加','auth/add','','fa fa-circle-o','tab','','',0,'none','',0,1,1755678458,1755678458),
(219,211,'button','查看','auth/index','','fa fa-circle-o','tab','','',0,'none','',0,1,1755678482,1755678482),
(220,147,'menu','航线文件夹','airline/floder','airline/floder','','tab','','/src/views/backend/airline/floder/index.vue',1,'none','',0,1,1755742639,1755742639),
(221,220,'button','查看','airline/floder/index','','',NULL,'','',0,'none','',0,1,1755742639,1755742639),
(222,220,'button','添加','airline/floder/add','','',NULL,'','',0,'none','',0,1,1755742639,1755742639),
(223,220,'button','编辑','airline/floder/edit','','',NULL,'','',0,'none','',0,1,1755742639,1755742639),
(224,220,'button','删除','airline/floder/del','','',NULL,'','',0,'none','',0,1,1755742639,1755742639),
(225,220,'button','快速排序','airline/floder/sortable','','',NULL,'','',0,'none','',0,1,1755742639,1755742639),
(226,0,'menu','模型管理','modemanage','modemanage','','tab','','/src/views/backend/modemanage/index.vue',1,'none','',0,1,1761125483,1761125483),
(227,226,'button','查看','modemanage/index','','',NULL,'','',0,'none','',0,1,1761125483,1761125483),
(228,226,'button','添加','modemanage/add','','',NULL,'','',0,'none','',0,1,1761125483,1761125483),
(229,226,'button','编辑','modemanage/edit','','',NULL,'','',0,'none','',0,1,1761125483,1761125483),
(230,226,'button','删除','modemanage/del','','',NULL,'','',0,'none','',0,1,1761125483,1761125483),
(231,226,'button','快速排序','modemanage/sortable','','',NULL,'','',0,'none','',0,1,1761125483,1761125483),
(232,0,'menu','大模型中心','llmcenter','llmcenter','fa fa-microchip','tab','','/src/views/backend/llmcenter/index.vue',1,'none','',91,1,1791381816,1791381816),
(233,0,'menu','Agent中心','agentcenter','agentcenter','fa fa-comments','tab','','/src/views/backend/agentcenter/index.vue',1,'none','',90,1,1791392006,1791392006),
(234,0,'menu','工作流中心','workflowcenter','workflowcenter','fa fa-comments','tab','','/src/views/backend/workflowcenter/index.vue',1,'none','',89,1,1791392006,1791392006),
(235,0,'menu','资源库','resourcecenter','resourcecenter','fa fa-comments','tab','','/src/views/backend/resourcecenter/index.vue',1,'none','',88,1,1791392006,1791392006);
/*!40000 ALTER TABLE `nz_admin_rule` ENABLE KEYS */;

--
-- Dumping data for table `nz_config`
--

/*!40000 ALTER TABLE `nz_config` DISABLE KEYS */;
INSERT INTO `nz_config` (`id`, `name`, `group`, `title`, `tip`, `type`, `value`, `content`, `rule`, `extend`, `allow_del`, `weigh`) VALUES (1,'config_group','basics','Config group','','array','[{\"key\":\"basics\",\"value\":\"Basics\"},{\"key\":\"mail\",\"value\":\"Mail\"},{\"key\":\"config_quick_entrance\",\"value\":\"Config Quick entrance\"},{\"key\":\"upload\",\"value\":\"\\u4e0a\\u4f20\\u914d\\u7f6e\"}]',NULL,'required','',0,-1),
(2,'site_name','basics','Site Name','','string','RunHive',NULL,'required','',0,99),
(3,'record_number','basics','Record number','域名备案号','string','渝ICP备8888888号-1',NULL,'','',0,0),
(4,'version','basics','Version number','系统版本号','string','v1.0.0',NULL,'required','',0,0),
(5,'time_zone','basics','time zone','','string','Asia/Shanghai',NULL,'required','',0,0),
(6,'no_access_ip','basics','No access ip','禁止访问站点的ip列表,一行一个','textarea','',NULL,'','',0,0),
(7,'smtp_server','mail','smtp server','','string','smtp.qq.com',NULL,'','',0,9),
(8,'smtp_port','mail','smtp port','','string','465',NULL,'','',0,8),
(9,'smtp_user','mail','smtp user','','string',NULL,NULL,'','',0,7),
(10,'smtp_pass','mail','smtp pass','','string',NULL,NULL,'','',0,6),
(11,'smtp_verification','mail','smtp verification','','select','SSL','{\"SSL\":\"SSL\",\"TLS\":\"TLS\"}','','',0,5),
(12,'smtp_sender_mail','mail','smtp sender mail','','string',NULL,NULL,'email','',0,4),
(13,'config_quick_entrance','config_quick_entrance','Config Quick entrance','','array','[{\"key\":\"\\u6570\\u636e\\u56de\\u6536\\u89c4\\u5219\\u914d\\u7f6e\",\"value\":\"security\\/dataRecycle\"},{\"key\":\"\\u654f\\u611f\\u6570\\u636e\\u89c4\\u5219\\u914d\\u7f6e\",\"value\":\"security\\/sensitiveData\"}]',NULL,'','',0,0),
(14,'backend_entrance','basics','Backend entrance','','string','/admin',NULL,'required','',0,1),
(21,'upload_mode','upload','存储方式','','select','alioss','{\"local\":\"本地磁盘存储\",\"alioss\":\"阿里云对象存储OSS\"}','required','',0,99);
/*!40000 ALTER TABLE `nz_config` ENABLE KEYS */;

--
-- Dumping data for table `nz_user_rule`
--

/*!40000 ALTER TABLE `nz_user_rule` DISABLE KEYS */;
INSERT INTO `nz_user_rule` (`id`, `pid`, `type`, `title`, `name`, `path`, `icon`, `menu_type`, `url`, `component`, `no_login_valid`, `extend`, `remark`, `weigh`, `status`, `update_time`, `create_time`) VALUES (1,0,'menu_dir','我的账户','account','account','fa fa-user-circle','tab','','',0,'none','',98,1,1753156058,1753156058),
(2,1,'menu','账户概览','account/overview','account/overview','fa fa-home','tab','','/src/views/frontend/user/account/overview.vue',0,'none','',99,1,1753156058,1753156058),
(3,1,'menu','个人资料','account/profile','account/profile','fa fa-user-circle-o','tab','','/src/views/frontend/user/account/profile.vue',0,'none','',98,1,1753156058,1753156058),
(4,1,'menu','修改密码','account/changePassword','account/changePassword','fa fa-shield','tab','','/src/views/frontend/user/account/changePassword.vue',0,'none','',97,1,1753156058,1753156058),
(5,1,'menu','积分记录','account/integral','account/integral','fa fa-tag','tab','','/src/views/frontend/user/account/integral.vue',0,'none','',96,1,1753156058,1753156058),
(6,1,'menu','余额记录','account/balance','account/balance','fa fa-money','tab','','/src/views/frontend/user/account/balance.vue',0,'none','',95,1,1753156058,1753156058);
/*!40000 ALTER TABLE `nz_user_rule` ENABLE KEYS */;

--
-- Dumping data for table `nz_migrations`
--

/*!40000 ALTER TABLE `nz_migrations` DISABLE KEYS */;
INSERT INTO `nz_migrations` (`version`, `migration_name`, `start_time`, `end_time`, `breakpoint`) VALUES (20230620180908,'Install','2025-07-22 03:47:38','2025-07-22 03:47:38',0),
(20230620180916,'InstallData','2025-07-22 03:47:38','2025-07-22 03:47:38',0),
(20230622221507,'Version200','2025-07-22 03:47:38','2025-07-22 03:47:38',0),
(20230719211338,'Version201','2025-07-22 03:47:38','2025-07-22 03:47:38',0),
(20230905060702,'Version202','2025-07-22 03:47:38','2025-07-22 03:47:38',0),
(20231112093414,'Version205','2025-07-22 03:47:38','2025-07-22 03:47:38',0),
(20231229043002,'Version206','2025-07-22 03:47:38','2025-07-22 03:47:39',0),
(20250412134127,'Version222','2025-07-22 03:47:39','2025-07-22 03:47:39',0);
/*!40000 ALTER TABLE `nz_migrations` ENABLE KEYS */;

--
-- Dumping data for table `nz_security_sensitive_data`
--

/*!40000 ALTER TABLE `nz_security_sensitive_data` DISABLE KEYS */;
INSERT INTO `nz_security_sensitive_data` (`id`, `name`, `controller`, `controller_as`, `data_table`, `connection`, `primary_key`, `data_fields`, `status`, `update_time`, `create_time`) VALUES (1,'管理员数据','auth/Admin.php','auth/admin','admin','','id','{\"username\":\"用户名\",\"mobile\":\"手机\",\"password\":\"密码\",\"status\":\"状态\"}',1,1753156058,1753156058),
(2,'会员数据','user/User.php','user/user','user','','id','{\"username\":\"用户名\",\"mobile\":\"手机号\",\"password\":\"密码\",\"status\":\"状态\",\"email\":\"邮箱地址\"}',1,1753156058,1753156058),
(3,'管理员权限','auth/Group.php','auth/group','admin_group','','id','{\"rules\":\"权限规则ID\"}',1,1753156058,1753156058);
/*!40000 ALTER TABLE `nz_security_sensitive_data` ENABLE KEYS */;

--
-- Dumping data for table `nz_appcenter`
--

/*!40000 ALTER TABLE `nz_appcenter` DISABLE KEYS */;
INSERT INTO `nz_appcenter` (`id`, `name`, `pic`, `introduction`, `content`, `launch_url`, `auth_mode`, `status`, `create_time`, `update_time`) VALUES (1,'算法盒子','/storage/default/20250722/md5__87116e62c2e7afb3cb5c5928f6f12115f08a2279b0a71b0322.png','这里是介绍这里是介绍这里是介绍这里是介绍这里是介绍这里是介绍','<p>这里是详情这里是详情这里是详情这里是详情这里是详情这里是详情这里是详情这里是详情</p>','','none',1,1753170643,1755077032),
(2,'RunOS','http://127.0.0.1:4000/runos-logo.png','视觉数据管理、标注、训练与推理平台','<p>RunOS 使用 RunHive 账号登录，新数据保存在该账号独立目录。</p>','http://127.0.0.2:14000','sso',1,1790478230,1790478230);
/*!40000 ALTER TABLE `nz_appcenter` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-23 16:25:37
INSERT INTO `nz_admin` (`id`,`username`,`nickname`,`avatar`,`email`,`mobile`,`login_failure`,`last_login_time`,`last_login_ip`,`password`,`salt`,`motto`,`status`,`update_time`,`create_time`) VALUES (1,"admin","Admin","","","",0,NULL,"","$2y$12$56S/mI/hC1iMJv.KCICdvucF35Mop5uC4cZqQYa1x0aSpHL.FOypC","","","enable",UNIX_TIMESTAMP(),UNIX_TIMESTAMP());
INSERT INTO `nz_admin_group_access` (`uid`,`group_id`) VALUES (1,1);
