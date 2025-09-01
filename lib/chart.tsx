import { line, max, min, scaleLinear, scaleTime, timeFormat } from "d3";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BufferPool } from "./buffer-pool";
import { fragmentShaderSource, textFragmentShaderSource, textVertexShaderSource, vertexShaderSource } from "./shaders";
import { type RealtimeChartData, type RealtimeChartOptions, curveTypeMapping } from "./types";
import {
  createProgram,
  createShader,
  hexToRgba,
  mergeDeep,
  renderGridLines,
  renderLine,
  renderText,
  renderTriangles,
  subSeconds,
  triangulateArea,
} from "./utils";

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
  const animationFrameRef = useRef<number>(0);
  const lastDrawTimeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // WebGL-specific refs
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textProgramRef = useRef<WebGLProgram | null>(null);
  const positionBufferRef = useRef<WebGLBuffer | null>(null);
  const colorBufferRef = useRef<WebGLBuffer | null>(null);
  const bufferPoolRef = useRef<BufferPool | null>(null);
  const attributeLocationsRef = useRef<{
    position: number;
    color: number;
  } | null>(null);
  const textAttributeLocationsRef = useRef<{
    position: number;
    texCoord: number;
  } | null>(null);
  const uniformLocationsRef = useRef<{
    resolution: WebGLUniformLocation | null;
  } | null>(null);
  const textUniformLocationsRef = useRef<{
    resolution: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  } | null>(null);

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

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    if (!canvasRef.current) return false;

    const gl = canvasRef.current.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported");
      return false;
    }

    glRef.current = gl;

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders");
      return false;
    }

    // Create main program
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      console.error("Failed to create WebGL program");
      return false;
    }

    programRef.current = program;

    // Create text shaders and program
    const textVertexShader = createShader(gl, gl.VERTEX_SHADER, textVertexShaderSource);
    const textFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, textFragmentShaderSource);

    if (!textVertexShader || !textFragmentShader) {
      console.error("Failed to create text shaders");
      return false;
    }

    const textProgram = createProgram(gl, textVertexShader, textFragmentShader);
    if (!textProgram) {
      console.error("Failed to create text WebGL program");
      return false;
    }

    textProgramRef.current = textProgram;

    // Get attribute and uniform locations for main program
    attributeLocationsRef.current = {
      position: gl.getAttribLocation(program, "a_position"),
      color: gl.getAttribLocation(program, "a_color"),
    };

    uniformLocationsRef.current = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
    };

    // Get attribute and uniform locations for text program
    textAttributeLocationsRef.current = {
      position: gl.getAttribLocation(textProgram, "a_position"),
      texCoord: gl.getAttribLocation(textProgram, "a_texCoord"),
    };

    textUniformLocationsRef.current = {
      resolution: gl.getUniformLocation(textProgram, "u_resolution"),
      texture: gl.getUniformLocation(textProgram, "u_texture"),
      color: gl.getUniformLocation(textProgram, "u_color"),
    };

    // Create buffers
    positionBufferRef.current = gl.createBuffer();
    colorBufferRef.current = gl.createBuffer();

    // Initialize buffer pool
    bufferPoolRef.current = new BufferPool(gl);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }, []);

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

  // Helper function to convert D3 path to WebGL vertices
  const pathToVertices = useCallback((pathString: string): number[] => {
    const vertices: number[] = [];
    const commands = pathString.match(/[MLC][^MLC]*/g) || [];

    let currentX = 0;
    let currentY = 0;

    for (const command of commands) {
      const type = command[0];
      const coords = command
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      if (type === "M") {
        currentX = coords[0];
        currentY = coords[1];
        vertices.push(currentX, currentY);
      } else if (type === "L") {
        for (let i = 0; i < coords.length; i += 2) {
          currentX = coords[i];
          currentY = coords[i + 1];
          vertices.push(currentX, currentY);
        }
      } else if (type === "C") {
        // For cubic bezier curves, we'll approximate with line segments
        for (let i = 0; i < coords.length; i += 6) {
          const x1 = coords[i];
          const y1 = coords[i + 1];
          const x2 = coords[i + 2];
          const y2 = coords[i + 3];
          const x3 = coords[i + 4];
          const y3 = coords[i + 5];

          // Simple approximation: add intermediate points
          const steps = 10;
          for (let t = 0; t <= steps; t++) {
            const u = t / steps;
            const x = (1 - u) ** 3 * currentX + 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u ** 2 * x2 + u ** 3 * x3;
            const y = (1 - u) ** 3 * currentY + 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u ** 2 * y2 + u ** 3 * y3;
            vertices.push(x, y);
          }

          currentX = x3;
          currentY = y3;
        }
      }
    }

    return vertices;
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Store the full container dimensions, don't subtract margins here
        // The chart area dimensions will be calculated in the render function
        setDimensions({
          width: Math.max(0, width),
          height: Math.max(0, height),
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initialize WebGL when component mounts
    initWebGL();

    return () => resizeObserver.disconnect();
  }, [initWebGL, options.margin]);

  const drawChart = useCallback(
    (timestamp: number) => {
      if (!canvasRef.current || !dimensions.width || !dimensions.height) return;
      if (!glRef.current || !programRef.current || !attributeLocationsRef.current || !uniformLocationsRef.current) return;
      if (!textProgramRef.current || !textAttributeLocationsRef.current || !textUniformLocationsRef.current) return;

      const attributeLocations = attributeLocationsRef.current;
      const textAttributeLocations = textAttributeLocationsRef.current;
      const textUniformLocations = textUniformLocationsRef.current;

      const frameInterval = 1000 / (options.fps || 30);
      if (timestamp - lastDrawTimeRef.current < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(drawChart);
        return;
      }

      const canvas = canvasRef.current;
      const gl = glRef.current;

      // Calculate chart area dimensions by subtracting margins from container dimensions
      const marginLeft = options.margin?.left || 0;
      const marginRight = options.margin?.right || 0;
      const marginTop = options.margin?.top || 0;
      const marginBottom = options.margin?.bottom || 0;

      const chartWidth = Math.max(0, dimensions.width - marginLeft - marginRight);
      const chartHeight = Math.max(0, dimensions.height - marginTop - marginBottom);

      // Use full container dimensions for canvas
      const totalWidth = dimensions.width;
      const totalHeight = dimensions.height;

      canvas.width = totalWidth;
      canvas.height = totalHeight;
      canvas.style.width = `${totalWidth}px`;
      canvas.style.height = `${totalHeight}px`;

      gl.viewport(0, 0, canvas.width, canvas.height);

      const now = new Date();
      const x = scaleTime()
        .range([marginLeft, marginLeft + chartWidth])
        .domain([subSeconds(now, options.timeSlots! - 2), subSeconds(now, 2)]);

      const values = data.reduce((acc, curr) => acc.concat(curr.map((d) => d.value)), [] as number[]);
      const [minv, maxv] = [Number(min(values)), Number(max(values))];
      const factor = (maxv - minv) * 0.05;
      const [ymin, ymax] = [
        options.yGrid?.min === "auto" ? minv - factor : options.yGrid?.min,
        options.yGrid?.max === "auto" ? maxv + factor : options.yGrid?.max,
      ];

      const y = scaleLinear()
        .range([marginTop + chartHeight, marginTop])
        .domain([ymin || 0, ymax || 100]);

      // Clear the canvas
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Use our main shader program for chart rendering
      gl.useProgram(programRef.current);

      // Set the resolution uniform
      gl.uniform2f(uniformLocationsRef.current.resolution, canvas.width, canvas.height);

      // Render grid lines first (behind the data)
      // Use our main shader program for grid rendering
      gl.useProgram(programRef.current);
      gl.uniform2f(uniformLocationsRef.current.resolution, canvas.width, canvas.height);

      // Render X-axis grid lines
      if (options.xGrid?.enable) {
        const xTicks = x.ticks(options.xGrid.tickNumber || 8);
        const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

        // Create grid lines
        for (const tick of xTicks) {
          const xPos = x(tick);
          gridLines.push({
            x1: xPos,
            y1: marginTop,
            x2: xPos,
            y2: marginTop + chartHeight,
          });
        }

        // Render grid lines
        const actualOpacity = Math.max(0.15, options.xGrid.opacity || 0.5);
        const gridColor = hexToRgba(options.xGrid.color || "#e9e9e9", actualOpacity);
        renderGridLines(
          gl,
          gridLines,
          gridColor,
          options.xGrid.size || 1,
          attributeLocations.position,
          attributeLocations.color,
          bufferPoolRef.current || undefined,
        );
      }

      // Render Y-axis grid lines
      if (options.yGrid?.enable) {
        const yTicks = y.ticks(options.yGrid.tickNumber || 5);
        const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

        // Create grid lines
        for (const tick of yTicks) {
          const yPos = y(tick);
          gridLines.push({
            x1: marginLeft,
            y1: yPos,
            x2: marginLeft + chartWidth,
            y2: yPos,
          });
        }

        // Render grid lines
        const actualOpacity = Math.max(0.15, options.yGrid.opacity || 0.5);
        const gridColor = hexToRgba(options.yGrid.color || "#e9e9e9", actualOpacity);
        renderGridLines(
          gl,
          gridLines,
          gridColor,
          options.yGrid.size || 1,
          attributeLocations.position,
          attributeLocations.color,
          bufferPoolRef.current || undefined,
        );
      }

      // Enable scissor test to clip chart content to the chart area
      gl.enable(gl.SCISSOR_TEST);
      const chartLeft = marginLeft;
      const chartTop = marginTop;
      const scissorWidth = chartWidth;
      const scissorHeight = chartHeight;
      // Note: WebGL scissor coordinates are from bottom-left, so we need to flip Y
      const scissorY = canvas.height - chartTop - scissorHeight;
      gl.scissor(chartLeft, scissorY, scissorWidth, scissorHeight);

      data.forEach((d, i) => {
        data[i] = updateData(d);
        const lineOptions = options.lines?.[i] || {};
        const curveType = curveTypeMapping[lineOptions.curve || "basis"];

        // Render area if enabled
        if (lineOptions.area) {
          // Get the line path vertices first
          const linePath = line<RealtimeChartData>()
            .x((d) => x(d.date))
            .y((d) => y(d.value))
            .curve(curveType)(data[i]);

          if (linePath) {
            const lineVertices = pathToVertices(linePath);
            const baselineY = marginTop + chartHeight; // Bottom of chart area
            const triangles = triangulateArea(lineVertices, baselineY);
            const color = hexToRgba(lineOptions.areaColor || "#000", lineOptions.areaOpacity || 0.1);

            renderTriangles(
              gl,
              triangles,
              color,
              attributeLocations.position,
              attributeLocations.color,
              bufferPoolRef.current || undefined,
            );
          }
        }

        // Render line
        const linePath = line<RealtimeChartData>()
          .x((d) => x(d.date))
          .y((d) => y(d.value))
          .curve(curveType)(data[i]);

        if (linePath) {
          const vertices = pathToVertices(linePath);
          const color = hexToRgba(lineOptions.color || "#000", lineOptions.opacity || 1);
          const lineWidth = lineOptions.lineWidth || 2;

          renderLine(
            gl,
            vertices,
            color,
            lineWidth,
            attributeLocations.position,
            attributeLocations.color,
            bufferPoolRef.current || undefined,
          );
        }
      });

      // Disable scissor test for labels (they should extend into margins)
      gl.disable(gl.SCISSOR_TEST);

      // Render X-axis labels
      if (options.xGrid?.enable && options.xGrid.ticks) {
        const xTicks = x.ticks(options.xGrid.tickNumber || 8);

        for (const tick of xTicks) {
          const xPos = x(tick);
          const yPos = marginTop + chartHeight + (options.xGrid.tickPadding || 10);

          let tickText = tick.toString();
          if (typeof options.xGrid.tickFormat === "function") {
            tickText = options.xGrid.tickFormat(tick instanceof Date ? tick.getTime() : tick);
          } else if (typeof options.xGrid.tickFormat === "string") {
            // Simple time format handling
            if (options.xGrid.tickFormat.startsWith("%") && tick instanceof Date) {
              const formatter = timeFormat(options.xGrid.tickFormat);
              tickText = formatter(tick);
            }
          }

          // Calculate text width for centering
          const textWidth = tickText.length * (options.xGrid.tickFontSize || 10) * 0.6; // Approximate width

          renderText(
            gl,
            tickText,
            xPos - textWidth / 2, // Center the text properly
            yPos,
            options.xGrid.tickFontSize || 10,
            options.xGrid.tickFontFamily || "sans-serif",
            String(options.xGrid.tickFontWeight || "normal"),
            options.xGrid.tickFontColor || "#6B6C6F",
            textProgramRef.current!,
            textAttributeLocations,
            textUniformLocations,
            bufferPoolRef.current || undefined,
          );
        }
      }

      // Render Y-axis labels
      if (options.yGrid?.enable && options.yGrid.ticks) {
        const yTicks = y.ticks(options.yGrid.tickNumber || 5);

        for (const tick of yTicks) {
          const xPos = marginLeft - (options.yGrid.tickPadding || 10);
          const yPos = y(tick) - (options.yGrid.tickFontSize || 10) / 2; // Center vertically

          let tickText = tick.toString();
          if (typeof options.yGrid.tickFormat === "function") {
            tickText = options.yGrid.tickFormat(tick);
          } else if (typeof options.yGrid.tickFormat === "string") {
            // Handle format strings like "~s" for SI prefix
            if (options.yGrid.tickFormat === "~s") {
              tickText = tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toString();
            }
          }

          // Calculate text width for right alignment
          const textWidth = tickText.length * (options.yGrid.tickFontSize || 10) * 0.6; // Approximate width

          renderText(
            gl,
            tickText,
            xPos - textWidth, // Right-align the text
            yPos,
            options.yGrid.tickFontSize || 10,
            options.yGrid.tickFontFamily || "sans-serif",
            String(options.yGrid.tickFontWeight || "normal"),
            options.yGrid.tickFontColor || "#6B6C6F",
            textProgramRef.current!,
            textAttributeLocations,
            textUniformLocations,
            bufferPoolRef.current || undefined,
          );
        }
      }

      // Periodic buffer pool cleanup
      if (bufferPoolRef.current) {
        bufferPoolRef.current.cleanup();
      }

      lastDrawTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(drawChart);
    },
    [data, dimensions, options, updateData],
  );

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawChart);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [data, dimensions, options]);

  useEffect(() => {
    return () => {
      // Dispose buffer pool resources
      if (bufferPoolRef.current) {
        bufferPoolRef.current.dispose();
        bufferPoolRef.current = null;
      }
    };
  }, []);

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
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export default RealtimeChart;
