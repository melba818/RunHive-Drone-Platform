// Native AppShell owns the menus and resizing; theme adapts its inner row width.
export const agentTheme = `
:root,:root[data-theme]{
 --ui-canvas:#f5f8fc;--ui-surface:#fff;--ui-surface-muted:#f5f8fc;
 --ui-fg:#303133;--ui-fg-muted:#606266;--ui-fg-subtle:#909399;
 --ui-line:#e4e7ed;--ui-divider:#e4e7ed;--ui-line-muted:#ebeef5;
 --ui-accent:#409eff;--ui-accent-hover:#66b1ff;--ui-accent-active:#3a8ee6;
 --ui-accent-fg:#fff;--ui-accent-muted:#ecf5ff;--ui-accent-line:#bfdcff;
 --ui-fg-link:#409eff;--ui-fg-link-hover:#66b1ff;
 --ui-font-sans:"Microsoft YaHei","PingFang SC",Arial,sans-serif;
 --color-brand-500:#409eff;--color-brand-600:#409eff;--color-brand-700:#3a8ee6;
}
html,body{background:#f5f8fc!important;font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif!important}
.ui-shell,.ui-shell>[data-slot="main"]{background:#f5f8fc!important}
.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar{background:#fff!important}
.ui-shell>[data-slot="nav"] [aria-current="page"]{background:#ecf5ff!important;color:#409eff!important}
.ui-shell>[data-slot="nav"] a:hover,.ui-shell>[data-slot="nav"] button:hover{background-color:#ecf5ff}
/* Account controls belong to Runhive's outer navigation. Remove the duplicate
   account row, its divider/padding, and the collapsed rail's account trigger.
   These selectors are scoped to the embedded native navigation, including its
   mobile drawer, and match the pinned upstream SidebarFrame/Rail markup. */
.ui-shell>[data-slot="nav"] .shrink-0.border-t.border-line.p-2,
.rh-agent-mobile-sidebar .shrink-0.border-t.border-line.p-2,
.ui-shell>[data-slot="nav"] .mt-auto.shrink-0{display:none!important}
/* Reserve an action column inside the native row, including long titles.
   Keep the original buttons and body-portaled menu interactive at rest. */
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar)>div.h-full{
 width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]:has(>[data-testid="session-row"]){
 display:grid!important;grid-template-columns:minmax(0,1fr) 52px!important;
 width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box;gap:2px;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]>[data-testid="session-row"]{
 min-width:0!important;width:100%;overflow:hidden;padding-right:4px;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]:has(>[data-testid="session-row"])>div.relative{
 width:52px!important;min-width:52px!important;max-width:52px!important;justify-self:end;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]>div.relative>.peer{
 position:static!important;transform:none!important;translate:none!important;gap:2px;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]>div.relative>.peer>button{
 opacity:1!important;pointer-events:auto!important;color:#606266;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]>div.relative>.peer>button:hover{
 background:#ecf5ff;color:#409eff;
}
:is(.ui-shell>[data-slot="nav"],.rh-agent-mobile-sidebar) [data-title-reveal]>div.relative>span[aria-hidden]{display:none!important}
/* A dock measures its own available width; the viewport's sm breakpoint does
   not describe a narrow dock. Keep its timeline scroll local to the chart. */
[data-testid="dock"], [data-testid="dock"] .flex.flex-col{min-width:0}
[data-testid="dock"] .overflow-y-auto:has([data-round]){
 min-width:0;width:100%;max-width:100%;overflow-x:hidden;box-sizing:border-box;
}
[data-testid="dock"] .overflow-y-auto:has([data-round]) :is(.space-y-3,.space-y-4,[data-round]){
 min-width:0;max-width:100%;box-sizing:border-box;
}
[data-testid="dock"] .overflow-y-auto:has([data-round]) [class~="sm:grid-cols-3"]{
 grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))!important;
}
[data-testid="dock"] [data-round]>[data-slot="head"]{min-width:0;max-width:100%;flex-wrap:wrap}
[data-testid="dock"] [data-round]>[data-slot="head"]>div{
 min-width:0;flex:1 1 20rem;column-gap:10px;
}
[data-testid="dock"] [data-round] .ui-chart,
[data-testid="dock"] [data-round] .ui-chart>.no-scrollbar{min-width:0;max-width:100%}
[data-testid="dock"] [data-round] li,
[data-testid="dock"] [data-round] li>button{min-width:0;max-width:100%;box-sizing:border-box}
`
