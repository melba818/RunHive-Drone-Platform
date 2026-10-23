/** Presentation only: installed skill IDs and API payloads remain unchanged. */
const builtin: Readonly<Record<string, readonly [string, string]>> = {
  "a2ui": ["交互界面生成", "生成可交互的应用界面，预览内容在独立沙箱中运行。"],
  "agent-evaluation": ["智能体评估", "设计测试用例，评估智能体任务完成情况。"],
  "agent-initialization": ["智能体初始化", "整理任务目标与工作区资料，建立智能体初始配置。"],
  "agent-optimization": ["智能体优化", "分析执行结果并调整提示与工作流程。"],
  "benchmark-design": ["评测方案设计", "设计评测数据、指标与可重复的验证流程。"],
  "bento-slides": ["演示文稿制作", "组织演示内容并制作布局清晰的幻灯片。"],
  "browser-automation": ["浏览器自动化（需配置）", "浏览器操作流程参考；使用前需管理员配置相应工具。"],
  "data-analysis": ["数据分析", "整理工作区数据，完成统计分析和结果展示。"],
  "firecrawl": ["网页信息采集（需配置）", "网页采集流程参考；使用前需配置外部采集服务。"],
  "llamafactory": ["微调流程参考", "模型微调流程与参数参考；实际训练请使用大模型微调入口。"],
  "ollama": ["本地推理服务参考", "外部推理服务使用参考；服务部署与接入由管理员配置。"],
  "penguin-config": ["平台配置", "平台配置说明；模型接入和智能体设置请通过网页管理。"],
  "penguin-orchestration": ["任务编排", "组织任务依赖和智能体协作流程。"],
  "penguin-sdk": ["应用开发 SDK", "使用平台应用接口开发工作区应用。"],
  "skill-porting": ["技能适配", "整理技能资料并转换为可导入的技能目录。"],
  "software-engineering": ["软件开发", "在当前工作区完成代码修改、验证和交付。"],
  "unified-llm-api": ["模型接口集成", "模型调用接口参考；实际凭据由平台管理。"],
  "vllm": ["推理部署流程参考", "外部推理部署流程参考；服务部署与接入由管理员配置。"],
  "web-design": ["网页设计", "设计并实现网页布局、交互和视觉样式。"],
};
export function skillDisplayName(name: string): string {
  return Object.hasOwn(builtin, name) ? builtin[name]![0] : name;
}
export function builtinSkillBrief(name?: string): string | undefined {
  return name && Object.hasOwn(builtin, name) ? builtin[name]![1] : undefined;
}
