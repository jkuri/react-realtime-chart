import { line, max, min, scaleLinear, scaleTime } from "d3";
import { subSeconds } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type RealtimeChartData, type RealtimeChartOptions, curveTypeMapping } from "./types";
import { hexToRgb, mergeDeep } from "./utils";

// WebGL shader sources
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  uniform vec2 u_resolution;
  varying vec4 v_color;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_color = a_color;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec4 v_color;

  void main() {
    gl_FragColor = v_color;
  }
`;

// Texture shaders for text rendering
const textVertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texCoord = a_texCoord;
  }
`;

const textFragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec4 u_color;
  varying vec2 v_texCoord;

  void main() {
    vec4 texColor = texture2D(u_texture, v_texCoord);
    gl_FragColor = vec4(u_color.rgb, texColor.a * u_color.a);
  }
`;

// WebGL utility functions
function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Error linking program:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  // Handle different hex formats
  let cleanHex = hex;

  // Add # if missing
  if (!cleanHex.startsWith("#")) {
    cleanHex = `#${cleanHex}`;
  }

  // Handle 8-digit hex with alpha (extract RGB part)
  if (cleanHex.length === 9) {
    cleanHex = cleanHex.substring(0, 7); // Take only RGB part
  }

  // Handle 6-digit hex (already correct)
  if (cleanHex.length === 7) {
    // Already in correct format
  }

  // Handle 3-digit hex
  else if (cleanHex.length === 4) {
    cleanHex = `#${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}${cleanHex[3]}${cleanHex[3]}`;
  }

  // Fallback for invalid formats
  else {
    console.warn(`Invalid hex color format: ${hex}, using fallback`);
    cleanHex = "#000000";
  }

  const rgb = hexToRgb(cleanHex).split(", ").map(Number);
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha];
}

// Triangulation for area rendering - creates triangles for the area between line and baseline
function triangulateArea(lineVertices: number[], baselineY: number): number[] {
  const triangles: number[] = [];

  if (lineVertices.length < 4) return triangles; // Need at least 2 points for a line

  // Create triangles between each line segment and the baseline
  for (let i = 0; i < lineVertices.length - 2; i += 2) {
    const x1 = lineVertices[i];
    const y1 = lineVertices[i + 1];
    const x2 = lineVertices[i + 2];
    const y2 = lineVertices[i + 3];

    // Create two triangles for the quad between line segment and baseline
    // Triangle 1: (x1, y1) -> (x1, baselineY) -> (x2, y2)
    triangles.push(x1, y1, x1, baselineY, x2, y2);

    // Triangle 2: (x1, baselineY) -> (x2, baselineY) -> (x2, y2)
    triangles.push(x1, baselineY, x2, baselineY, x2, y2);
  }

  return triangles;
}

// Render triangles using WebGL
function renderTriangles(
  gl: WebGLRenderingContext,
  vertices: number[],
  color: [number, number, number, number],
  positionLocation: number,
  colorLocation: number,
) {
  if (vertices.length === 0) return;

  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();

  // Create color array for all vertices
  const colors: number[] = [];
  for (let i = 0; i < vertices.length / 2; i++) {
    colors.push(...color);
  }

  // Bind position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Bind color buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

  // Draw triangles
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);

  // Clean up
  gl.deleteBuffer(positionBuffer);
  gl.deleteBuffer(colorBuffer);
}

// Render line using WebGL (convert to triangles for thickness)
function renderLine(
  gl: WebGLRenderingContext,
  vertices: number[],
  color: [number, number, number, number],
  lineWidth: number,
  positionLocation: number,
  colorLocation: number,
) {
  if (vertices.length < 4) return; // Need at least 2 points

  const lineTriangles: number[] = [];
  const halfWidth = lineWidth / 2;

  // Convert line to triangles for thickness
  for (let i = 0; i < vertices.length - 2; i += 2) {
    const x1 = vertices[i];
    const y1 = vertices[i + 1];
    const x2 = vertices[i + 2];
    const y2 = vertices[i + 3];

    // Calculate perpendicular vector
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) continue;

    const perpX = (-dy / length) * halfWidth;
    const perpY = (dx / length) * halfWidth;

    // Create quad as two triangles
    lineTriangles.push(
      x1 + perpX,
      y1 + perpY,
      x1 - perpX,
      y1 - perpY,
      x2 + perpX,
      y2 + perpY,

      x1 - perpX,
      y1 - perpY,
      x2 - perpX,
      y2 - perpY,
      x2 + perpX,
      y2 + perpY,
    );
  }

  renderTriangles(gl, lineTriangles, color, positionLocation, colorLocation);
}

// Render grid lines using WebGL
function renderGridLines(
  gl: WebGLRenderingContext,
  lines: { x1: number; y1: number; x2: number; y2: number }[],
  color: [number, number, number, number],
  lineWidth: number,
  positionLocation: number,
  colorLocation: number,
) {
  for (const line of lines) {
    const vertices = [line.x1, line.y1, line.x2, line.y2];
    renderLine(gl, vertices, color, lineWidth, positionLocation, colorLocation);
  }
}

// Create a simple texture for text rendering (fallback for complex text)
function createTextTexture(
  gl: WebGLRenderingContext,
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  color: string,
): { texture: WebGLTexture | null; width: number; height: number } {
  // Create a canvas for text rendering
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { texture: null, width: 0, height: 0 };

  // Set font properties
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);

  // Set canvas size based on text metrics
  canvas.width = Math.ceil(metrics.width) + 4; // Add padding
  canvas.height = fontSize + 4; // Add padding

  // Clear and set font again (canvas resize clears context)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Draw text
  ctx.fillText(text, 2, 2);

  // Create WebGL texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { texture, width: canvas.width, height: canvas.height };
}

// Render text using WebGL texture
function renderText(
  gl: WebGLRenderingContext,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  color: string,
  textProgram: WebGLProgram,
  textAttributeLocations: { position: number; texCoord: number },
  textUniformLocations: {
    resolution: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  },
) {
  const { texture, width, height } = createTextTexture(gl, text, fontSize, fontFamily, fontWeight, color);
  if (!texture) return;

  // Use text shader program
  gl.useProgram(textProgram);

  // Set uniforms
  gl.uniform2f(textUniformLocations.resolution, gl.canvas.width, gl.canvas.height);
  gl.uniform1i(textUniformLocations.texture, 0);

  // Parse color
  const colorMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (colorMatch) {
    const r = Number.parseInt(colorMatch[1], 16) / 255;
    const g = Number.parseInt(colorMatch[2], 16) / 255;
    const b = Number.parseInt(colorMatch[3], 16) / 255;
    gl.uniform4f(textUniformLocations.color, r, g, b, 1.0);
  }

  // Create quad vertices for text
  const x1 = x;
  const y1 = y;
  const x2 = x + width;
  const y2 = y + height;

  const positions = [x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2];

  const texCoords = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1];

  // Create and bind buffers
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(textAttributeLocations.position);
  gl.vertexAttribPointer(textAttributeLocations.position, 2, gl.FLOAT, false, 0, 0);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(textAttributeLocations.texCoord);
  gl.vertexAttribPointer(textAttributeLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

  // Bind texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Clean up
  gl.deleteBuffer(positionBuffer);
  gl.deleteBuffer(texCoordBuffer);
  gl.deleteTexture(texture);
}

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
        setDimensions({
          width: width - (options.margin?.left || 0) - (options.margin?.right || 0),
          height: height - (options.margin?.top || 0) - (options.margin?.bottom || 0),
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initialize WebGL when component mounts
    initWebGL();

    return () => resizeObserver.disconnect();
  }, [initWebGL]);

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

      const pixelRatio = window.devicePixelRatio || 1;
      const totalWidth = dimensions.width + (options.margin?.left || 0) + (options.margin?.right || 0);
      const totalHeight = dimensions.height + (options.margin?.top || 0) + (options.margin?.bottom || 0);

      canvas.width = totalWidth * pixelRatio;
      canvas.height = totalHeight * pixelRatio;
      canvas.style.width = `${totalWidth}px`;
      canvas.style.height = `${totalHeight}px`;

      gl.viewport(0, 0, canvas.width, canvas.height);

      const now = new Date();
      const x = scaleTime()
        .range([options.margin?.left || 0, (options.margin?.left || 0) + dimensions.width])
        .domain([subSeconds(now, options.timeSlots! - 2), subSeconds(now, 2)]);

      const values = data.reduce((acc, curr) => acc.concat(curr.map((d) => d.value)), [] as number[]);
      const [minv, maxv] = [Number(min(values)), Number(max(values))];
      const factor = (maxv - minv) * 0.05;
      const [ymin, ymax] = [
        options.yGrid?.min === "auto" ? minv - factor : options.yGrid?.min,
        options.yGrid?.max === "auto" ? maxv + factor : options.yGrid?.max,
      ];

      const y = scaleLinear()
        .range([(options.margin?.top || 0) + dimensions.height, options.margin?.top || 0])
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
            y1: options.margin?.top || 0,
            x2: xPos,
            y2: (options.margin?.top || 0) + dimensions.height,
          });
        }

        // Render grid lines
        const actualOpacity = Math.max(0.15, options.xGrid.opacity || 0.5);
        const gridColor = hexToRgba(options.xGrid.color || "#e9e9e9", actualOpacity);
        renderGridLines(
          gl,
          gridLines,
          gridColor,
          (options.xGrid.size || 1) * pixelRatio,
          attributeLocations.position,
          attributeLocations.color,
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
            x1: options.margin?.left || 0,
            y1: yPos,
            x2: (options.margin?.left || 0) + dimensions.width,
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
          (options.yGrid.size || 1) * pixelRatio,
          attributeLocations.position,
          attributeLocations.color,
        );
      }

      // Enable scissor test to clip chart content to the chart area
      gl.enable(gl.SCISSOR_TEST);
      const chartLeft = (options.margin?.left || 0) * pixelRatio;
      const chartTop = (options.margin?.top || 0) * pixelRatio;
      const chartWidth = dimensions.width * pixelRatio;
      const chartHeight = dimensions.height * pixelRatio;
      // Note: WebGL scissor coordinates are from bottom-left, so we need to flip Y
      const scissorY = canvas.height - chartTop - chartHeight;
      gl.scissor(chartLeft, scissorY, chartWidth, chartHeight);

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
            const baselineY = (options.margin?.top || 0) + dimensions.height; // Bottom of chart area
            const triangles = triangulateArea(lineVertices, baselineY);
            const color = hexToRgba(lineOptions.areaColor || "#000", lineOptions.areaOpacity || 0.1);

            renderTriangles(gl, triangles, color, attributeLocations.position, attributeLocations.color);
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
          const lineWidth = (lineOptions.lineWidth || 2) * pixelRatio;

          renderLine(gl, vertices, color, lineWidth, attributeLocations.position, attributeLocations.color);
        }
      });

      // Disable scissor test for labels (they should extend into margins)
      gl.disable(gl.SCISSOR_TEST);

      // Render X-axis labels
      if (options.xGrid?.enable && options.xGrid.ticks) {
        const xTicks = x.ticks(options.xGrid.tickNumber || 8);

        for (const tick of xTicks) {
          const xPos = x(tick);
          const yPos = (options.margin?.top || 0) + dimensions.height + (options.xGrid.tickPadding || 10);

          let tickText = tick.toString();
          if (typeof options.xGrid.tickFormat === "function") {
            tickText = options.xGrid.tickFormat(tick instanceof Date ? tick.getTime() : tick);
          } else if (typeof options.xGrid.tickFormat === "string") {
            // Simple time format handling
            if (options.xGrid.tickFormat.includes("%H:%M:%S") && tick instanceof Date) {
              tickText = tick.toLocaleTimeString();
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
          );
        }
      }

      // Render Y-axis labels
      if (options.yGrid?.enable && options.yGrid.ticks) {
        const yTicks = y.ticks(options.yGrid.tickNumber || 5);

        for (const tick of yTicks) {
          const xPos = (options.margin?.left || 0) - (options.yGrid.tickPadding || 10);
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
          );
        }
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
