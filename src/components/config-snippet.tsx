import { useMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/providers/theme-provider";
import type { CurveType } from "@/types/curve";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

interface ConfigSnippetProps {
  fps: number;
  timeSlots: number;
  curveType: CurveType;
  color: string;
  areaOpacity: number;
  lineWidth: number;
  gridColor: string;
  gridOpacity: number;
}

export function ConfigSnippet({ fps, timeSlots, curveType, color, areaOpacity, lineWidth, gridColor, gridOpacity }: ConfigSnippetProps) {
  const { isDark } = useTheme();
  const isMobile = useMobile();
  const [copied, setCopied] = useState(false);

  const configCode = useMemo(() => {
    return `const options: RealtimeChartOptions = {
  fps: ${fps},
  timeSlots: ${timeSlots},
  margin: {
    top: 10,
    right: ${isMobile ? 10 : 25},
    bottom: ${isMobile ? 20 : 25},
    left: ${isMobile ? 36 : 50},
  },
  colors: ["${color}"],
  lines: [
    {
      area: ${areaOpacity > 0},
      areaColor: "${color}",
      areaOpacity: ${areaOpacity},
      lineWidth: ${lineWidth},
      curve: "${curveType}",
    },
  ],
  yGrid: {
    min: 0,
    max: 100,
    color: "${gridColor}",
    opacity: ${gridOpacity},
    size: 1,
    tickNumber: ${isMobile ? 4 : 5},
    tickFormat: (v) => \`\${v}%\`,
    tickPadding: ${isMobile ? 15 : 20},
    tickFontWeight: 400,
    tickFontColor: "${isDark ? "#ffffff" : "#000000"}",
    tickFontSize: ${isMobile ? 9 : 12},
    tickFontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
  },
  xGrid: {
    color: "${gridColor}",
    opacity: ${gridOpacity},
    size: 1,
    tickNumber: ${isMobile ? 3 : 7},
    tickFontColor: "${isDark ? "#ffffff" : "#000000"}",
    tickFontSize: ${isMobile ? 9 : 12},
    tickFontWeight: 400,
    tickFontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
  },
};`;
  }, [fps, timeSlots, isMobile, color, areaOpacity, lineWidth, curveType, gridColor, gridOpacity, isDark]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return isMobile ? null : (
    <div className="w-full p-4 border rounded-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Configuration</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border hover:bg-accent transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="text-xs overflow-x-auto bg-accent/10 border p-3 rounded-md">
        <code>{configCode}</code>
      </pre>
    </div>
  );
}
