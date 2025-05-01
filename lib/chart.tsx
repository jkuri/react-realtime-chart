import { type Selection, area, axisBottom, axisLeft, line, max, min, scaleLinear, scaleTime, select } from "d3";
import { subSeconds } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type RealtimeChartData, type RealtimeChartGridOptions, type RealtimeChartOptions, curveTypeMapping } from "./types";
import { hexToRgb, mergeDeep } from "./utils";

type RealtimeChartProps = {
  data: RealtimeChartData[][];
  options?: RealtimeChartOptions;
};

const defaultOptions: RealtimeChartOptions = {
  margin: { top: 25, right: 25, bottom: 25, left: 25 },
  fps: 24,
  timeSlots: 60,
  xGrid: {
    enable: true,
    color: "#e9e9e9",
    size: 2,
    dashed: true,
    opacity: 0.5,
    ticks: true,
    tickFormat: "%H:%M:%S",
    tickPadding: 10,
    tickFontColor: "#6B6C6F",
    tickFontWeight: "normal",
    tickFontSize: 10,
    tickFontFamily: "sans-serif",
    tickFontAnchor: "middle",
  },
  yGrid: {
    enable: true,
    color: "#e9e9e9",
    size: 2,
    dashed: true,
    opacity: 0.5,
    min: "auto",
    max: "auto",
    ticks: true,
    tickFormat: "~s",
    tickPadding: 10,
    tickFontColor: "#6B6C6F",
    tickFontWeight: "normal",
    tickFontSize: 10,
    tickFontFamily: "sans-serif",
    tickFontAnchor: "middle",
  },
};

const RealtimeChart = ({ data, options: userOptions }: RealtimeChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastDrawTimeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const options = useMemo(() => {
    const opts = mergeDeep(defaultOptions, userOptions || {});
    const merged = mergeDeep(mergeDeep(defaultOptions, userOptions || {}), { lines: opts.lines || [] });

    (data || []).forEach((_, i) => {
      merged.lines[i] = {
        color: merged.colors?.[i] || "#000",
        opacity: 1,
        lineWidth: 2,
        area: true,
        areaColor: merged.colors?.[i] || "#000",
        areaOpacity: 0.1,
        curve: "basis",
        ...merged.lines[i],
      };
    });

    return merged;
  }, [userOptions, data]);

  const updateData = useCallback(
    (chartData: RealtimeChartData[]): RealtimeChartData[] => {
      const now = new Date();
      const validTime = subSeconds(now, options.timeSlots!);
      let sortedData = chartData.filter(Boolean).sort((a, b) => (a.date > b.date ? 1 : -1));

      let count = 0;
      while (sortedData.length - count + 1 >= options.timeSlots! && sortedData[count + 1].date < validTime) {
        count++;
      }
      if (count > 0) {
        sortedData = sortedData.slice(count);
      }

      const last = sortedData[sortedData.length - 1] || { date: now, value: 0 };
      if (last.date === now || sortedData.length < options.timeSlots!) {
        sortedData.push({ date: now, value: last.value });
      }

      return sortedData;
    },
    [options.timeSlots],
  );

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: width - (options.margin?.left || 0) - (options.margin?.right || 0),
          height: height - (options.margin?.top || 0) - (options.margin?.bottom || 0),
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const drawChart = useCallback(
    (timestamp: number) => {
      if (!canvasRef.current || !svgRef.current || !dimensions.width || !dimensions.height) return;

      const frameInterval = 1000 / (options.fps || 30);
      if (timestamp - lastDrawTimeRef.current < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(drawChart);
        return;
      }

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = dimensions.width * pixelRatio;
      canvas.height = dimensions.height * pixelRatio;
      canvas.style.width = `${dimensions.width}px`;
      canvas.style.height = `${dimensions.height}px`;
      context.scale(pixelRatio, pixelRatio);

      const now = new Date();
      const x = scaleTime()
        .range([0, dimensions.width])
        .domain([subSeconds(now, options.timeSlots! - 2), subSeconds(now, 2)]);

      const values = data.reduce((acc, curr) => acc.concat(curr.map((d) => d.value)), [] as number[]);
      const [minv, maxv] = [Number(min(values)), Number(max(values))];
      const factor = (maxv - minv) * 0.05;
      const [ymin, ymax] = [
        options.yGrid?.min === "auto" ? minv - factor : options.yGrid?.min,
        options.yGrid?.max === "auto" ? maxv + factor : options.yGrid?.max,
      ];

      const y = scaleLinear()
        .range([dimensions.height, 0])
        .domain([ymin || 0, ymax || 100]);

      context.clearRect(0, 0, canvas.width, canvas.height);

      data.forEach((d, i) => {
        data[i] = updateData(d);
        const lineOptions = options.lines?.[i] || {};
        const curveType = curveTypeMapping[lineOptions.curve || "basis"];

        if (lineOptions.area) {
          context.beginPath();
          const areaPath = area<RealtimeChartData>()
            .x((d) => x(d.date))
            .y1((d) => y(d.value))
            .y0(dimensions.height)
            .curve(curveType)(data[i]);

          if (areaPath) {
            context.fillStyle = `rgba(${hexToRgb(lineOptions.areaColor || "#000")}, ${lineOptions.areaOpacity || 0.1})`;
            context.fill(new Path2D(areaPath));
          }
        }

        context.beginPath();
        const linePath = line<RealtimeChartData>()
          .x((d) => x(d.date))
          .y((d) => y(d.value))
          .curve(curveType)(data[i]);

        if (linePath) {
          context.strokeStyle = `rgba(${hexToRgb(lineOptions.color || "#000")}, ${lineOptions.opacity || 1})`;
          context.lineWidth = lineOptions.lineWidth || 2;
          context.lineCap = "round";
          context.lineJoin = "round";
          context.stroke(new Path2D(linePath));
        }
      });

      const svg = select(svgRef.current);
      svg.selectAll("*").remove();
      const g = svg.append("g").attr("transform", `translate(${options.margin?.left},${options.margin?.top})`);

      if (options.xGrid?.enable) {
        const xAxis = axisBottom(x)
          .tickSizeInner(-dimensions.height)
          .tickSizeOuter(0)
          .tickPadding(options.xGrid.tickPadding || 10)
          .ticks(options.xGrid.tickNumber, typeof options.xGrid!.tickFormat !== "function" ? options.xGrid!.tickFormat : null);

        const xAxisG = g.append("g").attr("transform", `translate(0,${dimensions.height})`).call(xAxis);

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        styleAxis(xAxisG, options.xGrid as any);
      }

      if (options.yGrid?.enable) {
        const yAxis = axisLeft(y)
          .tickSize(-dimensions.width)
          .tickPadding(options.yGrid.tickPadding || 10)
          .ticks(options.yGrid.tickNumber)
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          .tickFormat(options.yGrid.tickFormat as any);

        const yAxisG = g.append("g").call(yAxis);

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        styleAxis(yAxisG, options.yGrid as any);
      }

      lastDrawTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(drawChart);
    },
    [data, dimensions, options, updateData],
  );

  // Helper function to style axes
  const styleAxis = (axis: Selection<SVGGElement, unknown, null, undefined>, gridOptions: RealtimeChartGridOptions) => {
    axis
      .selectAll("g.tick line")
      .style("shape-rendering", "crispEdges")
      .style("fill", "none")
      .style("stroke", gridOptions.color!)
      .style("stroke-width", gridOptions.size!)
      .style("stroke-dasharray", gridOptions.dashed ? "3 3" : "0")
      .style("opacity", gridOptions.opacity!);

    axis
      .selectAll("g.tick text")
      .attr("text-anchor", gridOptions.tickFontAnchor!)
      .style("fill", gridOptions.tickFontColor!)
      .style("font-size", `${gridOptions.tickFontSize}px`)
      .style("font-family", gridOptions.tickFontFamily!)
      .style("font-weight", gridOptions.tickFontWeight!);

    axis.select("path").style("display", "none");
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawChart);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [data, dimensions, options]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <svg ref={svgRef} width="100%" height="100%" />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: options.margin?.top,
            left: options.margin?.left,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export default RealtimeChart;
