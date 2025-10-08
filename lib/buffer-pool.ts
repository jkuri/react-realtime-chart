/**
 * WebGL Buffer Pool Manager
 * Reuses buffers to avoid expensive creation/deletion operations on every frame
 */

interface PooledBuffer {
  buffer: WebGLBuffer;
  size: number;
  inUse: boolean;
  lastUsed: number;
}

interface PooledTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  dpr: number;
  inUse: boolean;
  lastUsed: number;
}

export class BufferPool {
  private gl: WebGLRenderingContext;
  private buffers: PooledBuffer[] = [];
  private textures: PooledTexture[] = [];
  private maxBuffers = 50; // Limit pool size to prevent memory leaks
  private maxTextures = 20;
  private cleanupInterval = 5000; // Clean up unused buffers every 5 seconds
  private maxUnusedTime = 10000; // Remove buffers unused for 10 seconds
  private lastCleanup = 0;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Get a buffer from the pool or create a new one
   */
  getBuffer(size: number): WebGLBuffer {
    const now = performance.now();

    // Try to find an unused buffer of appropriate size
    for (const pooledBuffer of this.buffers) {
      if (!pooledBuffer.inUse && pooledBuffer.size >= size) {
        pooledBuffer.inUse = true;
        pooledBuffer.lastUsed = now;
        return pooledBuffer.buffer;
      }
    }

    // Create new buffer if none available and under limit
    if (this.buffers.length < this.maxBuffers) {
      const buffer = this.gl.createBuffer();
      if (buffer) {
        const pooledBuffer: PooledBuffer = {
          buffer,
          size,
          inUse: true,
          lastUsed: now,
        };
        this.buffers.push(pooledBuffer);
        return buffer;
      }
    }

    // Fallback: force create a new buffer (should rarely happen)
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create WebGL buffer");
    }
    return buffer;
  }

  /**
   * Return a buffer to the pool
   */
  releaseBuffer(buffer: WebGLBuffer): void {
    const pooledBuffer = this.buffers.find((pb) => pb.buffer === buffer);
    if (pooledBuffer) {
      pooledBuffer.inUse = false;
      pooledBuffer.lastUsed = performance.now();
    }
  }

  /**
   * Get a cached texture or create a new one
   */
  getTexture(
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
    color: string,
  ): { texture: WebGLTexture | null; width: number; height: number } | null {
    const now = performance.now();
    const dpr = Math.max(1, Math.min(3, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1));

    // Try to find existing texture with same parameters (including DPR)
    for (const pooledTexture of this.textures) {
      if (
        !pooledTexture.inUse &&
        pooledTexture.text === text &&
        pooledTexture.fontSize === fontSize &&
        pooledTexture.fontFamily === fontFamily &&
        pooledTexture.fontWeight === fontWeight &&
        pooledTexture.color === color &&
        pooledTexture.dpr === dpr
      ) {
        pooledTexture.inUse = true;
        pooledTexture.lastUsed = now;
        return {
          texture: pooledTexture.texture,
          width: pooledTexture.width,
          height: pooledTexture.height,
        };
      }
    }

    // Create new texture if under limit
    if (this.textures.length < this.maxTextures) {
      const textureData = this.createTextTexture(text, fontSize, fontFamily, fontWeight, color);
      if (textureData?.texture) {
        const pooledTexture: PooledTexture = {
          texture: textureData.texture,
          width: textureData.width,
          height: textureData.height,
          text,
          fontSize,
          fontFamily,
          fontWeight,
          color,
          dpr,
          inUse: true,
          lastUsed: now,
        };
        this.textures.push(pooledTexture);
        return textureData;
      }
    }

    // Fallback: create temporary texture
    return this.createTextTexture(text, fontSize, fontFamily, fontWeight, color);
  }

  /**
   * Release a texture back to the pool
   */
  releaseTexture(texture: WebGLTexture): void {
    const pooledTexture = this.textures.find((pt) => pt.texture === texture);
    if (pooledTexture) {
      pooledTexture.inUse = false;
      pooledTexture.lastUsed = performance.now();
    }
  }

  /**
   * Clean up unused buffers and textures periodically
   */
  cleanup(): void {
    const now = performance.now();

    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    // Clean up old unused buffers
    this.buffers = this.buffers.filter((pooledBuffer) => {
      if (!pooledBuffer.inUse && now - pooledBuffer.lastUsed > this.maxUnusedTime) {
        this.gl.deleteBuffer(pooledBuffer.buffer);
        return false;
      }
      return true;
    });

    // Clean up old unused textures
    this.textures = this.textures.filter((pooledTexture) => {
      if (!pooledTexture.inUse && now - pooledTexture.lastUsed > this.maxUnusedTime) {
        this.gl.deleteTexture(pooledTexture.texture);
        return false;
      }
      return true;
    });

    this.lastCleanup = now;
  }

  /**
   * Create a text texture (similar to existing createTextTexture function)
   */
  private createTextTexture(
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
    color: string,
  ): { texture: WebGLTexture | null; width: number; height: number } {
    const dpr = Math.max(1, Math.min(3, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { texture: null, width: 0, height: 0 };

    // Measure in CSS px
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const cssWidth = Math.ceil(metrics.width) + 2;
    const cssHeight = Math.ceil(fontSize) + 2;

    // Backing store in device px
    canvas.width = Math.max(1, Math.ceil(cssWidth * dpr));
    canvas.height = Math.max(1, Math.ceil(cssHeight * dpr));

    // Redraw with proper font after resize
    ctx.scale(dpr, dpr);
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, 1, 1);

    // Create WebGL texture
    const texture = this.gl.createTexture();
    if (!texture) return { texture: null, width: canvas.width, height: canvas.height };

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    // Avoid smoothing blur on high-DPR
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    return { texture, width: canvas.width, height: canvas.height };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Delete all buffers
    for (const pooledBuffer of this.buffers) {
      this.gl.deleteBuffer(pooledBuffer.buffer);
    }
    this.buffers = [];

    // Delete all textures
    for (const pooledTexture of this.textures) {
      this.gl.deleteTexture(pooledTexture.texture);
    }
    this.textures = [];
  }

  /**
   * Get pool statistics for debugging
   */
  getStats(): { buffers: number; textures: number; buffersInUse: number; texturesInUse: number } {
    return {
      buffers: this.buffers.length,
      textures: this.textures.length,
      buffersInUse: this.buffers.filter((b) => b.inUse).length,
      texturesInUse: this.textures.filter((t) => t.inUse).length,
    };
  }
}
