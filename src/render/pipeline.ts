/**
 * Pipeline de renderização: integra o renderizador de chunks (WebGL2 puro) com o Three.js
 * (entidades, partículas, pós-processamento). Cena em HDR (RGBA16F) com MRT (cor + normais).
 */
import * as THREE from 'three';
import { FrameUBO } from './gl/frameubo';
import { GLProgram } from './gl/program';
import { ChunkRenderer } from './chunks/chunkrenderer';
import { uploadBlockTextures, type BlockTextures } from './chunks/texarrays';
import { buildTextureArrays, type TextureArrays } from './textures/atlas';
import { FULLSCREEN_VS, SKY_FS } from './shaders/sky';
import { FXAA_FS, POST_VS, TONEMAP_FS } from './shaders/post';
import { computeSky, type SkyState } from './skymodel';
import type { GraphicsSettings } from '../settings';

export interface FrameInput {
  camX: number; camY: number; camZ: number;
  yaw: number; pitch: number; roll?: number;
  fov: number;
  dayTime: number;
  ticks: number; // tempo de jogo em ticks (com fração)
  rain: number; thunder: number;
  moonPhase: number;
  underwater: boolean;
  underLava: boolean;
  wind: number;
}

interface GLHandles { fbo: WebGLFramebuffer; tex: WebGLTexture[]; depth: WebGLTexture | null }

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly gl: WebGL2RenderingContext;
  readonly camera: THREE.PerspectiveCamera;
  /** cena do Three para entidades, partículas, mão etc. (coordenadas relativas à câmera) */
  readonly scene = new THREE.Scene();
  readonly frame: FrameUBO;
  readonly chunks: ChunkRenderer;
  readonly textures: BlockTextures;
  readonly textureData: TextureArrays;
  sky!: SkyState;
  private hdr!: THREE.WebGLRenderTarget;
  private copy!: THREE.WebGLRenderTarget;
  private ldr!: THREE.WebGLRenderTarget;
  private readonly skyProg: GLProgram;
  private readonly emptyVao: WebGLVertexArrayObject;
  private readonly postScene = new THREE.Scene();
  private readonly postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly tonemapMat: THREE.ShaderMaterial;
  private readonly fxaaMat: THREE.ShaderMaterial;
  private readonly blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  private width = 1;
  private height = 1;
  private readonly viewRot = new THREE.Matrix4();
  private readonly viewProj = new THREE.Matrix4();
  private readonly prevViewProj = new THREE.Matrix4();
  private readonly invViewProj = new THREE.Matrix4();
  private readonly planes = new Float64Array(24);
  private prevCam = [0, 0, 0];
  exposure = 1;
  stats = { fps: 0, frameMs: 0, drawCalls: 0 };
  readonly caps: { webgpu: boolean; gpu: string; floatRT: boolean; anisotropy: number; maxLayers: number };

  constructor(readonly canvas: HTMLCanvasElement, public settings: GraphicsSettings) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.gl = this.renderer.getContext() as WebGL2RenderingContext;
    const gl = this.gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.caps = {
      webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
      gpu: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      floatRT: !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float'),
      anisotropy: aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1,
      maxLayers: gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS),
    };
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
    this.frame = new FrameUBO(gl);
    this.textureData = buildTextureArrays();
    this.textures = uploadBlockTextures(gl, this.textureData, Math.min(8, this.caps.anisotropy));
    this.chunks = new ChunkRenderer(gl, this.textures);
    this.skyProg = new GLProgram(gl, 'ceu', FULLSCREEN_VS, SKY_FS);
    this.skyProg.bindBlock('Frame', FrameUBO.BINDING);
    this.emptyVao = gl.createVertexArray()!;
    this.renderer.resetState();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.tonemapMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POST_VS,
      fragmentShader: TONEMAP_FS,
      uniforms: {
        tColor: { value: null }, tBloom: { value: this.blackTex }, uExposure: { value: 1 }, uBloomStrength: { value: 0 },
        uSaturation: { value: 1.08 }, uContrast: { value: 1.04 }, uVignette: { value: 0.35 },
        uLift: { value: new THREE.Vector3(0.0, 0.0, 0.01) }, uGain: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uTime: { value: 0 }, uUnderwater: { value: 0 }, uUnderwaterColor: { value: new THREE.Vector3(0.02, 0.08, 0.12) },
      },
      depthTest: false, depthWrite: false,
    });
    this.fxaaMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: POST_VS, fragmentShader: FXAA_FS,
      uniforms: { tColor: { value: null }, uInvRes: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(geo, this.tonemapMat);
    this.quad.frustumCulled = false;
    this.postScene.add(this.quad);
    this.blackTex.needsUpdate = true;
    this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);
  }

  resize(w: number, h: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const scale = this.settings.renderScale;
    const W = Math.max(1, Math.round(w * dpr * scale)), H = Math.max(1, Math.round(h * dpr * scale));
    if (W === this.width && H === this.height && this.hdr) return;
    this.width = W; this.height = H;
    this.hdr?.dispose(); this.copy?.dispose(); this.ldr?.dispose();
    const type = this.caps.floatRT ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.hdr = new THREE.WebGLRenderTarget(W, H, { count: 2, type, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.hdr.textures[1].type = THREE.UnsignedByteType;
    this.hdr.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
    this.copy = new THREE.WebGLRenderTarget(W, H, { type, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.copy.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
    this.ldr = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.camera.aspect = w / h;
    // inicializa os alvos para obter os handles GL
    for (const rt of [this.hdr, this.copy, this.ldr]) this.renderer.setRenderTarget(rt);
    this.renderer.setRenderTarget(null);
  }

  private handles(rt: THREE.WebGLRenderTarget): GLHandles {
    const p = this.renderer.properties;
    const fbo = (p.get(rt) as { __webglFramebuffer: WebGLFramebuffer }).__webglFramebuffer;
    const tex = rt.textures.map((t) => (p.get(t) as { __webglTexture: WebGLTexture }).__webglTexture);
    const depth = rt.depthTexture ? (p.get(rt.depthTexture) as { __webglTexture: WebGLTexture }).__webglTexture : null;
    return { fbo, tex, depth };
  }

  private updateFrame(f: FrameInput, renderDistance: number): void {
    const cam = this.camera;
    cam.fov = f.fov;
    cam.near = 0.05;
    cam.far = Math.max(256, renderDistance * 16 * 1.6 + 64);
    cam.updateProjectionMatrix();
    // câmera na origem (renderização relativa à câmera)
    cam.position.set(0, 0, 0);
    cam.rotation.set(f.pitch, f.yaw, f.roll ?? 0, 'YXZ');
    cam.updateMatrixWorld(true);
    this.viewRot.copy(cam.matrixWorldInverse);
    this.prevViewProj.copy(this.viewProj);
    this.viewProj.multiplyMatrices(cam.projectionMatrix, this.viewRot);
    this.invViewProj.copy(this.viewProj).invert();
    extractPlanes(this.viewProj, this.planes);
    const F = this.frame;
    F.mat('viewProj', this.viewProj);
    F.mat('view', this.viewRot);
    F.mat('proj', cam.projectionMatrix);
    F.mat('invViewProj', this.invViewProj);
    F.mat('prevViewProj', this.prevViewProj);
    const sky = computeSky(f.dayTime, f.rain, f.thunder, f.moonPhase);
    this.sky = sky;
    const mod = (v: number) => ((v % 4096) + 4096) % 4096;
    F.vec('camPos', mod(f.camX), f.camY, mod(f.camZ), f.ticks / 20);
    F.vec('sunDir', sky.sunDir[0], sky.sunDir[1], sky.sunDir[2], sky.day);
    F.vec('moonDir', sky.moonDir[0], sky.moonDir[1], sky.moonDir[2], f.moonPhase);
    F.vec('sunColor', sky.sunColor[0], sky.sunColor[1], sky.sunColor[2], 0);
    F.vec('skyAmbient', sky.ambient[0], sky.ambient[1], sky.ambient[2], 0);
    const rd = renderDistance * 16;
    if (f.underwater) {
      F.vec('fogColor', 0.02, 0.07, 0.1, 0.09);
      F.vec('fogParams', rd * 0.3, rd * 0.5, 1, 0);
    } else if (f.underLava) {
      F.vec('fogColor', 0.6, 0.12, 0.01, 1.5);
      F.vec('fogParams', 0.5, 2.5, 0, 1);
    } else {
      const dens = 0.0022 + f.rain * 0.012;
      F.vec('fogColor', sky.fog[0], sky.fog[1], sky.fog[2], dens);
      F.vec('fogParams', rd * 0.72, rd * 0.98, 0, 0);
    }
    const flick = Math.sin(f.ticks * 0.9) * 0.02 + Math.sin(f.ticks * 2.3) * 0.015;
    F.vec('blockLight', 1.55, 0.98, 0.52, flick);
    F.vec('weather', f.rain, f.thunder, f.rain, 0);
    F.vec('misc', f.ticks, 0.6 + f.rain * 0.8 + f.wind, this.settings.aoStrength, 1);
    F.vec('screen', this.width, this.height, 1 / this.width, 1 / this.height);
    F.vec('camDelta', f.camX - this.prevCam[0], f.camY - this.prevCam[1], f.camZ - this.prevCam[2], 0);
    F.vec('skyZenith', sky.zenith[0], sky.zenith[1], sky.zenith[2], 0);
    F.vec('skyHorizon', sky.horizon[0], sky.horizon[1], sky.horizon[2], 0);
    this.prevCam = [f.camX, f.camY, f.camZ];
    F.upload();
  }

  render(f: FrameInput, renderDistance: number, drawThree?: (pass: 'opaque' | 'translucent') => void): void {
    const t0 = performance.now();
    const gl = this.gl;
    const r = this.renderer;
    this.updateFrame(f, renderDistance);
    this.chunks.computeVisible(f.camX, f.camY, f.camZ, renderDistance, { planes: this.planes }, this.settings.caveCulling);

    // ---------------------------------------------------------- cena opaca
    r.setRenderTarget(this.hdr);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    const H = this.handles(this.hdr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, H.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.width, this.height);
    this.frame.bind();
    this.chunks.drawOpaque(f.camX, f.camY, f.camZ);
    // céu onde não há geometria
    gl.depthMask(false);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    this.skyProg.use();
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    r.resetState();
    if (drawThree) {
      r.setRenderTarget(this.hdr);
      drawThree('opaque');
    }

    // ---------------------------------------------------------- cópia para refração
    const C = this.handles(this.copy);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, H.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, C.fbo);
    gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    // ---------------------------------------------------------- água e translúcidos
    gl.bindFramebuffer(gl.FRAMEBUFFER, H.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.width, this.height);
    this.frame.bind();
    this.chunks.drawWater(f.camX, f.camY, f.camZ, C.tex[0], C.depth!, this.camera.near, this.camera.far, this.settings.ssr);
    this.chunks.drawTranslucent(f.camX, f.camY, f.camZ);
    r.resetState();
    if (drawThree) {
      r.setRenderTarget(this.hdr);
      drawThree('translucent');
    }

    // ---------------------------------------------------------- pós
    this.tonemapMat.uniforms.tColor.value = this.hdr.textures[0];
    this.tonemapMat.uniforms.uExposure.value = this.exposure;
    this.tonemapMat.uniforms.uTime.value = (f.ticks % 1000);
    this.tonemapMat.uniforms.uUnderwater.value = f.underwater ? 1 : 0;
    const fxaa = this.settings.aa === 'fxaa';
    this.quad.material = this.tonemapMat;
    r.setRenderTarget(fxaa ? this.ldr : null);
    r.render(this.postScene, this.postCam);
    if (fxaa) {
      this.fxaaMat.uniforms.tColor.value = this.ldr.texture;
      this.fxaaMat.uniforms.uInvRes.value.set(1 / this.width, 1 / this.height);
      this.quad.material = this.fxaaMat;
      r.setRenderTarget(null);
      r.render(this.postScene, this.postCam);
    }
    this.stats.frameMs = performance.now() - t0;
    this.stats.drawCalls = this.chunks.stats.drawn + r.info.render.calls;
  }

  /** Matriz de projeção×visão relativa à câmera (para projetar pontos na tela, ex.: seleção). */
  get viewProjection(): THREE.Matrix4 { return this.viewProj; }
  get renderSize(): [number, number] { return [this.width, this.height]; }
}

function extractPlanes(m: THREE.Matrix4, out: Float64Array): void {
  const e = m.elements;
  const rows = [
    [e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]],
    [e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12]],
    [e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]],
    [e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13]],
    [e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]],
    [e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14]],
  ];
  rows.forEach((r, i) => {
    const l = Math.hypot(r[0], r[1], r[2]) || 1;
    out[i * 4] = r[0] / l; out[i * 4 + 1] = r[1] / l; out[i * 4 + 2] = r[2] / l; out[i * 4 + 3] = r[3] / l;
  });
}
