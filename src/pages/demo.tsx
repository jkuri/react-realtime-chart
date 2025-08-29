import { useTheme } from "@/providers/theme-provider";
import { generateRandomRealtimeData, randomInt } from "@/utils/data";
import { useEffect, useState } from "react";
import RealtimeChart, { type RealtimeChartData, type RealtimeChartOptions } from "react-realtime-chart";

export function Demo() {
  const { isDark } = useTheme();
  const [data, setData] = useState<RealtimeChartData[][]>([[...generateRandomRealtimeData(240, 0.1, 10, 90)]]);

  const options: RealtimeChartOptions = {
    fps: 120,
    timeSlots: 20,
    margin: { top: 10, right: 25, bottom: 25, left: 50 },
    colors: [isDark ? "#ffffff" : "#1c1c1c"],
    lines: [{ area: false, areaColor: "#1c1c1c", areaOpacity: 0.35, lineWidth: 2 }],
    yGrid: {
      min: 0,
      max: 100,
      color: isDark ? "#171717" : "#09090B",
      opacity: isDark ? 1 : 0.1,
      tickNumber: 5,
      tickFormat: (v: string | number) => `${v}%`,
      tickPadding: 20,
      tickFontWeight: 700,
      tickFontColor: isDark ? "#ffffff" : "#000000",
      tickFontSize: 12,
      tickFontFamily: "Roboto",
    },
    xGrid: {
      color: isDark ? "#171717" : "#09090B",
      opacity: isDark ? 1 : 0.1,
      tickNumber: 7,
      tickFontColor: isDark ? "#ffffff" : "#000000",
      tickFontSize: 12,
      tickFontWeight: 500,
      tickFontFamily: "Roboto",
    },
  };

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

  return <RealtimeChart options={options} data={data} />;
}
