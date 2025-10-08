import { ConfigSnippet } from "@/components/config-snippet";
import { Controls } from "@/components/controls";
import { useMobile } from "@/hooks/use-mobile";
import { generateRandomRealtimeData, randomInt } from "@/lib/data";
import { useTheme } from "@/providers/theme-provider";
import type { CurveType } from "@/types/curve";
import { useEffect, useMemo, useState } from "react";
import RealtimeChart, { type RealtimeChartData, type RealtimeChartOptions } from "react-realtime-chart";

export function Demo() {
  const { isDark } = useTheme();
  const isMobile = useMobile();
  const [data, setData] = useState<RealtimeChartData[][]>([[...generateRandomRealtimeData(240, 0.1, 10, 90)]]);

  const [fps, setFps] = useState(120);
  const [timeSlots, setTimeSlots] = useState(isMobile ? 10 : 20);
  const [curveType, setCurveType] = useState<CurveType>("basis");
  const [color, setColor] = useState(isDark ? "#ffffff" : "#09090B");
  const [areaOpacity, setAreaOpacity] = useState(0.03);
  const [lineWidth, setLineWidth] = useState(2);
  const [gridColor, setGridColor] = useState(isDark ? "#171717" : "#CCCCCC");
  const [gridOpacity, setGridOpacity] = useState(isDark ? 1 : 0.1);

  useEffect(() => {
    const pointsPerSecond = 10;
    const count = Math.max(1, timeSlots * pointsPerSecond);
    setData([[...generateRandomRealtimeData(count, 0.1, 10, 90)]]);
  }, [timeSlots]);

  useEffect(() => {
    if (color === "#ffffff" || color === "#09090B") {
      setColor(isDark ? "#ffffff" : "#09090B");
    }

    if (gridColor === "#171717" || gridColor === "#CCCCCC") {
      setGridColor(isDark ? "#171717" : "#CCCCCC");
    }

    if ((isDark && gridOpacity === 0.1) || (!isDark && gridOpacity === 1)) {
      setGridOpacity(isDark ? 1 : 0.1);
    }
  }, [isDark]);

  const options: RealtimeChartOptions = useMemo(
    () => ({
      fps,
      timeSlots,
      margin: {
        top: 10,
        right: isMobile ? 10 : 25,
        bottom: isMobile ? 20 : 25,
        left: isMobile ? 40 : 55,
      },
      colors: [color],
      lines: [
        {
          area: areaOpacity > 0,
          areaColor: color,
          areaOpacity,
          lineWidth,
          curve: curveType,
        },
      ],
      yGrid: {
        min: 0,
        max: 100,
        color: gridColor,
        opacity: gridOpacity,
        size: 1,
        tickNumber: isMobile ? 4 : 5,
        tickFormat: (v: string | number) => `${v}%`,
        tickPadding: isMobile ? 15 : 20,
        tickFontWeight: 400,
        tickFontColor: isDark ? "#ffffff" : "#000000",
        tickFontSize: isMobile ? 9 : 12,
        tickFontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
      },
      xGrid: {
        color: gridColor,
        opacity: gridOpacity,
        size: 1,
        tickNumber: isMobile ? 3 : 7,
        tickFontColor: isDark ? "#ffffff" : "#000000",
        tickFontSize: isMobile ? 9 : 12,
        tickFontWeight: 400,
        tickFontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
      },
    }),
    [isDark, isMobile, curveType, color, lineWidth, areaOpacity, gridColor, gridOpacity, fps, timeSlots],
  );

  useEffect(() => {
    const worker = new Worker("/timer-worker.js");

    worker.postMessage({ action: "start", interval: 100 });

    worker.onmessage = (e) => {
      if (e.data.type === "tick") {
        setData((prev) => {
          const data = [...prev];
          data[0] = [...data[0], { date: new Date(), value: randomInt(10, 90) }];
          return data;
        });
      }
    };

    return () => {
      worker.postMessage({ action: "stop" });
      worker.terminate();
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Controls
        fps={fps}
        setFps={setFps}
        timeSlots={timeSlots}
        setTimeSlots={setTimeSlots}
        curveType={curveType}
        setCurveType={setCurveType}
        color={color}
        setColor={setColor}
        areaOpacity={areaOpacity}
        setAreaOpacity={setAreaOpacity}
        lineWidth={lineWidth}
        setLineWidth={setLineWidth}
        gridColor={gridColor}
        setGridColor={setGridColor}
        gridOpacity={gridOpacity}
        setGridOpacity={setGridOpacity}
      />

      <div className="w-full h-64 sm:h-96 p-4 border rounded-md">
        <RealtimeChart options={options} data={data} />
      </div>

      <ConfigSnippet
        fps={fps}
        timeSlots={timeSlots}
        curveType={curveType}
        color={color}
        areaOpacity={areaOpacity}
        lineWidth={lineWidth}
        gridColor={gridColor}
        gridOpacity={gridOpacity}
      />
    </div>
  );
}
