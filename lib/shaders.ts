// WebGL shader sources
export const vertexShaderSource = `
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

export const fragmentShaderSource = `
  precision mediump float;
  varying vec4 v_color;

  void main() {
    gl_FragColor = v_color;
  }
`;

// Texture shaders for text rendering
export const textVertexShaderSource = `
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

export const textFragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec4 u_color;
  varying vec2 v_texCoord;

  void main() {
    vec4 texColor = texture2D(u_texture, v_texCoord);
    gl_FragColor = vec4(u_color.rgb, texColor.a * u_color.a);
  }
`;
