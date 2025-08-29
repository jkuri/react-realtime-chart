import type { BufferPool } from "./buffer-pool";

type Primitive = string | number | boolean | symbol | null | undefined;

type DeepMerge<T, U> = T extends Primitive
  ? U
  : T extends Array<infer TItem>
    ? U extends Array<infer UItem>
      ? Array<DeepMerge<TItem, UItem>>
      : T
    : T extends object
      ? U extends object
        ? {
            [K in keyof T | keyof U]: K extends keyof U
              ? K extends keyof T
                ? DeepMerge<T[K], U[K]>
                : U[K]
              : K extends keyof T
                ? T[K]
                : never;
          }
        : T
      : U;

type DeepMergeAll<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? Rest extends []
    ? First
    : Rest extends unknown[]
      ? DeepMerge<First, DeepMergeAll<Rest>>
      : never
  : unknown;

export function mergeDeep<T extends unknown[]>(...sources: T): DeepMergeAll<T> {
  const isObject = (val: unknown): val is object => val !== null && typeof val === "object" && !Array.isArray(val);

  return sources.reduce((acc, source) => {
    if (Array.isArray(acc) && Array.isArray(source)) {
      const maxLength = Math.max(acc.length, source.length);
      const result: unknown[] = [];

      for (let i = 0; i < maxLength; i++) {
        const a = acc[i];
        const b = source[i];

        if (isObject(a) && isObject(b)) {
          result[i] = mergeDeep(a, b);
        } else {
          result[i] = b ?? a;
        }
      }

      return result;
    }

    if (isObject(acc) && isObject(source)) {
      const result: Record<string, unknown> = { ...(acc as Record<string, unknown>) };

      for (const [key, val] of Object.entries(source)) {
        const aVal = (acc as Record<string, unknown>)[key];

        if (isObject(aVal) && isObject(val)) {
          result[key] = mergeDeep(aVal, val);
        } else {
          result[key] = val;
        }
      }

      return result;
    }

    return source;
  }) as DeepMergeAll<T>;
}

export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
  return `${Number.parseInt(result[1], 16)}, ${Number.parseInt(result[2], 16)}, ${Number.parseInt(result[3], 16)}`;
}

export function subSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() - seconds * 1000);
}

// WebGL utility functions
export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
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

export function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
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

export function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
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
export function triangulateArea(lineVertices: number[], baselineY: number): number[] {
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

// Render triangles using WebGL with buffer pooling
export function renderTriangles(
  gl: WebGLRenderingContext,
  vertices: number[],
  color: [number, number, number, number],
  positionLocation: number,
  colorLocation: number,
  bufferPool?: BufferPool,
) {
  if (vertices.length === 0) return;

  // Create color array for all vertices
  const colors: number[] = [];
  for (let i = 0; i < vertices.length / 2; i++) {
    colors.push(...color);
  }

  const verticesArray = new Float32Array(vertices);
  const colorsArray = new Float32Array(colors);

  let positionBuffer: WebGLBuffer | null = null;
  let colorBuffer: WebGLBuffer | null = null;
  let shouldDeleteBuffers = false;

  if (bufferPool) {
    // Use buffer pool
    positionBuffer = bufferPool.getBuffer(verticesArray.byteLength);
    colorBuffer = bufferPool.getBuffer(colorsArray.byteLength);
  } else {
    // Fallback to creating new buffers
    positionBuffer = gl.createBuffer();
    colorBuffer = gl.createBuffer();
    shouldDeleteBuffers = true;
  }

  if (!positionBuffer || !colorBuffer) return;

  // Bind position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, verticesArray, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Bind color buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colorsArray, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

  // Draw triangles
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);

  // Clean up or return to pool
  if (bufferPool) {
    bufferPool.releaseBuffer(positionBuffer);
    bufferPool.releaseBuffer(colorBuffer);
  } else if (shouldDeleteBuffers) {
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
  }
}

// Render line using WebGL (convert to triangles for thickness)
export function renderLine(
  gl: WebGLRenderingContext,
  vertices: number[],
  color: [number, number, number, number],
  lineWidth: number,
  positionLocation: number,
  colorLocation: number,
  bufferPool?: BufferPool,
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

  renderTriangles(gl, lineTriangles, color, positionLocation, colorLocation, bufferPool);
}

// Render grid lines using WebGL
export function renderGridLines(
  gl: WebGLRenderingContext,
  lines: { x1: number; y1: number; x2: number; y2: number }[],
  color: [number, number, number, number],
  lineWidth: number,
  positionLocation: number,
  colorLocation: number,
  bufferPool?: BufferPool,
) {
  for (const line of lines) {
    const vertices = [line.x1, line.y1, line.x2, line.y2];
    renderLine(gl, vertices, color, lineWidth, positionLocation, colorLocation, bufferPool);
  }
}

// Create a simple texture for text rendering (fallback for complex text)
export function createTextTexture(
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
  if (!texture) return { texture: null, width: canvas.width, height: canvas.height };

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { texture, width: canvas.width, height: canvas.height };
}

// Render text using WebGL texture with buffer pooling
export function renderText(
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
  bufferPool?: BufferPool,
) {
  let textureData: { texture: WebGLTexture | null; width: number; height: number } | null = null;
  let shouldDeleteTexture = false;

  if (bufferPool) {
    // Try to get cached texture from pool
    textureData = bufferPool.getTexture(text, fontSize, fontFamily, fontWeight, color);
  }

  if (!textureData) {
    // Fallback to creating new texture
    textureData = createTextTexture(gl, text, fontSize, fontFamily, fontWeight, color);
    shouldDeleteTexture = true;
  }

  if (!textureData || !textureData.texture) return;

  const { texture, width, height } = textureData;

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

  const positionsArray = new Float32Array(positions);
  const texCoordsArray = new Float32Array(texCoords);

  let positionBuffer: WebGLBuffer | null = null;
  let texCoordBuffer: WebGLBuffer | null = null;
  let shouldDeleteBuffers = false;

  if (bufferPool) {
    // Use buffer pool
    positionBuffer = bufferPool.getBuffer(positionsArray.byteLength);
    texCoordBuffer = bufferPool.getBuffer(texCoordsArray.byteLength);
  } else {
    // Fallback to creating new buffers
    positionBuffer = gl.createBuffer();
    texCoordBuffer = gl.createBuffer();
    shouldDeleteBuffers = true;
  }

  if (!positionBuffer || !texCoordBuffer) return;

  // Bind position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positionsArray, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(textAttributeLocations.position);
  gl.vertexAttribPointer(textAttributeLocations.position, 2, gl.FLOAT, false, 0, 0);

  // Bind texture coordinate buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, texCoordsArray, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(textAttributeLocations.texCoord);
  gl.vertexAttribPointer(textAttributeLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

  // Bind texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Clean up or return to pool
  if (bufferPool) {
    bufferPool.releaseBuffer(positionBuffer);
    bufferPool.releaseBuffer(texCoordBuffer);
    bufferPool.releaseTexture(texture);
  } else if (shouldDeleteBuffers) {
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
  }

  if (shouldDeleteTexture) {
    gl.deleteTexture(texture);
  }
}
