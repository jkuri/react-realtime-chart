import { useTheme } from "@/providers/theme-provider";
import { generateRandomRealtimeData, randomInt } from "@/utils/data";
import { useEffect, useState } from "react";
import RealtimeChart, { type RealtimeChartData, type RealtimeChartOptions } from "react-realtime-chart";

export function Demo() {
  const { isDark } = useTheme();
  const [data, setData] = useState<RealtimeChartData[][]>([[...generateRandomRealtimeData(120, 1, 10, 90)]]);

  const options: RealtimeChartOptions = {
    fps: 60,
    margin: { top: 10, right: 25, bottom: 25, left: 50 },
    colors: [isDark ? "#ffffff" : "#171717"],
    lines: [{ area: true, areaColor: "#171717", areaOpacity: 0.5, lineWidth: 2 }],
    yGrid: {
      min: 0,
      max: 100,
      color: isDark ? "ffffff1a" : "#09090B",
      opacity: isDark ? 0.05 : 0.03,
      tickNumber: 5,
      tickFormat: (v: string | number) => `${v}%`,
      tickPadding: 25,
      tickFontWeight: 600,
      tickFontColor: isDark ? "#ffffff" : "#171717",
      tickFontSize: 10,
    },
    xGrid: {
      color: isDark ? "ffffff1a" : "#09090B",
      opacity: isDark ? 0.05 : 0.03,
      tickNumber: 5,
      tickFontColor: isDark ? "#ffffff" : "#171717",
      tickFontSize: 10,
      tickFontWeight: 600,
    },
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const data = [...prev];
        data[0] = [...data[0], { date: new Date(), value: randomInt(10, 90) }];
        return data;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <RealtimeChart options={options} data={data} />;
}
