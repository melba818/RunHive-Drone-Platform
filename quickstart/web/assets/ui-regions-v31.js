export const UI_SELECTORS=['.rh-guide','[data-rh-sidebar]','[data-rh-map-controls]','[data-rh-template-menu]','[data-rh-template-controls]','[data-rh-bulk-controls]','[data-radix-popper-content-wrapper]','[role="dialog"]','.fixed.inset-0','.rh-location','[data-rh-routes]'];
export function collectUiRects(doc){return [...doc.querySelectorAll(UI_SELECTORS.join(','))].filter(e=>{const s=doc.defaultView.getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'}).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}).filter(r=>r.width>0&&r.height>0).slice(0,30)}
export function uiClipPath(rects,width,height){
 if(!Array.isArray(rects)||rects.length>30||![width,height].every(Number.isFinite))return null;
 const paths=[];for(const r of rects){if(!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0)continue;const x=Math.max(0,r.x-2),y=Math.max(0,r.y-2),right=Math.min(width,r.x+r.width+2),bottom=Math.min(height,r.y+r.height+2);if(right>x&&bottom>y)paths.push(`M${x} ${y}h${right-x}v${bottom-y}h${x-right}Z`)}
 return paths.length?'path("'+paths.join(' ')+'")':null;
}
