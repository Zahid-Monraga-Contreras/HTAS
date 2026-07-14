import { Component, ElementRef, ViewChild, ViewChildren, QueryList, AfterViewInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import * as THREE from 'three';

@Component({
  selector: 'app-recursos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recursos.html',
  styleUrl: './recursos.css',
})
export class Recursos implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  @ViewChildren('animateUp') elementsToAnimate!: QueryList<ElementRef>;
  @ViewChildren('infoCard') infoCards!: QueryList<ElementRef>;

  slides = [
    {
      num: '01',
      title: 'Monitoreo <br>Wearable',
      description: 'Dispositivo biomédico de pulso diseñado para la captura de constantes hemodinámicas. Utiliza sensores PPG de alta resolución.'
    },
    {
      num: '02',
      title: 'Ecosistema <br>Móvil',
      description: 'Interfaz de gestión para el paciente que centraliza el registro de presiones. Actúa como el puente de comunicación mediante Bluetooth BLE.'
    },
    {
      num: '03',
      title: 'Plataforma <br>Web',
      description: 'Panel web de alta fidelidad diseñado para especialistas en cardiología. Integra herramientas de Big Data.'
    }
  ];

  currentSlideIndex = 0;
  isBrowser: boolean;

  // Tarjetas informativas expandibles
  expandedCardIndex: number | null = null;
  infoCardsContent = [
    {
      title: 'Dispositivo Wearable',
      image: 'assets/baumanometro.png',
      shortDesc: 'Sensor de grado clínico diseñado para la captura continua de presión arterial sistólica y diastólica.',
      extraInfo: 'Nuestra pulsera utiliza tecnología avanzada de fotopletismografía (PPG) y algoritmos patentados para ofrecer una precisión comparable a los tensiómetros de brazo tradicionales, pero con la comodidad de un uso continuo las 24 horas del día. Es resistente al agua y tiene una autonomía de hasta 7 días.'
    },
    {
      title: 'Gestión Personal',
      image: 'assets/celhtas4.png',
      shortDesc: 'Centro de control del paciente donde se visualizan tendencias diarias y se gestiona el tratamiento.',
      extraInfo: 'La aplicación móvil HTAS permite llevar un diario digital completo. Registra automáticamente las tomas de la pulsera, permite añadir recordatorios de medicación, y genera reportes detallados en PDF para compartir con tu médico. Además, incluye consejos personalizados basados en tus niveles actuales.'
    },
    {
      title: 'Portal Especialista',
      image: 'assets/laptophtas2.png',
      shortDesc: 'Plataforma de telemonitorización para médicos que utiliza analítica avanzada para predecir crisis.',
      extraInfo: 'El dashboard para profesionales permite monitorear a cientos de pacientes simultáneamente. El sistema prioriza automáticamente aquellos casos que presentan anomalías o tendencias de riesgo, permitiendo una intervención proactiva antes de que ocurra una crisis hipertensiva.'
    }
  ];

  toggleCard(index: number) {
    if (this.expandedCardIndex === index) {
      this.expandedCardIndex = null;
    } else {
      this.expandedCardIndex = index;
    }
  }

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private galleryGroup = new THREE.Group();
  private paintingGroups: THREE.Group[] = [];
  private currentScroll = 0;
  private targetScroll = 0;
  private snapTimer: any;
  private mouse = { x: 0, y: 0 };
  private animationId: number | null = null;
  private isVisible: boolean = false;
  private visibilityObserver: IntersectionObserver | null = null;

  // Propiedades para Dotted Surface
  private dottedGeometry!: THREE.BufferGeometry;
  private dottedMaterial!: THREE.PointsMaterial;
  private dots!: THREE.Points;
  private dotWaveCount = 0;
  private readonly DOT_CONFIG = {
    SEPARATION: 4,
    AMOUNTX: 80,
    AMOUNTY: 80,
    COLOR: 0x8B0015,
    BG_COLOR: 0xF2F2F2
  };

  private readonly CONFIG = {
    slideCount: 3,
    spacingX: 45,
    pWidth: 16,
    pHeight: 20,
    camZ: 35,
    wallAngleY: -0.25,
    snapDelay: 400,
    lerpSpeed: 0.04, // Velocidad suave solicitada
    fadeRange: 15
  };

  private totalWidth = 3 * 45;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      setTimeout(() => {
        this.initThree();
        this.initVisibilityObserver();
        this.onResize();
      }, 100);
    }
  }

  private initVisibilityObserver() {
    if (!this.canvasContainer) return;
    this.visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const target = entry.target as HTMLElement;

        // Handle Three.js canvas visibility
        if (target === this.canvasContainer.nativeElement) {
          const wasVisible = this.isVisible;
          this.isVisible = entry.isIntersecting;

          if (this.isVisible && !wasVisible && !this.animationId) {
            this.animate();
          }
        }
        // Handle DOM elements visibility
        else if (entry.isIntersecting) {
          this.runSingleAnimation(target);
          this.visibilityObserver?.unobserve(target);
        }
      });
    }, { threshold: 0.1 });

    // Observe canvas
    this.visibilityObserver.observe(this.canvasContainer.nativeElement);

    // Observe scroll elements
    this.elementsToAnimate?.forEach(el => {
      el.nativeElement.setAttribute('data-animate', 'up');
      this.visibilityObserver?.observe(el.nativeElement);
    });

    this.infoCards?.forEach(el => {
      el.nativeElement.setAttribute('data-animate', '3d');
      this.visibilityObserver?.observe(el.nativeElement);
    });
  }

  private runSingleAnimation(target: HTMLElement) {
    const type = target.getAttribute('data-animate');

    if (type === 'up') {
      target.animate([
        { opacity: 0, transform: 'translateY(60px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 800,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'both'
      });
    } else if (type === '3d') {
      target.animate([
        { transform: 'perspective(1000px) rotateX(25deg) scale(0.9)', opacity: 0 },
        { transform: 'perspective(1000px) rotateX(0deg) scale(1)', opacity: 1 }
      ], {
        duration: 900,
        easing: 'ease-out',
        fill: 'both'
      });
    }
  }

  /* --- LÓGICA THREE.JS (SIN CUADROS) --- */

  /* --- LÓGICA THREE.JS (SIN CUADROS) --- */
  private initThree() {
    if (!this.canvasContainer) return;
    this.scene = new THREE.Scene();

    // Reiniciar scroll para evitar desbalance al recargar
    this.currentScroll = 0;
    this.targetScroll = 0;
    this.currentSlideIndex = 0;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, this.CONFIG.camZ);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Opcionalmente podemos poner el color de fondo en la escena
    this.scene.background = new THREE.Color(this.DOT_CONFIG.BG_COLOR);

    this.canvasContainer.nativeElement.innerHTML = '';
    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    this.scene.add(this.galleryGroup);

    this.initDottedSurface();

    const textureLoader = new THREE.TextureLoader();
    const planeGeo = new THREE.PlaneGeometry(this.CONFIG.pWidth, this.CONFIG.pHeight);

    const images = ['assets/baumanometrohtas.jpg', 'assets/celhtas2.jpeg', 'assets/laptophtas.jpg'];

    for (let i = 0; i < this.CONFIG.slideCount; i++) {
      const group = new THREE.Group();
      group.position.set(i * this.CONFIG.spacingX, 0, 0);

      const texture = textureLoader.load(images[i]);
      texture.colorSpace = THREE.SRGBColorSpace;

      // Solo la imagen con transparencia
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(planeGeo, mat);

      // Sombra opcional (la mantengo ligera para dar profundidad)
      const shadowGeo = new THREE.PlaneGeometry(this.CONFIG.pWidth, this.CONFIG.pHeight);
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 });
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.position.set(1, -1, -0.2);

      group.add(mesh, shadow); // Ya no agregamos el 'frame'
      this.galleryGroup.add(group);
      this.paintingGroups.push(group);
    }

    this.galleryGroup.rotation.y = this.CONFIG.wallAngleY;
    this.galleryGroup.position.x = 8;
  }

  private initDottedSurface() {
    const { AMOUNTX, AMOUNTY, SEPARATION, COLOR } = this.DOT_CONFIG;
    const positions = new Float32Array(AMOUNTX * AMOUNTY * 3);

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
        const index = (ix * AMOUNTY + iy) * 3;
        positions[index] = x;
        positions[index + 1] = 0;
        positions[index + 2] = z;
      }
    }

    this.dottedGeometry = new THREE.BufferGeometry();
    this.dottedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.dottedMaterial = new THREE.PointsMaterial({
      color: COLOR,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    });

    this.dots = new THREE.Points(this.dottedGeometry, this.dottedMaterial);
    // Ajustamos la posición de la superficie para que esté de fondo y bien distribuida
    this.dots.position.y = -12;
    this.dots.position.z = -10;
    this.dots.rotation.x = Math.PI * 0.02;
    this.scene.add(this.dots);
  }

  private animate = () => {
    if (!this.isVisible) {
      this.animationId = null;
      return;
    }
    this.animationId = requestAnimationFrame(this.animate);
    this.currentScroll += (this.targetScroll - this.currentScroll) * this.CONFIG.lerpSpeed;

    const xMove = this.currentScroll * Math.cos(this.CONFIG.wallAngleY);
    const zMove = this.currentScroll * Math.sin(this.CONFIG.wallAngleY);

    this.camera.position.x = xMove;
    this.camera.position.z = this.CONFIG.camZ - zMove;

    this.paintingGroups.forEach((group, i) => {
      const originalX = i * this.CONFIG.spacingX;
      const distFromCam = this.currentScroll - originalX;
      const shift = Math.round(distFromCam / this.totalWidth) * this.totalWidth;
      const finalX = originalX + shift;
      group.position.x = finalX;

      // Opacidad según distancia
      const distance = Math.abs(this.currentScroll - finalX);
      let opacity = 1 - (distance / this.CONFIG.fadeRange);
      opacity = Math.max(0, Math.min(1, opacity));

      group.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const material = mesh.material as THREE.MeshBasicMaterial;
          // Si es el hijo 0 (la imagen) usa opacity full, si es el 1 (sombra) usa 0.1
          material.opacity = (child === group.children[1]) ? opacity * 0.1 : opacity;
          child.visible = opacity > 0.001;
        }
      });
    });

    this.camera.rotation.x = this.mouse.y * 0.05;
    this.camera.rotation.y = -this.mouse.x * 0.05;

    // Animación de Dotted Surface con looping infinito
    if (this.dots) {
      const { SEPARATION, AMOUNTX, AMOUNTY } = this.DOT_CONFIG;

      // Hacer que la malla de puntos siga a la cámara en pasos de rejilla
      const stepX = Math.round(xMove / SEPARATION);
      const stepZ = Math.round(-zMove / SEPARATION);

      this.dots.position.x = stepX * SEPARATION;
      this.dots.position.z = -10 + stepZ * SEPARATION;

      const positions = this.dottedGeometry.attributes['position'].array as Float32Array;

      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const index = (ix * AMOUNTY + iy) * 3;
          // Ajustamos ix e iy según el paso para que la onda sea continua
          const worldIx = ix + stepX;
          const worldIy = iy + stepZ;

          positions[index + 1] = (Math.sin((worldIx + this.dotWaveCount) * 0.3) * 2 +
            Math.sin((worldIy + this.dotWaveCount) * 0.5) * 2);
        }
      }
      this.dottedGeometry.attributes['position'].needsUpdate = true;
      this.dotWaveCount += 0.1;
    }

    const rawIndex = Math.round(this.currentScroll / this.CONFIG.spacingX);
    this.currentSlideIndex = ((rawIndex % this.CONFIG.slideCount) + this.CONFIG.slideCount) % this.CONFIG.slideCount;

    this.renderer.render(this.scene, this.camera);
  }

  /* --- EVENTOS --- */
  goToSlide(index: number) {
    if (!this.isBrowser) return;
    const diff = index - this.currentSlideIndex;
    this.targetScroll += diff * this.CONFIG.spacingX;
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent) {
    if (!this.isBrowser) return;

    // Solo actuamos si el scroll es sobre la galería
    // Evitamos preventDefault para permitir scroll de página si se desea, 
    // pero capturamos la intención de navegación de la galería.
    this.targetScroll += e.deltaY * 0.05;

    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => this.snapToNearest(), this.CONFIG.snapDelay);
  }

  @HostListener('window:wheel', ['$event'])
  onWindowWheel(e: WheelEvent) {
    // Si queremos que el scroll de la ventana NO mueva la galería, 
    // removemos el listener global o filtramos.
    // Para mejor UX, quitamos el movimiento de galería si el scroll es fuera del componente.
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.isBrowser) return;
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  private snapToNearest() {
    const index = Math.round(this.targetScroll / this.CONFIG.spacingX);
    this.targetScroll = index * this.CONFIG.spacingX;
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.isBrowser || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  ngOnDestroy() {
    if (this.isBrowser) {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.visibilityObserver) this.visibilityObserver.disconnect();
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
      }
    }
  }
}