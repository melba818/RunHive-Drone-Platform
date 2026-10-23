/** The same original-pixel overlay is used for the chat preview and the zoomed viewer. */
import { useId } from "react";
import { BBOX_BLUE, bboxDrawing } from "./bbox-result";
import type { BboxResult } from "./bbox-result";

export function BboxImageOverlay({ result }: { result: BboxResult }) {
  const labelId = useId();
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${result.image_size.width} ${result.image_size.height}`} role="img" aria-label={`已标注 ${result.detections.length} 个目标`}>
      {result.detections.map((detection, index) => {
        const drawing = bboxDrawing(result, detection, index);
        return (
          <g key={index}>
            <title>{`${detection.label}：${detection.bbox.join(", ")}`}</title>
            <rect x={drawing.x} y={drawing.y} width={drawing.width} height={drawing.height} fill="none" stroke={BBOX_BLUE} strokeWidth={drawing.lineWidth} />
            {drawing.labelVisible && <>
              <rect data-bbox-label={index} x={drawing.labelX} y={drawing.labelY} width={drawing.labelWidth} height={drawing.labelHeight} fill={BBOX_BLUE} />
              <defs><clipPath id={`${labelId}-${index}`}><rect x={drawing.labelX + drawing.padding} y={drawing.labelY} width={Math.max(0, drawing.labelWidth - drawing.padding * 2)} height={drawing.labelHeight} /></clipPath></defs>
              <text x={drawing.labelX + drawing.padding} y={drawing.labelBaseline} clipPath={`url(#${labelId}-${index})`} fill="#ffffff" fontFamily="sans-serif" fontSize={drawing.fontSize} fontWeight={600}>{drawing.label}</text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}
