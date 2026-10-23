/* runhive-llm-center-css */
if(typeof document!=="undefined"&&!document.querySelector('link[data-runhive-agent-clean-v12]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/llm-center-agent-clean-index.css?v=agent-clean-20261009-v12';l.dataset.runhiveAgentCleanV12='1';document.head.appendChild(l)}
import{f as $,m as s,p as O}from"/assets/vue-FCF7ynEj.js";import{W as N,u as R}from"/assets/index-D5rXB33a.js";var u={tune:{title:"\u5927\u6A21\u578B\u5FAE\u8C03",items:[{key:"workspace",label:"\u5DE5\u4F5C\u53F0",icon:"home",description:"\u67E5\u770B\u4EFB\u52A1\u6982\u89C8\u4E0E\u5DE5\u4F5C\u533A\u72B6\u6001"},{key:"data",label:"\u8BAD\u7EC3\u6570\u636E",icon:"database",description:"\u5BFC\u5165\u548C\u7BA1\u7406\u5F53\u524D\u8D26\u53F7\u7684\u8BAD\u7EC3\u6570\u636E"},{key:"train",label:"\u5FAE\u8C03\u4EFB\u52A1",icon:"sliders",description:"\u914D\u7F6E\u5E76\u8FD0\u884C\u6A21\u578B\u5FAE\u8C03\u4EFB\u52A1"},{key:"eval",label:"\u8BC4\u4F30\u9A8C\u8BC1",icon:"chart",description:"\u9A8C\u8BC1\u6A21\u578B\u6548\u679C\u4E0E\u8BC4\u4F30\u7ED3\u679C"},{key:"chat",label:"\u5BF9\u8BDD\u6D4B\u8BD5",icon:"message",description:"\u6D4B\u8BD5\u6A21\u578B\u7684\u5BF9\u8BDD\u4E0E\u89C6\u89C9\u80FD\u529B"},{key:"export",label:"\u6A21\u578B\u5BFC\u51FA",icon:"box",description:"\u5BFC\u51FA\u548C\u4E0B\u8F7D\u5F53\u524D\u8D26\u53F7\u7684\u6A21\u578B\u6210\u679C"}]},agent:{title:"Agent\u4E2D\u5FC3",items:[{key:"projects",label:"\u9879\u76EE\u4E0E\u5BF9\u8BDD",icon:"message",description:"\u521B\u5EFA\u9879\u76EE\u5E76\u4E0E\u667A\u80FD\u4F53\u534F\u4F5C"},{key:"agents",label:"\u667A\u80FD\u4F53\u7BA1\u7406",icon:"bot",description:"\u914D\u7F6E\u667A\u80FD\u4F53\u80FD\u529B\u4E0E\u534F\u4F5C\u65B9\u5F0F"},{key:"skills",label:"\u6280\u80FD\u7BA1\u7406",icon:"sparkles",description:"\u7BA1\u7406\u667A\u80FD\u4F53\u53EF\u4F7F\u7528\u7684\u6280\u80FD"},{key:"models",label:"\u6A21\u578B\u63A5\u5165",icon:"link",description:"\u914D\u7F6E\u5F53\u524D\u8D26\u53F7\u7684\u6A21\u578B\u8FDE\u63A5"},{key:"runs",label:"\u8FD0\u884C\u8BB0\u5F55",icon:"clock",description:"\u67E5\u770B\u4EFB\u52A1\u8FC7\u7A0B\u4E0E\u8FD0\u884C\u7ED3\u679C"},{key:"evaluations",label:"\u8BC4\u4F30\u4E2D\u5FC3",icon:"chart",description:"\u8BC4\u4F30\u667A\u80FD\u4F53\u4EFB\u52A1\u7684\u6267\u884C\u6548\u679C"}]}};function x(r,e){let t=u[r]?.items.find(n=>n.key===e);if(!t)throw new Error("\u6240\u9009\u529F\u80FD\u9875\u9762\u65E0\u6548\u3002");return t}function A(r,e,t,n){x(t,n);let i=Number(r?.admin_id);if(!Number.isSafeInteger(i)||i<=0||r?.module!==t||typeof r?.ticket!="string"||!r.ticket||r.ticket.length>2048)throw new Error("\u8D26\u53F7\u9A8C\u8BC1\u4FE1\u606F\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002");let o=new URL(r?.launch_url||"",e);if(o.origin!==e||o.pathname!==`/llm-center/${t}/`||o.username||o.password||o.search||o.hash)throw new Error("\u5DE5\u4F5C\u533A\u542F\u52A8\u5730\u5740\u65E0\u6548\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002");return o.hash=new URLSearchParams({ticket:r.ticket,admin_id:String(i),module:t,section:n}).toString(),{url:o.toString(),adminId:i,module:t}}function w(r,e,t,n,i){if(!e||r.source!==e||r.origin!==t||!r.data||typeof r.data!="object"||Number(r.data.admin_id)!==n||r.data.module!==i)return!1;let{source:o,type:l}=r.data;return o==="llm-center-auth-gate"&&["llm-center-auth-ready","llm-center-auth-error"].includes(l)||o==="llm-center-content"&&["llm-section-ready","llm-section-error"].includes(l)}function k(r,e="\u5DE5\u4F5C\u533A\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\uFF0C\u8BF7\u7A0D\u540E\u91CD\u65B0\u8FDE\u63A5\u3002"){let t=String(r?.message||"");return/[\u3400-\u9fff]/u.test(t)&&t.length<=160&&!/Traceback|Exception|LLaMA.?Factory|Penguin|https?:\/\//iu.test(t)?t:e}var L=`
:root,:root[data-theme]{
  --body-text-color:#303133;--body-text-color-subdued:#606266;
  --block-label-background-fill:transparent;--block-label-text-color:#303133;
  --block-title-background-fill:transparent;--block-title-text-color:#303133;
  --block-info-text-color:#606266;--block-radius:16px;
  --input-background-fill:#fff;--input-border-color:#1f38581a;
  --input-border-color-focus:#409eff;--input-radius:6px;
  --input-shadow:none;--input-shadow-focus:0 0 0 2px #409eff1a;
  --slider-color:#409eff;--checkbox-background-color-selected:#409eff;
}
/* Keep the native form scrollable when Gradio or the embedding view locks the
   document scroll. The scroll surface must fit the iframe, not its content. */
html,body{height:100%;min-height:0!important;overflow:hidden!important}
.gradio-container{
  height:100dvh!important;min-height:0!important;max-height:100dvh!important;
  box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden!important;
  overscroll-behavior-y:contain;scrollbar-gutter:stable;padding:24px!important;
}
.gradio-container .app{max-width:none!important;padding:0!important}
.gradio-container .contain{max-width:none!important}
[data-testid="block-info"],.block-title{
  background:transparent!important;color:#303133!important;
  border:0!important;border-radius:0!important;box-shadow:none!important;
  padding:0!important;font-size:14px!important;font-weight:600!important;
  line-height:22px!important;
}
[data-testid="block-info"]+div .prose{
  color:#606266!important;font-size:12px!important;line-height:20px!important;
}
[data-testid="block-info"]+div .prose p{color:#606266!important;margin:4px 0 8px!important}
.gr-group,.form{
  background:#fff!important;border:1px solid #1f38581a!important;
  border-radius:16px!important;box-shadow:0 1px 2px #1f385814!important;
}
.gr-group{padding:24px!important}
.gr-group>.styler{
  --layout-gap:20px!important;--form-gap-width:16px!important;gap:20px!important;
  --block-border-width:0px;--button-large-radius:6px;--button-small-radius:6px;
  background:transparent!important;
}
.gr-group .form{border:0!important;border-radius:0!important;box-shadow:none!important}
.form{padding:24px!important;gap:16px!important}
.gr-group .form{padding:0!important}
.form>.block{border:0!important;border-radius:0!important;padding:0!important}
.block.padded:not(.hide-container):not(.form>.block){
  border:1px solid #1f38581a!important;border-radius:16px!important;
  box-shadow:0 1px 2px #1f385814!important;padding:24px!important;
}
label.block.container{border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important}
.block.hide-container{background:transparent!important;border:0!important;box-shadow:none!important}
.block input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),.block textarea{
  color:#303133!important;background:#fff!important;
}
.block textarea,.block input[type="number"],.block .wrap:has(> .wrap-inner){
  border:1px solid #1f38581a!important;border-radius:6px!important;
  box-shadow:none!important;
}
.block textarea:focus,.block input[type="number"]:focus,.block .wrap:has(> .wrap-inner):focus-within{
  border-color:#409eff!important;box-shadow:0 0 0 2px #409eff1a!important;
}
/* Slider values and their reset actions share one border and one hit area. */
.block .head:has(>.tab-like-container){gap:12px!important;align-items:flex-start!important}
.block .head:has(>.tab-like-container)>label{flex:1 1 auto!important;min-width:0!important}
.block .tab-like-container{
  display:flex!important;align-items:center!important;flex:0 0 128px!important;
  width:128px!important;height:36px!important;min-width:0!important;
  box-sizing:border-box!important;border:1px solid #dcdfe6!important;border-radius:6px!important;
  background:#fff!important;padding:0!important;overflow:hidden!important;box-shadow:none!important;
}
.block .tab-like-container:focus-within{border-color:#409eff!important;box-shadow:0 0 0 2px #409eff1a!important}
.block .tab-like-container input[type="number"]{
  flex:1 1 0!important;width:0!important;min-width:0!important;height:34px!important;
  box-sizing:border-box!important;padding:0 10px!important;margin:0!important;
  border:0!important;border-radius:0!important;outline:0!important;box-shadow:none!important;
  font-size:14px!important;line-height:34px!important;text-align:center!important;
  font-variant-numeric:tabular-nums;appearance:textfield!important;
}
.block .tab-like-container input[type="number"]::-webkit-inner-spin-button,
.block .tab-like-container input[type="number"]::-webkit-outer-spin-button{appearance:none!important;margin:0!important}
.block .tab-like-container .reset-button{
  display:flex!important;align-items:center!important;justify-content:center!important;
  flex:0 0 34px!important;width:34px!important;min-width:0!important;height:34px!important;
  padding:0!important;margin:0!important;border:0!important;border-left:1px solid #e4e7ed!important;
  border-radius:0!important;background:#f5f8fc!important;color:#606266!important;
  font-size:18px!important;line-height:1!important;cursor:pointer;
}
.block .tab-like-container .reset-button:hover{color:#409eff!important;background:#ecf5ff!important}
.block .tab-like-container .reset-button:focus-visible{outline:2px solid #409eff!important;outline-offset:-3px!important}
.block .slider_input_container{margin-top:10px!important;gap:10px!important}
/* Replace the native widget logo and per-field timer with the RunOS ring. */
.block>.wrap.default.full:not(.hide){display:flex!important;align-items:center!important;justify-content:center!important}
.block>.wrap.default.full:not(.hide)::before{
  content:"";display:block;width:28px;height:28px;box-sizing:content-box;
  border:3px solid #dbeafe;border-top-color:#409eff;border-radius:50%;
  animation:rh-control-spin .8s linear infinite;
}
.block>.wrap.default.full>.eta-bar,.block>.wrap.default.full>.progress-text,
.block>.wrap.default.full>div:has(>svg){display:none!important}
@keyframes rh-control-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.block>.wrap.default.full:not(.hide)::before{animation:none}}
.gradio-container .row{gap:16px!important}
.gradio-container .column{gap:16px!important}
.gradio-container .tabitem{padding:0!important;border:0!important}
/* Named native layout contexts keep the form readable without reparenting
   Svelte controls or changing the factory's input and event bindings. */
.rh-card-heading h2{font-size:16px!important;line-height:24px!important;font-weight:600!important;color:#303133!important;margin:0!important}
.rh-card-heading p{font-size:12px!important;line-height:20px!important;color:#606266!important;margin:4px 0 0!important}
.rh-fields-grid{display:grid!important;grid-template-columns:repeat(var(--rh-columns,3),minmax(0,1fr));align-items:start!important}
.rh-grid-1{--rh-columns:1}.rh-grid-2{--rh-columns:2}.rh-grid-3{--rh-columns:3}
.rh-fields-grid>.form{display:contents!important}
.rh-fields-grid>.column,.rh-fields-grid>.form>.block{min-width:0!important;width:100%!important}
.rh-fields-grid .rh-full-width{grid-column:1/-1}
.rh-dataset-row{display:grid!important;grid-template-columns:minmax(180px,.55fr) minmax(0,1.45fr) 128px;align-items:end!important}
.rh-dataset-row>.form{display:contents!important}
.rh-dataset-row>.form>.block{width:100%!important;min-width:0!important;align-self:stretch!important}
#rh-tune-section-eval .rh-dataset-row{grid-template-columns:minmax(0,1fr) 128px}
.rh-control-eval-dataset{grid-column:1}
.rh-dataset-hint{font-size:12px!important;line-height:20px!important;font-weight:400!important;color:#606266!important;margin:4px 0 8px!important}
#rh-tune-section-train .rh-dataset-row .block>.container{display:flex!important;flex-direction:column!important;gap:0!important;height:100%!important;box-sizing:border-box!important}
#rh-tune-section-train .rh-dataset-row .block>.container>.wrap{margin-top:auto!important;flex-shrink:0!important}
#rh-tune-section-train .rh-dataset-row [data-testid="block-info"]{display:block!important;margin:0!important;line-height:22px!important}
#rh-tune-section-train .rh-dataset-row .block>.container>div:not(.wrap){margin:4px 0 8px!important;line-height:20px!important}
#rh-tune-section-train .rh-dataset-row .prose{display:block!important}
#rh-tune-section-train .rh-dataset-row .prose p{margin:0!important;line-height:20px!important}
@supports(grid-template-rows:subgrid){
  #rh-tune-section-train .rh-dataset-row{grid-template-rows:auto auto auto;row-gap:0!important;align-items:stretch!important}
  #rh-tune-section-train .rh-dataset-row>.form>.block{display:grid!important;grid-row:1/span 3;grid-template-rows:subgrid}
  #rh-tune-section-train .rh-dataset-row .block>.container{display:contents!important}
  #rh-tune-section-train .rh-dataset-row>.rh-preview-open{grid-column:3;grid-row:3}
  @media(max-width:600px){
    #rh-tune-section-train .rh-dataset-row{grid-template-rows:auto auto auto;row-gap:16px!important}
    #rh-tune-section-train .rh-dataset-row>.form>.block{grid-row:auto;grid-template-rows:auto auto auto}
    #rh-tune-section-train .rh-dataset-row>.rh-preview-open{grid-column:1;grid-row:auto}
  }
}
.rh-dataset-row .wrap:has(>.wrap-inner){min-height:40px!important;box-sizing:border-box!important;padding:0 12px!important}
.rh-dataset-row .wrap-inner{min-height:38px!important;box-sizing:border-box!important;padding:4px 0!important;gap:6px!important;align-items:center!important}
.rh-dataset-row .wrap-inner>.token{box-sizing:border-box!important;min-height:28px!important;padding:0 8px!important;align-items:center!important}
.rh-actionbar,.rh-dialog-actions{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important}
.rh-actionbar>button{flex:0 0 auto!important;min-width:112px!important;width:auto!important;height:36px!important;padding:0 16px!important}
.rh-preview-open{flex:0 0 128px!important;min-width:128px!important;height:40px!important;align-self:end!important;margin:0!important;border:1px solid #1f38581a!important;background:#fff!important;color:#409eff!important}
.rh-control-export-export-btn{width:160px!important;min-width:0!important;flex:none!important;align-self:start!important}
.rh-advanced{border:1px solid #1f38581a!important;border-radius:12px!important;background:#fff!important;overflow:hidden}
.rh-advanced.block.padded{padding:0!important;box-shadow:none!important}
#rh-tune-model-controls .rh-advanced,#runhive-tune-sections .rh-advanced{padding:0!important;box-shadow:none!important}
.rh-advanced>.label-wrap{padding:12px 16px!important;color:#303133!important}
.rh-advanced .rh-fields-grid{padding:16px!important}
.rh-advanced .rh-fields-grid>.form>.block{padding:0!important}
.rh-advanced>.label-wrap{
  display:flex!important;align-items:center!important;gap:12px!important;min-height:48px!important;
  box-sizing:border-box!important;width:100%!important;font-size:14px!important;font-weight:600!important;
  background:#fff!important;text-align:left!important;border-radius:0!important;
}
.rh-advanced>.label-wrap:hover{background:#f5f8fc!important}
.rh-advanced>.label-wrap:focus-visible{outline:2px solid #409eff!important;outline-offset:-3px!important}
.rh-advanced>.label-wrap[aria-expanded="true"]{border-bottom:1px solid #ebeef5!important}
.rh-advanced>.label-wrap>.icon{position:relative;width:16px!important;height:16px!important;font-size:0!important;flex:0 0 16px;transform:none!important}
.rh-advanced>.label-wrap>.icon::before{
  content:"";position:absolute;top:4px;left:3px;width:6px;height:6px;
  border:solid #909399;border-width:0 1.5px 1.5px 0;
  transform:rotate(-45deg);transition:transform .16s ease;
}
.rh-advanced>.label-wrap[aria-expanded="true"]>.icon::before{transform:rotate(45deg)}
.rh-advanced>.label-wrap+div>.column{padding:16px!important;gap:12px!important;box-sizing:border-box!important}
.rh-advanced>.label-wrap+div>.column>.rh-fields-grid{padding:0!important}
#rh-tune-model-controls .rh-advanced .rh-advanced,#runhive-tune-sections .rh-advanced .rh-advanced{
  border-color:#ebeef5!important;border-radius:8px!important;background:#f5f8fc!important;
}
.rh-advanced .rh-advanced>.label-wrap{min-height:42px!important;padding:10px 12px!important;background:#f5f8fc!important;font-weight:500!important}
.rh-advanced .rh-advanced>.label-wrap:hover{background:#ecf5ff!important}
.rh-advanced .rh-advanced>.label-wrap+div{background:#fff!important}
@media(prefers-reduced-motion:reduce){.rh-advanced>.label-wrap>.icon::before{transition:none}}
.rh-preview-backdrop{position:fixed;inset:0;background:#1f385840;z-index:1000}
.rh-preview-dialog{
  position:fixed!important;z-index:1001!important;top:50%!important;left:50%!important;
  transform:translate(-50%,-50%);width:min(960px,calc(100vw - 48px))!important;
  min-width:0!important;max-height:calc(100dvh - 64px)!important;
  flex-wrap:nowrap!important;flex-direction:column!important;
  box-sizing:border-box!important;overflow:hidden!important;overscroll-behavior:contain;
  background:#fff!important;border:1px solid #1f38581a!important;border-radius:16px!important;
  box-shadow:0 20px 60px #1f38582e!important;padding:24px!important;gap:16px!important;
}
.rh-preview-dialog .form{padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
.rh-preview-dialog>.block:has(.rh-card-heading),.rh-dialog-actions{flex:none!important}
.rh-preview-dialog>.rh-preview-samples{min-height:0!important;flex:1 1 auto!important;overflow:auto!important;max-height:calc(100dvh - 240px)}
.rh-dialog-actions{justify-content:flex-end!important;padding-top:16px;border-top:1px solid #1f385814}
.rh-dialog-actions>button{flex:0 0 auto!important;min-width:88px!important;width:auto!important;height:36px!important;padding:0 16px!important}
.rh-actionbar>button.secondary,.rh-dialog-actions>button{border:1px solid #1f38581a!important;background:#fff!important;color:#303133!important}
#runhive-tune-sections{gap:0!important;padding:0!important}
.rh-preview-summary{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#606266;font-size:12px;margin-bottom:16px}
.rh-preview-summary strong{color:#303133;font-size:14px;overflow-wrap:anywhere}
.rh-sample-card{background:#f5f8fc;border:1px solid #1f385814;border-radius:10px;padding:16px;margin-bottom:12px}
.rh-sample-card h3{font-size:14px!important;line-height:22px!important;font-weight:600!important;margin:0 0 12px!important;color:#303133!important}
.rh-sample-field{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;margin-top:10px}
.rh-sample-field>span{font-size:12px;color:#606266;line-height:22px;overflow-wrap:anywhere}
.rh-sample-field pre{font:14px/1.6 "Microsoft YaHei","PingFang SC",Arial,sans-serif!important;color:#303133!important;white-space:pre-wrap!important;overflow-wrap:anywhere;margin:0!important;background:transparent!important;padding:0!important;border:0!important}
.column:has(>.rh-control-train-loss-viewer>.empty){display:none!important}
[data-testid="block-label"]{background:transparent!important;color:#303133!important;border:0!important;box-shadow:none!important;font-size:14px!important;font-weight:600!important}
#rh-dataset-upload{border:1px dashed #c7d8eb!important;border-radius:10px!important;background:#f5f8fc!important;min-height:180px}
@media(max-width:900px){.rh-grid-3{--rh-columns:2}.rh-model-row .rh-control-top-checkpoint-path{grid-column:1/-1}}
@media(max-width:600px){.rh-fields-grid{--rh-columns:1}.rh-dataset-row,#rh-tune-section-eval .rh-dataset-row{grid-template-columns:minmax(0,1fr)!important}.rh-preview-open{flex:none!important;align-self:start!important;justify-self:start!important;width:128px!important}.rh-preview-dialog{width:calc(100vw - 24px)!important;padding:16px!important;max-height:calc(100dvh - 32px)!important}.rh-sample-field{grid-template-columns:1fr;gap:4px}}
@media(max-width:600px){.block .head:has(>.tab-like-container){flex-wrap:wrap!important}.block .head:has(>.tab-like-container)>label{flex-basis:100%!important}.rh-advanced>.label-wrap+div>.column{padding:12px!important}}
@media(max-width:700px){.gradio-container{padding:16px!important}.gr-group{padding:16px!important}.form{padding:12px!important}}
`;function C(r){let e=r.defaultView,t=null,n=null,i=null,o=!1,l=(a,d,p)=>{a.getAttribute(d)!==p&&a.setAttribute(d,p)},c=()=>{for(let a of r.querySelectorAll(".rh-control-train-dataset>label.container")){if(a.querySelector(".rh-dataset-hint"))continue;let d=a.querySelector(":scope>.wrap");if(d){let p=r.createElement("p");p.className="rh-dataset-hint",p.textContent="\u9009\u62E9\u7528\u4E8E\u8BAD\u7EC3\u7684\u6570\u636E\u96C6\uFF0C\u652F\u6301\u591A\u9009\u3002",a.insertBefore(p,d)}}for(let a of r.querySelectorAll(".tab-like-container .reset-button"))l(a,"aria-label","\u6062\u590D\u9ED8\u8BA4\u503C"),l(a,"title","\u6062\u590D\u9ED8\u8BA4\u503C");for(let[a,d]of[...r.querySelectorAll(".rh-advanced>.label-wrap")].entries()){let p=d.nextElementSibling;p&&(p.id||(p.id=`${d.parentElement.id||"rh-advanced-"+a}-panel`),l(d,"aria-controls",p.id),l(d,"aria-expanded",String(e.getComputedStyle(p).display!=="none")))}},h=a=>a?.querySelector("button.rh-preview-close,.rh-preview-close button"),f=a=>a.getClientRects().length>0&&e.getComputedStyle(a).display!=="none"&&(!a.closest('[role="tabpanel"]')||e.getComputedStyle(a.closest('[role="tabpanel"]')).display!=="none"),b=()=>h(t)?.click(),g=()=>{i?.remove(),i=null,n?.isConnected&&f(n)&&n.focus({preventScroll:!0}),n=null,t=null},F=()=>{o=!1,c();let a=[...r.querySelectorAll(".rh-preview-dialog")].find(f)||null;a!==t&&(t&&!f(t)&&h(t)?.click(),g(),a&&(t=a,n=r.activeElement,t.setAttribute("role","dialog"),t.setAttribute("aria-modal","true"),t.setAttribute("aria-label","\u6570\u636E\u96C6\u9884\u89C8"),t.setAttribute("tabindex","-1"),i=r.createElement("div"),i.className="rh-preview-backdrop",i.setAttribute("aria-hidden","true"),i.addEventListener("click",b),r.body.appendChild(i),(h(t)||t).focus({preventScroll:!0})))},S=()=>{o||(o=!0,e.requestAnimationFrame(F))},M=a=>{if(!t)return;if(a.key==="Escape"){a.preventDefault(),b();return}if(a.key!=="Tab")return;let d=[...t.querySelectorAll("button,input,textarea,select,a[href],[tabindex]")].filter(v=>!v.disabled&&v.tabIndex>=0&&f(v));if(!d.length){a.preventDefault(),t.focus();return}let p=d[0],E=d[d.length-1];a.shiftKey&&(r.activeElement===p||!t.contains(r.activeElement))?(a.preventDefault(),E.focus()):!a.shiftKey&&(r.activeElement===E||!t.contains(r.activeElement))&&(a.preventDefault(),p.focus())},z=new e.MutationObserver(S);return z.observe(r.body,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["style","class","hidden","data-rh-tune-section"]}),r.addEventListener("keydown",M,!0),S(),()=>{z.disconnect(),r.removeEventListener("keydown",M,!0),g()}}var T=`
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
`;var I=`
:root,:root[data-theme]{--ui-canvas:#f5f8fc;--ui-surface:#fff;--ui-surface-muted:#f5f8fc;--body-background-fill:#f5f8fc;--background-fill-secondary:#f5f8fc;--sidebar:#fff;--background:#f5f8fc}
html,body,.gradio-container{background:#f5f8fc!important}
.rh-agent-shell{background:#f5f8fc!important}
.rh-agent-conversations{background:#fff!important;border-right:1px solid #1f385814}
`,y=class{constructor(e=globalThis.window,t=globalThis.document){this.win=e,this.doc=t,this.entries=new Map,this.account=null,this.identity="",this.timer=null,this.unsubscribe=null,this.onMessage=n=>{if(this.checkAccount())for(let i of this.entries.values()){if(!w(n,i.frame.contentWindow,this.win.location.origin,i.adminId,i.module))continue;let o=n.data;o.type==="llm-center-auth-ready"&&(i.authenticated=!0),o.type==="llm-section-ready"&&u[i.module].items.some(l=>l.key===o.section)&&(i.ready=!0,i.section=o.section,this.theme(i)),i.owner?.receiveMessage(n)}},this.onStorage=n=>{if(!(n.key!=="adminInfo"&&n.key!==null)){try{let i=JSON.parse(this.win.localStorage.getItem("adminInfo")||"null");if(`${i?.id||0}:${i?.token||""}`===this.identity)return}catch{}this.destroyAll()}}}bind(e){let t=`${e.id||0}:${e.token||""}`;this.identity&&this.identity!==t&&this.destroyAll(),this.account=e,this.identity=t,this.timer||(this.win.addEventListener("message",this.onMessage),this.win.addEventListener("storage",this.onStorage),this.timer=this.win.setInterval(()=>{if(this.checkAccount())for(let n of this.entries.values())!n.owner&&Date.now()-n.parkedAt>6e5&&this.destroy(n)},1e3),typeof e.$subscribe=="function"&&(this.unsubscribe=e.$subscribe(()=>this.checkAccount(),{detached:!0,flush:"sync"})))}checkAccount(){return!this.account||`${this.account.id||0}:${this.account.token||""}`!==this.identity?(this.destroyAll(),!1):!0}peek(e,t){return this.bind(e),this.entries.get(t)||null}create(e,t,n,i,o){this.bind(e),this.destroy(this.entries.get(t));let l=this.doc.createElement("div"),c=this.doc.createElement("iframe"),h=this.doc.createElement("div");l.className="rh-llm-resident-host",l.style.display="none",c.className="rh-llm-frame",c.title=o.centerTitle||"\u8D26\u53F7\u5DE5\u4F5C\u533A",c.referrerPolicy="same-origin",c.src=i,h.className="rh-llm-status rh-llm-resident-veil";let f=this.doc.createElement("span"),b=this.doc.createElement("p");f.className="runos-spinner",b.textContent=`\u6B63\u5728\u52A0\u8F7D${o.centerTitle||"\u8D26\u53F7"}\u5DE5\u4F5C\u533A\u2026`,h.appendChild(f),h.appendChild(b),l.appendChild(c),l.appendChild(h),this.doc.body.appendChild(l);let g={host:l,frame:c,veil:h,adminId:n,module:t,identity:this.identity,owner:o,authenticated:!1,ready:!1,section:o.section,parkedAt:0};return c.addEventListener("load",()=>{this.theme(g),g.owner?.sendSection()}),this.entries.set(t,g),g}attach(e,t){return!this.checkAccount()||e.identity!==this.identity||this.entries.get(e.module)!==e?!1:(e.owner=t,!0)}position(e,t){if(!e||e.owner!==t||!t.active||!this.checkAccount())return;let n=t.$refs.frameShell;if(!n)return;let i=n.getBoundingClientRect(),o=Number.isFinite(this.win.innerHeight)?Math.max(0,Math.min(i.height,this.win.innerHeight-i.top)):i.height,l=!!(t.loading||t.error);Object.assign(e.host.style,{display:t.error?"none":"block",visibility:"visible",opacity:"1",pointerEvents:l?"none":"auto",left:`${i.left}px`,top:`${i.top}px`,width:`${i.width}px`,height:`${o}px`}),e.veil.style.display=t.loading?"flex":"none"}park(e,t){!e||e.owner!==t||(e.owner=null,e.parkedAt=Date.now(),e.host.style.display="none")}theme(e){try{let t=e.frame.contentWindow,n=`/llm-center/${e.module}/ui`;if(t.location.origin!==this.win.location.origin||!(t.location.pathname===n||t.location.pathname.startsWith(n+"/")))return;let i=e.frame.contentDocument,o=i.getElementById("runhive-center-theme-v3");o||(o=i.createElement("style"),o.id="runhive-center-theme-v3",i.head.appendChild(o)),o.textContent=I+(e.module==="tune"?L:T),i.head.appendChild(o),e.module==="tune"&&e.presentationDoc!==i&&i.defaultView?.MutationObserver&&(e.cleanupPresentation?.(),e.presentationDoc=i,e.cleanupPresentation=C(i))}catch{}}destroy(e){e&&(e.cleanupPresentation?.(),e.host.remove(),this.entries.delete(e.module))}destroyAll(){for(let t of this.entries.values())t.cleanupPresentation?.(),t.host.remove();this.entries.clear(),this.timer&&this.win.clearInterval(this.timer),this.timer=null;let e=this.unsubscribe;this.unsubscribe=null,e&&queueMicrotask(e),this.win.removeEventListener("message",this.onMessage),this.win.removeEventListener("storage",this.onStorage),this.identity="",this.account=null}},m=new y;var D={home:"M3 10l9-7 9 7M5 9v11h14V9M9 20v-7h6v7",database:"M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3",sliders:"M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4",chart:"M4 3v17h17M8 16v-5M13 16V7M18 16v-9",message:"M4 4h16v12H9l-5 4V4",box:"M3 7l9-4 9 4v10l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v10",bot:"M5 7h14v13H5V7ZM12 3v4M8 12h1M15 12h1M9 16h6M2 11v5M22 11v5",sparkles:"M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6",link:"M10 14l4-4M8 16l-2 2a4 4 0 01-6-6l5-5a4 4 0 016 0M16 8l2-2a4 4 0 016 6l-5 5a4 4 0 01-6 0",clock:"M21 12a9 9 0 11-18 0 9 9 0 0118 0ZM12 7v5l3 2"},j=r=>s("svg",{viewBox:"0 0 24 24",width:16,height:16,fill:"none",stroke:"currentColor","stroke-width":1.5,"stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true"},[s("path",{d:D[r]})]);function U(r="tune"){if(!Object.hasOwn(u,r))throw new Error("\u529F\u80FD\u5165\u53E3\u65E0\u6548\u3002");return $({name:r==="agent"?"RunhiveAgentCenter":"RunhiveLlmCenter",data(){return{account:R(),module:r,section:u[r].items[0].key,frameUrl:"",frameKey:0,adminId:0,frameModule:"",authenticated:!1,connecting:!1,loading:!0,error:"",active:!1,generation:0,timeout:null,messageListener:null,storageListener:null,frameEntry:null,resizeObserver:null,resizeListener:null}},computed:{accountIdentity(){return`${this.account.id||0}:${this.account.token||""}`},currentSection(){return x(this.module,this.section)},centerTitle(){return r==="agent"?"Agent\u4E2D\u5FC3":"\u5927\u6A21\u578B\u4E2D\u5FC3"}},watch:{accountIdentity:{flush:"sync",handler(){this.clearFrame(),this.active&&this.account.id&&this.account.token?this.launch():this.active&&(this.loading=!1,this.error="\u767B\u5F55\u72B6\u6001\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u767B\u5F55\u540E\u91CD\u65B0\u8FDE\u63A5\u3002")}}},mounted(){this.storageListener=e=>{if(!(e.key!=="adminInfo"&&e.key!==null)){try{let t=JSON.parse(localStorage.getItem("adminInfo")||"null");if(Number(t?.id||0)===Number(this.account.id||0)&&String(t?.token||"")===String(this.account.token||""))return}catch{}this.clearFrame(),this.loading=!1,this.error="\u767B\u5F55\u72B6\u6001\u5DF2\u5728\u5176\u4ED6\u9875\u9762\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u65B0\u8FDE\u63A5\u3002"}},window.addEventListener("storage",this.storageListener),this.resizeListener=()=>this.positionFrame(),window.addEventListener("resize",this.resizeListener),window.addEventListener("scroll",this.resizeListener,!0),this.active=!0,this.resume()},activated(){this.active||(this.active=!0,this.resume())},deactivated(){this.parkFrame()},beforeUnmount(){this.parkFrame(),window.removeEventListener("resize",this.resizeListener),window.removeEventListener("scroll",this.resizeListener,!0),window.removeEventListener("storage",this.storageListener)},methods:{clearTimeout(){this.timeout&&window.clearTimeout(this.timeout),this.timeout=null},clearFrame(){m.destroy(this.frameEntry),this.frameEntry=null,this.generation+=1,this.clearTimeout(),this.frameUrl="",this.adminId=0,this.frameModule="",this.authenticated=!1,this.connecting=!1},parkFrame(){this.active=!1,this.generation+=1,this.clearTimeout(),this.resizeObserver?.disconnect(),this.resizeObserver=null,m.park(this.frameEntry,this),this.frameEntry=null,this.frameUrl=""},positionFrame(){m.position(this.frameEntry,this)},observeFrame(){this.$nextTick(()=>{this.resizeObserver?.disconnect(),typeof ResizeObserver<"u"&&this.$refs.frameShell&&(this.resizeObserver=new ResizeObserver(()=>this.positionFrame()),this.resizeObserver.observe(this.$refs.frameShell)),this.positionFrame()})},async resume(){let e=m.peek(this.account,this.module);if(!e?.ready)return this.launch();this.loading=!0,this.error="",this.connecting=!0;let t=++this.generation;try{let n=await fetch(`/llm-center/${this.module}/auth/ready`,{credentials:"same-origin",cache:"no-store"}),i=await n.json();if(!this.active||this.generation!==t)return;if(!n.ok||!i.ready||i.module!==this.module||Number(i.admin_id)!==Number(this.account.id)||!m.attach(e,this))return m.destroy(e),this.launch();this.frameEntry=e,this.frameUrl=e.frame.src,this.frameModule=this.module,this.adminId=i.admin_id,this.authenticated=e.authenticated,this.section=e.section,this.loading=!1,this.connecting=!1,this.observeFrame()}catch{if(this.active&&this.generation===t)return m.destroy(e),this.launch()}},armTimeout(){this.clearTimeout();let e=this.generation,t=this.module,n=this.section;this.timeout=window.setTimeout(()=>{!this.active||this.generation!==e||this.module!==t||this.section!==n||(this.loading=!1,this.error="\u5DE5\u4F5C\u533A\u52A0\u8F7D\u65F6\u95F4\u8F83\u957F\uFF0C\u8BF7\u7A0D\u540E\u91CD\u65B0\u8FDE\u63A5\u3002",this.positionFrame())},12e4)},selectSection(e,t){if(e!==r||(x(e,t),this.module===e&&this.section===t&&this.frameUrl&&!this.error))return;let n=this.module!==e;this.module=e,this.section=t,this.error="",this.loading=!0,this.positionFrame(),n||!this.frameUrl&&!this.connecting?this.launch():(this.armTimeout(),this.sendSection())},sendSection(){let e=this.frameEntry?.frame.contentWindow;!e||!this.authenticated||this.frameModule!==this.module||e.postMessage({source:"runhive-llm-shell",type:"llm-section-change",admin_id:this.adminId,module:this.module,section:this.section},window.location.origin)},async launch(){this.clearFrame(),this.loading=!0,this.error="",this.connecting=!0;let e=this.generation,t=this.module,n=this.section;try{let i=await new N("/admin/Llmcenter/").postData("launch",{module:t,section:n});if(!this.active||this.generation!==e||this.module!==t)return;let o=A(i.data,window.location.origin,t,n);if(o.adminId!==Number(this.account.id)||!this.account.token)throw new Error("\u767B\u5F55\u72B6\u6001\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002");this.adminId=o.adminId,this.frameModule=t,this.frameKey+=1,this.frameUrl=o.url,this.frameEntry=m.create(this.account,t,o.adminId,o.url,this),this.observeFrame(),this.armTimeout()}catch(i){this.active&&this.generation===e&&(this.loading=!1,this.error=k(i),this.positionFrame())}finally{this.generation===e&&(this.connecting=!1)}},receiveMessage(e){if(!this.active||this.module!==this.frameModule||!w(e,this.frameEntry?.frame.contentWindow,window.location.origin,this.adminId,this.frameModule))return;let t=e.data;if(t.type==="llm-center-auth-ready")this.authenticated=!0,this.sendSection();else if(t.type==="llm-section-ready"){if(!u[this.module].items.some(n=>n.key===t.section))return;if(t.section!==this.section&&this.loading){this.sendSection();return}this.section=t.section,this.clearTimeout(),this.loading=!1,this.error="",this.positionFrame()}else(t.type==="llm-center-auth-error"||t.type==="llm-section-error"&&t.section===this.section)&&(this.clearTimeout(),this.loading=!1,this.error=k({message:t.message}),this.positionFrame())}},render(){let e=O("ElButton"),t=Object.entries(u).filter(([n])=>n===r).map(([n,i])=>s("div",{class:"rh-llm-nav-group"},[s("div",{class:"rh-llm-nav-heading"},i.title),s("nav",{"aria-label":i.title},i.items.map(o=>s("button",{type:"button",class:["rh-llm-nav-item",{active:this.module===n&&this.section===o.key}],"aria-current":this.module===n&&this.section===o.key?"page":void 0,onClick:()=>this.selectSection(n,o.key)},[j(o.icon),s("span",null,o.label)])))]));return s("main",{class:["rh-llm-center",{"rh-agent-native-layout":r==="agent"}]},[r==="agent"?null:s("aside",{class:"rh-llm-sidebar","aria-label":`${this.centerTitle}\u5BFC\u822A`},[s("div",{class:"rh-llm-nav-divider"}),...t]),s("section",{class:"rh-llm-content"},[r==="agent"?null:s("header",{class:"rh-llm-header"},[s("div",null,[s("h1",null,this.currentSection.label),s("p",null,this.currentSection.description)]),s(e,{size:"small",plain:!0,loading:this.connecting,onClick:this.launch},{default:()=>"\u91CD\u65B0\u8FDE\u63A5"})]),s("div",{class:"rh-llm-frame-shell",ref:"frameShell"},[this.loading&&!this.error?s("div",{class:"rh-llm-status",role:"status"},[s("span",{class:"runos-spinner","aria-hidden":"true"}),s("p",null,`\u6B63\u5728\u52A0\u8F7D${this.centerTitle}\u5DE5\u4F5C\u533A\u2026`)]):null,this.error?s("div",{class:"rh-llm-status rh-llm-error",role:"alert"},[s("p",null,this.error),s(e,{type:"primary",size:"small",onClick:this.launch},{default:()=>"\u91CD\u65B0\u8FDE\u63A5"})]):null])])])}})}var at=U("tune");export{U as createCenter,at as default};
//# sourceMappingURL=llm-center-agent-clean-index.js.map
