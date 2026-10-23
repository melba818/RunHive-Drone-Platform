// Scoped to the trusted tuning app. Keep native widgets, state and navigation;
// adapt Gradio's Soft theme to the deployed RunOS form and card palette.
export const tuneTheme = `
:root,:root[data-theme]{
  --body-text-color:#303133;--body-text-color-subdued:#606266;
  --block-label-background-fill:transparent;--block-label-text-color:#303133;
  --block-title-background-fill:transparent;--block-title-text-color:#303133;
  --block-info-text-color:#606266;--block-radius:16px;
  --input-background-fill:#fff;--input-border-color:#1f38581a;
  --input-border-color-focus:#409eff;--input-radius:6px;
  --input-shadow:none;--input-shadow-focus:0 0 0 2px #409eff1a;
  --slider-color:#409eff;--checkbox-background-color-selected:#409eff;
  --color-accent:#409eff;
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
.form:has(>.rh-resource-bridge){display:none!important}
.rh-task-table th,.rh-task-table td{border:0!important;border-bottom:1px solid #ebeef5!important}
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
/* Keep Gradio's widgets and event bindings in place while aligning the import card. */
.rh-dataset-import-card>.styler{
  display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  grid-template-rows:auto auto auto minmax(110px,auto);column-gap:24px!important;row-gap:16px!important;
  align-items:start!important;
}
.rh-dataset-import-card>.styler>.block:has(.rh-card-heading){grid-column:1/-1;grid-row:1;margin-bottom:4px}
.rh-dataset-import-card .rh-dataset-import-fields,.rh-dataset-import-card>.styler>.form{display:contents!important}
.rh-dataset-import-card .rh-dataset-import-fields>.form{display:contents!important}
.rh-dataset-import-card #rh-dataset-upload{
  grid-column:1;grid-row:2/span 3;align-self:stretch;min-width:0;min-height:240px;
  width:100%!important;height:100%!important;box-sizing:border-box!important;padding:16px!important;box-shadow:none!important;
}
.rh-dataset-import-card #rh-dataset-upload:hover{border-color:#409eff!important;background:#f0f7ff!important}
.rh-dataset-import-name{grid-column:2;grid-row:2;width:100%!important;min-width:0!important}
.rh-dataset-import-name textarea{height:40px!important;min-height:40px!important;resize:none!important;overflow-y:hidden!important;box-sizing:border-box!important;line-height:22px!important;padding:8px 12px!important}
.rh-dataset-import-actions{grid-column:2;grid-row:3;margin:0!important;justify-content:flex-start!important}
.rh-dataset-import-actions>button{min-width:128px!important;height:40px!important;box-shadow:none!important}
.rh-dataset-import-result{grid-column:2;grid-row:4;min-width:0!important;width:100%!important;align-self:stretch!important}
.rh-dataset-import-result textarea{
  min-height:84px!important;max-height:180px!important;height:84px;box-sizing:border-box!important;
  resize:vertical!important;overflow-y:auto!important;background:#f5f8fc!important;
  line-height:22px!important;padding:10px 12px!important;
}
.rh-dataset-import-card textarea::placeholder{color:#909399!important;opacity:1}
/* Textarea scrollbar arrows are browser chrome, not actions or numeric steppers. */
.gradio-container textarea{scrollbar-width:auto;scrollbar-color:auto}
.gradio-container textarea::-webkit-scrollbar{width:6px;height:6px}
.gradio-container textarea::-webkit-scrollbar-button{display:none!important;width:0!important;height:0!important}
.gradio-container .rh-control-export-export-dir textarea{overflow-y:hidden!important;resize:none!important}
.gradio-container textarea::-webkit-scrollbar-track{background:#f5f8fc;border-radius:6px}
.gradio-container textarea::-webkit-scrollbar-thumb{background:#b8c7d8;border-radius:6px}
.gradio-container textarea::-webkit-scrollbar-thumb:hover{background:#409eff}
/* The cell already owns its selection ring; the editor must not add another. */
.gradio-container table :is(td,th) textarea,.gradio-container table :is(td,th) textarea:focus{
  border:0!important;outline:0!important;border-radius:0!important;box-shadow:none!important;
  background:transparent!important;font-family:inherit!important;font-size:inherit!important;
}
.gradio-container table :is(td.cell-selected,th.focus){--ring-color:#409eff!important;background:#ecf5ff!important;outline:0!important}
.gradio-container .block .wrap>.options[role="listbox"]{
  min-width:0!important;box-sizing:border-box!important;margin:0!important;padding:4px!important;
  border:1px solid #dce5ef!important;border-radius:8px!important;background:#fff!important;
  box-shadow:0 6px 20px #1f38581f!important;overflow-x:hidden!important;scrollbar-width:thin;
}
.gradio-container .block .wrap>.options[role="listbox"]>.item{
  width:100%!important;box-sizing:border-box!important;min-height:36px;padding:8px 10px!important;
  border-radius:4px;font-size:13px;line-height:20px;
}
.gradio-container .block .wrap>.options[role="listbox"]>.item.selected{color:#409eff;background:#ecf5ff}
/* Reserve one hint line across the connection row so every input has the same baseline. */
.rh-control-infer-infer-backend label,.rh-control-infer-infer-dtype label,.rh-control-infer-extra-args label{display:flex!important;flex-direction:column!important;gap:8px!important}
.rh-control-infer-infer-backend label>p,.rh-control-infer-infer-dtype label>p,.rh-control-infer-extra-args label>p{margin:0!important;min-height:20px;line-height:20px!important;color:#73839b;font-size:12px}
.rh-control-infer-infer-backend input,.rh-control-infer-infer-dtype input,.rh-control-infer-extra-args textarea{min-height:40px!important;height:40px!important;box-sizing:border-box!important}
.rh-dataset-import-card #rh-dataset-upload{border:1px dashed #b7d5ff!important;border-radius:14px!important;background:linear-gradient(150deg,#f8fbff,#edf5ff)!important;transition:border-color .15s,background .15s;min-height:220px}
.rh-dataset-import-card #rh-dataset-upload .wrap{border:0!important;background:transparent!important;box-shadow:none!important}
.rh-dataset-import-card #rh-dataset-upload .upload-container{gap:10px!important;line-height:1.7!important;color:#526d90!important;font-size:14px!important}
.rh-dataset-import-card #rh-dataset-upload .upload-container svg{width:36px!important;height:36px!important;color:#409eff!important;background:#e1eeff;padding:12px;border-radius:14px;box-sizing:content-box}
.rh-dataset-import-card #rh-dataset-upload .file-preview{border:1px solid #d7e7fa!important;border-radius:8px!important;background:white!important;padding:12px!important}
@media(max-width:760px){
  .rh-dataset-import-card>.styler{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto auto auto}
  .rh-dataset-import-card #rh-dataset-upload{grid-column:1;grid-row:2;min-height:180px;height:auto!important}
  .rh-dataset-import-name{grid-column:1;grid-row:3}
  .rh-dataset-import-actions{grid-column:1;grid-row:4}
  .rh-dataset-import-result{grid-column:1;grid-row:5}
}
@media(max-width:900px){.rh-grid-3{--rh-columns:2}.rh-model-row .rh-control-top-checkpoint-path{grid-column:1/-1}}
@media(max-width:600px){.rh-fields-grid{--rh-columns:1}.rh-dataset-row,#rh-tune-section-eval .rh-dataset-row{grid-template-columns:minmax(0,1fr)!important}.rh-preview-open{flex:none!important;align-self:start!important;justify-self:start!important;width:128px!important}.rh-preview-dialog{width:calc(100vw - 24px)!important;padding:16px!important;max-height:calc(100dvh - 32px)!important}.rh-sample-field{grid-template-columns:1fr;gap:4px}}
@media(max-width:600px){.block .head:has(>.tab-like-container){flex-wrap:wrap!important}.block .head:has(>.tab-like-container)>label{flex-basis:100%!important}.rh-advanced>.label-wrap+div>.column{padding:12px!important}}
@media(max-width:700px){.gradio-container{padding:16px!important}.gr-group{padding:16px!important}.form{padding:12px!important}}
`
