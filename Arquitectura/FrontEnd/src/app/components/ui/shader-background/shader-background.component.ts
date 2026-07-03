import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit, Inject, PLATFORM_ID, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-shader-background',
  standalone: true,
  imports: [],
  templateUrl: './shader-background.component.html',
  styleUrls: ['./shader-background.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShaderBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private isVisible: boolean = false;
  private visibilityObserver: IntersectionObserver | null = null;

  // Cached locations
  private resolutionLoc: WebGLUniformLocation | null = null;
  private timeLoc: WebGLUniformLocation | null = null;
  private vertexPositionLoc: number = -1;

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private ngZone: NgZone) {}

  // ... (shaders kept unchanged)
  // Vertex shader source code
  private vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
      gl_Position = aVertexPosition;
    }
  `;

  // Fragment shader source code
  private fsSource = `
    precision highp float;
    uniform float iTime;
    uniform vec2 iResolution;

    #define NUM_OCTAVES 3

    float rand(vec2 n) {
      return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u*u*(3.0-2.0*u);

      float res = mix(
        mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
        mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
      return res * res;
    }

    float fbm(vec2 x) {
      float v = 0.0;
      float a = 0.3;
      vec2 shift = vec2(100);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(x);
        x = rot * x * 2.0 + shift;
        a *= 0.4;
      }
      return v;
    }

    // Fallback for tanh which is not in WebGL 1.0
    vec4 myTanh(vec4 x) {
      vec4 e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    void main() {
      vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
      vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
      vec2 v;
      vec4 o = vec4(0.0);

      float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

      for (float i = 0.0; i < 16.0; i++) {
        v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
        float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 16.0));
        
        // Brand color #8B0015 (R: 0.545, G: 0.0, B: 0.082)
        vec4 auroraColors = vec4(0.545, 0.0, 0.082, 1.0);
        
        // Subtle variation
        auroraColors.r += 0.1 * sin(i * 0.2 + iTime * 0.4);
        auroraColors.b += 0.05 * cos(i * 0.3 + iTime * 0.5);

        vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
        float thinnessFactor = smoothstep(0.0, 1.0, i / 16.0) * 0.6;
        o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
      }

      o = myTanh(pow(o / 100.0, vec4(1.6)));
      
      // Brand background #F2F2F2 (R: 0.949, G: 0.949, B: 0.949)
      vec4 bgColor = vec4(0.949, 0.949, 0.949, 1.0);
      
      gl_FragColor = mix(bgColor, o * 1.5, clamp(length(o.rgb), 0.0, 1.0));
    }
  `;

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const canvas = this.canvasRef.nativeElement;
      this.gl = canvas.getContext('webgl');
      if (!this.gl) {
        console.warn('WebGL not supported.');
        return;
      }

      this.program = this.initShaderProgram(this.gl, this.vsSource, this.fsSource);
      if (!this.program) return;

      this.initBuffers(this.gl);
      this.cacheLocations();
      this.startTime = Date.now();
      this.setupResizeListener();
      this.initVisibilityObserver();
    }
  }

  private initVisibilityObserver(): void {
    const canvas = this.canvasRef.nativeElement;
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      const wasVisible = this.isVisible;
      this.isVisible = entry.isIntersecting;
      
      if (this.isVisible && !wasVisible && !this.animationFrameId) {
        this.ngZone.runOutsideAngular(() => {
          this.render();
        });
      }
    }, { threshold: 0.1 });
    
    this.visibilityObserver.observe(canvas);
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.visibilityObserver) {
        this.visibilityObserver.disconnect();
      }
      window.removeEventListener('resize', this.resizeCanvas.bind(this));
    }
  }

  private initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
    const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    if (!vertexShader || !fragmentShader) return null;

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) return null;

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error('Shader program link error: ', gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }

  private loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error: ', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private initBuffers(gl: WebGLRenderingContext): void {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const gl = this.gl;
    if (!gl) return;

    // Use current element size for resolution
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  private cacheLocations(): void {
    if (!this.gl || !this.program) return;
    this.resolutionLoc = this.gl.getUniformLocation(this.program, 'iResolution');
    this.timeLoc = this.gl.getUniformLocation(this.program, 'iTime');
    this.vertexPositionLoc = this.gl.getAttribLocation(this.program, 'aVertexPosition');
  }

  private render(): void {
    if (!this.gl || !this.program || !this.isVisible) {
      this.animationFrameId = null;
      return;
    }

    const gl = this.gl;
    const currentTime = (Date.now() - this.startTime) / 1000;

    gl.clearColor(0.949, 0.949, 0.949, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    if (this.resolutionLoc) {
      gl.uniform2f(this.resolutionLoc, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    }
    if (this.timeLoc) {
      gl.uniform1f(this.timeLoc, currentTime);
    }

    if (this.vertexPositionLoc !== -1) {
      gl.enableVertexAttribArray(this.vertexPositionLoc);
      gl.vertexAttribPointer(this.vertexPositionLoc, 2, gl.FLOAT, false, 0, 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }
}
