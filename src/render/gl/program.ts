/** Utilitários mínimos para programas WebGL2 crus (usados pelo renderizador de chunks). */

export class GLProgram {
  readonly program: WebGLProgram;
  private readonly locs = new Map<string, WebGLUniformLocation | null>();

  constructor(readonly gl: WebGL2RenderingContext, readonly name: string, vs: string, fs: string, defines: Record<string, string | number | boolean> = {}) {
    const header = '#version 300 es\n' + Object.entries(defines).filter(([, v]) => v !== false).map(([k, v]) => `#define ${k} ${v === true ? '' : v}`).join('\n') + '\n';
    const v = compile(gl, gl.VERTEX_SHADER, header + vs, name + '.vert');
    const f = compile(gl, gl.FRAGMENT_SHADER, header + fs, name + '.frag');
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aData');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      throw new Error(`Falha ao ligar o programa ${name}: ${log}`);
    }
    gl.deleteShader(v);
    gl.deleteShader(f);
    this.program = p;
  }

  use(): void { this.gl.useProgram(this.program); }

  loc(name: string): WebGLUniformLocation | null {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name);
      this.locs.set(name, l);
    }
    return l;
  }

  bindBlock(blockName: string, binding: number): void {
    const idx = this.gl.getUniformBlockIndex(this.program, blockName);
    if (idx !== this.gl.INVALID_INDEX) this.gl.uniformBlockBinding(this.program, idx, binding);
  }

  sampler(name: string, unit: number): void {
    this.use();
    const l = this.loc(name);
    if (l) this.gl.uniform1i(l, unit);
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string, name: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? '';
    const lines = src.split('\n').map((l, i) => `${String(i + 1).padStart(4)}: ${l}`).join('\n');
    console.error(`Erro no shader ${name}:\n${log}\n${lines}`);
    throw new Error(`Falha ao compilar ${name}: ${log}`);
  }
  return s;
}
