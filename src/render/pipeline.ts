/**
 * Pipeline de renderização: integra o renderizador de chunks (WebGL2 puro) com o Three.js
 * (entidades, partículas, pós-processamento). Cena em HDR (RGBA16F) com MRT (cor + normais).
 */
import * as THREE from 'three';
import { blockArrayTexture } from './entities/shared';
import { FrameUBO } from './gl/frameubo';
import { GLProgram } from './gl/program';
import { ChunkRenderer } from './chunks/chunkrenderer';
import { uploadBlockTextures, type BlockTextures } from './chunks/texarrays';
import { buildTextureArrays, type TextureArrays } from './textures/atlas';
import { FULLSCREEN_VS, SKY_FS } from './shaders/sky';
import { SKYLUT_FS } from './shaders/atmosphere';
import { FXAA_FS, POST_VS, TONEMAP_FS } from './shaders/post';
import { computeSky, SKY_SCALE, type SkyState } from './skymodel';
import type { GraphicsSettings } from '../settings';
import { syncShared, setSharedTextures } from './entities/shared';
import { ShadowMaps } from './shadows';
import { buildCloudMap, CLOUD_MAP_SIZE } from './cloudmap';
import { PostFX, type SunScreen } from './post/postfx';

const LUT_W = 256, LUT_H = 128, LUT_LEVELS = 9;
/** altura da base das nuvens */
const CLOUD_Y = 192.5;
/** período do deslocamento das nuvens (blocos) — o mapa se repete a cada 1024 células de 12 */
const CLOUD_PERIOD = 12 * 1024;

export interface ThreeLayers {
  opaque?: THREE.Scene;
  translucent?: THREE.Scene;
  hand?: { scene: THREE.Scene; camera: THREE.Camera };
}

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
  private readonly lutProg: GLProgram;
  private readonly skyLut: WebGLTexture;
  private readonly skyLutFbo: WebGLFramebuffer;
  private readonly cloudTex: WebGLTexture;
  readonly shadows: ShadowMaps;
  private readonly post: PostFX;
  private readonly emptyVao: WebGLVertexArrayObject;
  private lastFrameTime = 0;
  private readonly sunScreen: SunScreen = { uv: [0.5, 0.5], on: false, facing: 0, sizeUV: [0.01, 0.01], lum: 1 };
  private readonly fwd: [number, number, number] = [0, 0, -1];
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
  private shadowQuality = -1;
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
    blockArrayTexture(this.textureData); // atlas de blocos para itens, blocos caindo e criaturas
    this.chunks = new ChunkRenderer(gl, this.textures);
    this.skyProg = new GLProgram(gl, 'atmosfera', FULLSCREEN_VS, SKY_FS);
    this.skyProg.bindBlock('Frame', FrameUBO.BINDING);
    this.skyProg.sampler('uSkyLUT', 6);
    this.skyProg.sampler('uCloudMap', 7);
    this.skyProg.sampler('uShadowMap', 8);
    this.skyProg.sampler('uSceneDepth', 9);
    this.lutProg = new GLProgram(gl, 'ceu-lut', FULLSCREEN_VS, SKYLUT_FS);
    this.lutProg.bindBlock('Frame', FrameUBO.BINDING);
    this.emptyVao = gl.createVertexArray()!;
    // LUT do céu (com mipmaps para a irradiância)
    this.skyLut = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.skyLut);
    gl.texStorage2D(gl.TEXTURE_2D, LUT_LEVELS, gl.RGBA16F, LUT_W, LUT_H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.skyLutFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.skyLutFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.skyLut, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // mapa das nuvens
    this.cloudTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.cloudTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, CLOUD_MAP_SIZE, CLOUD_MAP_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, buildCloudMap());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.shadows = new ShadowMaps(gl);
    this.shadows.configure(settings.shadows);
    this.chunks.globals = { sky: this.skyLut, clouds: this.cloudTex, shadow: this.shadows.tex };
    setSharedTextures(this.skyLut, this.cloudTex, this.shadows.tex);
    this.renderer.resetState();
    this.post = new PostFX(this.renderer);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.tonemapMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POST_VS,
      fragmentShader: TONEMAP_FS,
      uniforms: {
        tColor: { value: null }, tBloom: { value: this.blackTex }, tRays: { value: this.blackTex }, tExposure: { value: this.blackTex },
        uExposure: { value: 1 }, uAutoExposure: { value: 0 }, uExpCurve: { value: new THREE.Vector4(0.45, 0.35, 0.6, 3.0) },
        uBloomStrength: { value: 0 }, uRayStrength: { value: 0 }, uSunUV: { value: new THREE.Vector2(0.5, 0.5) },
        uFlare: { value: 0 }, uFlareColor: { value: new THREE.Vector3(1, 0.8, 0.6) }, uAspect: { value: 1 },
        uSaturation: { value: 1.14 }, uContrast: { value: 1.1 }, uVignette: { value: 0.4 },
        uLift: { value: new THREE.Vector3(0.0, 0.0, 0.012) }, uGain: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, uWarmth: { value: 0.6 }, uGrade: { value: new THREE.Vector3(1, 1, 1) },
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
    this.post.resize(W, H);
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
    const e = cam.matrixWorld.elements;
    this.fwd[0] = -e[8]; this.fwd[1] = -e[9]; this.fwd[2] = -e[10];
    const F = this.frame;
    F.mat('viewProj', this.viewProj);
    F.mat('view', this.viewRot);
    F.mat('proj', cam.projectionMatrix);
    F.mat('invViewProj', this.invViewProj);
    F.mat('prevViewProj', this.prevViewProj);
    const sky = computeSky(f.dayTime, f.rain, f.thunder, f.moonPhase);
    this.sky = sky;
    const mod = (v: number, m: number) => ((v % m) + m) % m;
    F.vec('camPos', mod(f.camX, 4096), f.camY, mod(f.camZ, 4096), f.ticks / 20);
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
      const dens = 0.0009 + f.rain * 0.0045;
      F.vec('fogColor', sky.fog[0], sky.fog[1], sky.fog[2], dens);
      F.vec('fogParams', rd * 0.7, rd * 0.98, 0, 0);
    }
    const flick = Math.sin(f.ticks * 0.9) * 0.02 + Math.sin(f.ticks * 2.3) * 0.015;
    F.vec('blockLight', 1.55, 0.98, 0.52, flick);
    F.vec('weather', f.rain, f.thunder, f.rain, 0);
    F.vec('misc', f.ticks, 0.6 + f.rain * 0.8 + f.wind, this.settings.aoStrength, 1);
    F.vec('screen', this.width, this.height, 1 / this.width, 1 / this.height);
    F.vec('camDelta', f.camX - this.prevCam[0], f.camY - this.prevCam[1], f.camZ - this.prevCam[2], 0);
    F.vec('skyZenith', sky.zenith[0], sky.zenith[1], sky.zenith[2], 0);
    F.vec('skyHorizon', sky.horizon[0], sky.horizon[1], sky.horizon[2], 0);
    F.vec('sunPos', sky.sunPos[0], sky.sunPos[1], sky.sunPos[2], sky.sunPos[1] > -0.22 ? 1 : 0);
    F.vec('sunRad', sky.sunExtra[0], sky.sunExtra[1], sky.sunExtra[2], SKY_SCALE);
    const moonVis = sky.moonDir[1] > -0.12 ? 1 : 0;
    F.vec('moonColor', sky.moonLight[0], sky.moonLight[1], sky.moonLight[2], moonVis * (1 - f.rain) * (1 - sky.day * 0.85) * 1.4);
    const clouds = this.settings.clouds > 0 ? Math.min(0.92, 0.42 + f.rain * 0.45) : 0;
    const drift = f.ticks * 0.03;
    F.vec('clouds', mod(f.camX + drift, CLOUD_PERIOD), mod(f.camZ, CLOUD_PERIOD), clouds, CLOUD_Y - f.camY);
    F.vec('cloudLight', sky.cloudLight[0], sky.cloudLight[1], sky.cloudLight[2], f.rain);
    const hfog = f.underwater || f.underLava ? 0 : 0.0011 + sky.sunset * 0.0032 + sky.night * 0.0012 + f.rain * 0.0035;
    F.vec('fx', hfog, sky.sunset, sky.night, sky.stars);
    F.vec('sunDisc', sky.sunDisc[0], sky.sunDisc[1], sky.sunDisc[2], -sky.celestial * Math.PI * 2);
    this.prevCam = [f.camX, f.camY, f.camZ];
    // sol na tela (raios e lens flare)
    const sp = sky.sunPos, vp = this.viewProj.elements;
    const cx = vp[0] * sp[0] + vp[4] * sp[1] + vp[8] * sp[2];
    const cy = vp[1] * sp[0] + vp[5] * sp[1] + vp[9] * sp[2];
    const cw = vp[3] * sp[0] + vp[7] * sp[1] + vp[11] * sp[2];
    const ss = this.sunScreen;
    ss.facing = this.fwd[0] * sp[0] + this.fwd[1] * sp[1] + this.fwd[2] * sp[2];
    ss.on = cw > 0.01 && sp[1] > -0.03 && f.rain < 0.9 && !f.underwater && !f.underLava;
    if (cw > 0.01) { ss.uv[0] = cx / cw * 0.5 + 0.5; ss.uv[1] = cy / cw * 0.5 + 0.5; }
    const pm = cam.projectionMatrix.elements;
    ss.sizeUV[0] = 0.045 * pm[0] * 0.5; ss.sizeUV[1] = 0.045 * pm[5] * 0.5;
    ss.lum = sky.sunDisc[0] * 0.2126 + sky.sunDisc[1] * 0.7152 + sky.sunDisc[2] * 0.0722;
  }

  /** LUT do céu (dispersão) + mipmaps. */
  private renderSkyLut(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.skyLutFbo);
    gl.viewport(0, 0, LUT_W, LUT_H);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    this.frame.bind();
    this.lutProg.use();
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, this.skyLut);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  private bindGlobals(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, this.skyLut);
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.cloudTex);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.shadows.tex);
    gl.activeTexture(gl.TEXTURE0);
  }

  render(f: FrameInput, renderDistance: number, layers: ThreeLayers = {}): void {
    const t0 = performance.now();
    const dt = this.lastFrameTime ? Math.min(0.25, (t0 - this.lastFrameTime) / 1000) : 1 / 60;
    this.lastFrameTime = t0;
    const gl = this.gl;
    const r = this.renderer;
    if (this.shadowQuality !== this.settings.shadows) {
      this.shadowQuality = this.settings.shadows;
      this.shadows.configure(this.settings.shadows);
      this.chunks.globals = { sky: this.skyLut, clouds: this.cloudTex, shadow: this.shadows.tex };
      setSharedTextures(this.skyLut, this.cloudTex, this.shadows.tex);
    }
    this.updateFrame(f, renderDistance);
    // sombras (antes do upload do bloco: escrevem as matrizes)
    const sky = this.sky;
    const lightOn = !f.underLava && (sky.sunColor[0] + sky.sunColor[1] + sky.sunColor[2]) > 0.004;
    this.frame.bind();
    this.shadows.update(this.chunks, this.frame, [f.camX, f.camY, f.camZ], this.fwd, sky.sunDir,
      (f.fov * Math.PI) / 180, this.width / this.height, this.settings.shadowDistance, lightOn);
    this.frame.upload();
    syncShared(this.frame);
    this.renderSkyLut();
    this.chunks.computeVisible(f.camX, f.camY, f.camZ, renderDistance, { planes: this.planes }, this.settings.caveCulling);

    // ---------------------------------------------------------- cena opaca
    r.resetState();
    r.setRenderTarget(this.hdr);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    const H = this.handles(this.hdr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, H.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.width, this.height);
    this.frame.bind();
    this.bindGlobals();
    this.chunks.drawOpaque(f.camX, f.camY, f.camZ);
    r.resetState();
    if (layers.opaque) {
      r.setRenderTarget(this.hdr);
      r.render(layers.opaque, this.camera);
    }

    // ---------------------------------------------------------- céu, sol, lua, estrelas e nuvens
    const C = this.handles(this.copy);
    const blit = (bits: number) => {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, H.fbo);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, C.fbo);
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, bits, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    };
    blit(gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, H.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    this.frame.bind();
    this.bindGlobals();
    gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, C.depth);
    gl.activeTexture(gl.TEXTURE0);
    this.skyProg.use();
    gl.uniform1f(this.skyProg.loc('uCloudDist'), this.settings.clouds >= 2 ? 1400 : 900);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    // cópia de cor para refração/reflexos da água
    blit(gl.COLOR_BUFFER_BIT);

    // ---------------------------------------------------------- água e translúcidos
    gl.bindFramebuffer(gl.FRAMEBUFFER, H.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.width, this.height);
    this.frame.bind();
    this.bindGlobals();
    this.chunks.drawWater(f.camX, f.camY, f.camZ, C.tex[0], C.depth!, this.camera.near, this.camera.far, this.settings.ssr);
    this.chunks.drawTranslucent(f.camX, f.camY, f.camZ);
    r.resetState();
    if (layers.translucent) {
      r.setRenderTarget(this.hdr);
      r.render(layers.translucent, this.camera);
    }
    if (layers.hand) {
      r.setRenderTarget(this.hdr);
      r.clearDepth();
      r.render(layers.hand.scene, layers.hand.camera);
    }

    // ---------------------------------------------------------- pós
    const hdrTex = this.hdr.textures[0];
    const depthTex = this.copy.depthTexture!;
    const sun = this.sunScreen;
    const tm = this.tonemapMat.uniforms;
    const exTex = this.post.exposure(hdrTex, depthTex, sun, dt, 1.6);
    const g = this.settings;
    const manualExp = this.exposure * (0.8 + g.brightness * 0.4);
    tm.tBloom.value = g.bloom
      ? this.post.bloom(hdrTex, 2.2, 1.0, { tex: exTex, curve: tm.uExpCurve.value as THREE.Vector4, auto: g.autoExposure, manual: manualExp })
      : this.blackTex;
    // a cadeia soma ~6 níveis: força efetiva ≈ 6× este valor
    tm.uBloomStrength.value = g.bloom ? 0.055 : 0;
    const rays = g.bloom || g.volumetricLight ? this.post.godRays(hdrTex, depthTex, sun) : null;
    tm.tRays.value = rays ?? this.blackTex;
    const facing = Math.max(0, sun.facing);
    tm.uRayStrength.value = rays ? (0.14 + sky.sunset * 0.32) * Math.min(1, facing * 2) * (g.volumetricLight ? 1.25 : 1) : 0;
    tm.uSunUV.value.set(sun.uv[0], sun.uv[1]);
    tm.uFlare.value = sun.on && g.bloom ? 0.12 * Math.min(1, facing * 1.5) : 0;
    const sc = sky.sunDisc, sm = Math.max(sc[0], sc[1], sc[2], 1e-4);
    tm.uFlareColor.value.set(sc[0] / sm, sc[1] / sm, sc[2] / sm);
    tm.uAspect.value = this.width / this.height;
    tm.tExposure.value = exTex;
    tm.uAutoExposure.value = g.autoExposure ? 1 : 0;
    tm.tColor.value = hdrTex;
    tm.uExposure.value = manualExp;
    tm.uTime.value = (f.ticks % 1000);
    tm.uUnderwater.value = f.underwater ? 1 : 0;
    // gradação por hora do dia: dourado no pôr do sol, azulado à noite
    const gs = sky.sunset * 0.75, gn = sky.night * (1 - sky.sunset);
    tm.uGrade.value.set(1 + gs * 0.1 - gn * 0.08, 1 - gs * 0.02 - gn * 0.03, 1 - gs * 0.16 + gn * 0.1);
    const fxaa = this.settings.aa !== 'off';
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
    this.stats.drawCalls = this.chunks.stats.drawn + r.info.render.calls + this.shadows.stats.drawn;
  }

  /** Diagnóstico: luminância adaptada, visibilidade do sol e exposição final. */
  debugExposure(): { lum: number; sunVis: number; exposure: number } {
    const [lum, sunVis] = this.post.debugRead();
    const c = this.tonemapMat.uniforms.uExpCurve.value as THREE.Vector4;
    const auto = this.settings.autoExposure ? Math.min(c.w, Math.max(c.z, Math.pow(c.x / Math.max(lum, 1e-5), c.y))) : 1;
    return { lum, sunVis, exposure: auto * this.tonemapMat.uniforms.uExposure.value };
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
