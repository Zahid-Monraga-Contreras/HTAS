import { Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild, AfterViewInit, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';

@Component({
  selector: 'app-electric-waves',
  standalone: true,
  imports: [CommonModule],
  template: `<div #container class="waves-container"></div>`,
  styles: [`
    .waves-container {
      width: 100%;
      height: 100%;
      background-color: #f2f2f2;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ElectricWavesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef;
  
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private geometry?: THREE.PlaneGeometry;
  private material?: THREE.ShaderMaterial;
  private mesh?: THREE.Mesh;
  private animationFrameId?: number;
  private resizeHandler?: () => void;

  // Shader parameters
  private waveCount = 3.0;
  private amplitude = 0.1;
  private frequency = 2.0;
  private brightness = 0.003;
  private colorSeparation = 0.15;

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private ngZone: NgZone) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initThree();
    }
  }

  private isVisible = false;
  private visibilityObserver?: IntersectionObserver;

  private initThree(): void {
    const container = this.containerRef.nativeElement;

    // Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: false, // Turn off antialias for better performance on shaders
        powerPreference: 'high-performance',
        alpha: false
      });
      // Cap pixel ratio to 1.0 to improve performance on high-DPI screens
      this.renderer.setPixelRatio(1.0);
      container.appendChild(this.renderer.domElement);
    } catch (err) {
      console.error('WebGL not supported', err);
      container.innerHTML = '<p style="color:#8B0015;text-align:center;">WebGL no disponible.</p>';
      return;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision mediump float;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_waveCount;
      uniform float u_amplitude;
      uniform float u_frequency;
      uniform float u_brightness;
      uniform float u_colorSeparation;

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
        
        vec3 color = vec3(0.0);
        float time = u_time * 0.5;
        
        // Optimización: Reducimos el número de iteraciones si es posible
        for (float i = 0.0; i < 4.0; i++) { 
          if (i >= u_waveCount) break;
          
          vec2 p = uv;
          float offset = i * u_colorSeparation;
          
          p.y += sin(time * (1.1 + i) + p.x * u_frequency) * u_amplitude;
          float wave = u_brightness / abs(p.y);
          
          int channel = int(mod(i, 3.0));
          if (channel == 0) color.r += wave;
          else if (channel == 1) color.g += wave;
          else color.b += wave;
        }
        
        float intensity = (color.r + color.g + color.b) * 0.333;
        vec3 bgColor = vec3(0.949, 0.949, 0.949); // #F2F2F2
        vec3 lineColor = vec3(0.545, 0.0, 0.082); // #8B0015
        
        float t = smoothstep(0.01, 0.15, intensity);
        vec3 finalCol = mix(bgColor, lineColor, t);
        
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `;

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_waveCount: { value: this.waveCount },
      u_amplitude: { value: this.amplitude },
      u_frequency: { value: this.frequency },
      u_brightness: { value: this.brightness },
      u_colorSeparation: { value: this.colorSeparation }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader
    });

    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    this.resizeHandler = this.onResize.bind(this);
    if (this.resizeHandler) {
      this.onResize();
      window.addEventListener('resize', this.resizeHandler);
    }

    // IntersectionObserver to pause when off-screen
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      const wasVisible = this.isVisible;
      this.isVisible = entry.isIntersecting;
      
      // If it became visible and loop was stopped, restart it
      if (this.isVisible && !wasVisible && !this.animationFrameId) {
        this.ngZone.runOutsideAngular(() => {
          this.animate();
        });
      }
    }, { threshold: 0.1 });
    this.visibilityObserver.observe(container);

    // Run the animation loop outside of Angular
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  private onResize = () => {
    if (!this.renderer || !this.containerRef) return;
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.renderer.setSize(width, height, false);
    if (this.material) {
      this.material.uniforms['u_resolution'].value.set(width, height);
    }
  }

  private animate = () => {
    // Only render and request next frame if visible
    if (!this.isVisible) {
      this.animationFrameId = undefined;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
    
    if (this.renderer && this.scene && this.camera && this.material) {
      this.material.uniforms['u_time'].value = this.clock.getElapsedTime();
      this.renderer.render(this.scene, this.camera);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }
      if (this.visibilityObserver) {
        this.visibilityObserver.disconnect();
      }
      
      this.geometry?.dispose();
      this.material?.dispose();
      this.renderer?.dispose();
    }
  }
}
