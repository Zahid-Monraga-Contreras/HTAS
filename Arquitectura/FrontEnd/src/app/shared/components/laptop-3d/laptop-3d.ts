import {
    Component,
    ElementRef,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    PLATFORM_ID,
    Inject,
    ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

@Component({
    selector: 'app-laptop-3d',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './laptop-3d.html',
    styleUrl: './laptop-3d.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Laptop3dComponent implements AfterViewInit, OnDestroy {
    @ViewChild('laptopCanvas', { static: true })
    canvasRef!: ElementRef<HTMLCanvasElement>;

    @ViewChild('sceneContainer', { static: true })
    containerRef!: ElementRef<HTMLDivElement>;

    private readonly BRAND_RED = 0x8b0015;
    private readonly BODY_METAL = 0xd4d6da;
    private readonly DARK_PLASTIC = 0x16181a;

    private readonly SCREEN_GRAD_START = '#8B0015';
    private readonly SCREEN_GRAD_END = '#690014';
    private readonly SCREEN_WHITE = '#FFFFFF';

    private readonly baseWidth = 34;
    private readonly baseDepth = 22;
    private readonly baseThickness = 1.4;
    private readonly lidWidth = 34;
    private readonly lidHeight = 21;
    private readonly lidThickness = 1;
    private readonly screenWidth = 30.5;
    private readonly screenHeight = 18.5;

    private readonly OPEN_ANGLE = -0.1 * Math.PI;

    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private orbit!: OrbitControls;
    private lightHolder!: THREE.Group;

    private macGroup!: THREE.Group;
    private hingeGroup!: THREE.Group;
    private baseGroup!: THREE.Group;
    private lidPivot!: THREE.Group;
    private ledMaterial!: THREE.MeshStandardMaterial;
    private screenMaterial!: THREE.MeshBasicMaterial;
    private screenCanvas!: HTMLCanvasElement;
    private screenTexture!: THREE.CanvasTexture;

    private mainTl?: gsap.core.Timeline;
    private floatingTl?: gsap.core.Timeline;
    private laptopOpeningTl?: gsap.core.Timeline;
    private laptopAppearTl?: gsap.core.Timeline;

    private animationFrameId = 0;
    private resizeHandler = () => this.updateSceneSize();
    private intersectionObserver?: IntersectionObserver;
    private hasPlayedOnce = false;
    private isBrowser: boolean;

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    ngAfterViewInit(): void {
        if (!this.isBrowser) {
            return;
        }

        this.initScene();
        this.buildLaptop();
        this.createTimelines();
        this.observeVisibility();
        this.render();

        // Si las fuentes (Montserrat) aún no habían cargado al dibujar
        // el canvas del dashboard, esto lo vuelve a pintar cuando estén
        // listas — evita textos con tipografía de respaldo/mal alineados.
        if ('fonts' in document) {
            (document as any).fonts.ready.then(() => {
                if (!this.screenCanvas) return;
                this.redrawScreen();
            });
        }
    }

    ngOnDestroy(): void {
        if (!this.isBrowser) {
            return;
        }
        cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this.resizeHandler);
        this.intersectionObserver?.disconnect();
        this.mainTl?.kill();
        this.floatingTl?.kill();
        this.renderer?.dispose();
    }

    // =======================================================
    // Escena base

    private initScene(): void {
        this.scene = new THREE.Scene();

        const container = this.containerRef.nativeElement;
        this.camera = new THREE.PerspectiveCamera(
            42, // un poco más ancho que antes (38) para que nada quede fuera de cuadro
            container.clientWidth / container.clientHeight,
            1,
            1000
        );
        this.camera.position.set(0, 10, 62);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            canvas: this.canvasRef.nativeElement,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

        this.lightHolder = new THREE.Group();
        this.scene.add(this.lightHolder);
        const keyLight = new THREE.DirectionalLight(0xfff2e2, 1.1);
        keyLight.position.set(20, 30, 40);
        this.lightHolder.add(keyLight);
        const fillLight = new THREE.PointLight(0xffffff, 0.35);
        fillLight.position.set(-30, 10, 20);
        this.lightHolder.add(fillLight);

        this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbit.minDistance = 45;
        this.orbit.maxDistance = 100;
        this.orbit.enablePan = false;
        this.orbit.enableZoom = false;
        this.orbit.enableDamping = true;
        this.orbit.target.set(0, 8, -5);

        this.macGroup = new THREE.Group();
        this.macGroup.position.y = -8;
        this.scene.add(this.macGroup);

        this.updateSceneSize();
        window.addEventListener('resize', this.resizeHandler);
    }

    private updateSceneSize(): void {
        const container = this.containerRef.nativeElement;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    private render = (): void => {
        this.orbit.update();
        this.lightHolder.quaternion.copy(this.camera.quaternion);
        this.renderer.render(this.scene, this.camera);
        this.animationFrameId = requestAnimationFrame(this.render);
    };

    // =======================================================
    // Construcción geométrica de la laptop

    private buildLaptop(): void {
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.BODY_METAL,
            metalness: 0.65,
            roughness: 0.35,
        });
        const darkMaterial = new THREE.MeshStandardMaterial({
            color: this.DARK_PLASTIC,
            metalness: 0.2,
            roughness: 0.8,
        });

        this.baseGroup = new THREE.Group();
        this.macGroup.add(this.baseGroup);

        const base = new THREE.Mesh(
            new RoundedBoxGeometry(this.baseWidth, this.baseThickness, this.baseDepth, 3, 0.6),
            bodyMaterial
        );
        base.position.y = this.baseThickness / 2;
        this.baseGroup.add(base);

        const keyboardWell = new THREE.Mesh(
            new RoundedBoxGeometry(this.baseWidth - 4, 0.3, this.baseDepth - 4, 2, 0.4),
            darkMaterial
        );
        keyboardWell.position.set(0, this.baseThickness + 0.05, -0.5);
        this.baseGroup.add(keyboardWell);

        this.addKeyboard();

        const touchpad = new THREE.Mesh(
            new RoundedBoxGeometry(11, 0.15, 6.5, 2, 0.35),
            new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.3, roughness: 0.15 })
        );
        touchpad.position.set(0, this.baseThickness + 0.1, 5.2);
        this.baseGroup.add(touchpad);

        [
            [-this.baseWidth / 2 + 2, -this.baseDepth / 2 + 2],
            [this.baseWidth / 2 - 2, -this.baseDepth / 2 + 2],
            [-this.baseWidth / 2 + 2, this.baseDepth / 2 - 2],
            [this.baseWidth / 2 - 2, this.baseDepth / 2 - 2],
        ].forEach(([x, z]) => {
            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16), darkMaterial);
            foot.position.set(x, -0.1, z);
            this.baseGroup.add(foot);
        });

        const hinge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.9, 0.9, this.baseWidth - 6, 20),
            darkMaterial
        );
        hinge.rotation.z = Math.PI / 2;
        hinge.position.set(0, this.baseThickness + 0.3, -this.baseDepth / 2 + 0.3);
        this.baseGroup.add(hinge);

        this.hingeGroup = new THREE.Group();
        this.hingeGroup.position.set(0, this.baseThickness + 0.3, -this.baseDepth / 2 + 0.3);
        this.baseGroup.add(this.hingeGroup);

        this.buildLid(bodyMaterial, darkMaterial);
    }

    private addKeyboard(): void {
        const cols = 12;
        const rows = 5;
        const keySize = 1.55;
        const gap = 0.35;
        const keyGeometry = new RoundedBoxGeometry(keySize, 0.35, keySize, 1, 0.15);
        const keyMaterial = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.1, roughness: 0.7 });

        const totalKeys = cols * rows;
        const instanced = new THREE.InstancedMesh(keyGeometry, keyMaterial, totalKeys);

        const startX = -((cols - 1) * (keySize + gap)) / 2;
        const startZ = -3.6 - ((rows - 1) * (keySize + gap)) / 2;
        const dummy = new THREE.Object3D();
        let i = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                dummy.position.set(
                    startX + c * (keySize + gap),
                    this.baseThickness + 0.25,
                    startZ + r * (keySize + gap)
                );
                dummy.updateMatrix();
                instanced.setMatrixAt(i, dummy.matrix);
                i++;
            }
        }
        this.baseGroup.add(instanced);
    }

    private buildLid(bodyMaterial: THREE.Material, darkMaterial: THREE.Material): void {
        const lidPivot = new THREE.Group();
        this.hingeGroup.add(lidPivot);

        const lidBack = new THREE.Mesh(
            new RoundedBoxGeometry(this.lidWidth, this.lidHeight, this.lidThickness, 3, 0.6),
            bodyMaterial
        );
        lidBack.position.set(0, this.lidHeight / 2, -this.lidThickness / 2);
        lidPivot.add(lidBack);

        const logoTexture = this.createLogoTexture();
        const logoPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(9, 9),
            new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true })
        );
        logoPlane.position.set(0, this.lidHeight / 2, -this.lidThickness - 0.01);
        logoPlane.rotation.y = Math.PI;
        lidPivot.add(logoPlane);

        const bezel = new THREE.Mesh(
            new RoundedBoxGeometry(this.lidWidth - 0.6, this.lidHeight - 0.6, this.lidThickness, 3, 0.5),
            darkMaterial
        );
        bezel.position.set(0, this.lidHeight / 2, this.lidThickness / 2);
        lidPivot.add(bezel);

        const webcam = new THREE.Mesh(
            new THREE.CircleGeometry(0.18, 16),
            new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
        );
        webcam.position.set(0, this.lidHeight - 0.5, this.lidThickness / 2 + 0.01);
        lidPivot.add(webcam);

        // ---- Pantalla ----
        this.screenCanvas = this.createScreenCanvas();
        this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
        this.screenTexture.needsUpdate = true;

        // OJO: antes empezaba en opacity 0 y dependía de una animación
        // anidada para "encenderse". Si esa animación no corría bien,
        // se quedaba en negro para siempre. Ahora arranca ya visible;
        // solo el LED tiene su pequeño efecto de encendido.
        this.screenMaterial = new THREE.MeshBasicMaterial({
            map: this.screenTexture,
            transparent: true,
            opacity: 1,
        });
        const screenMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(this.screenWidth, this.screenHeight),
            this.screenMaterial
        );
        screenMesh.position.set(0, this.lidHeight / 2, this.lidThickness / 2 + 0.05);
        lidPivot.add(screenMesh);

        this.ledMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            emissive: 0x2ecc71,
            emissiveIntensity: 0,
        });
        const led = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), this.ledMaterial);
        led.position.set(this.baseWidth / 2 - 1.5, this.baseThickness + 0.01, this.baseDepth / 2 - 0.5);
        led.rotation.x = -Math.PI / 2;
        this.baseGroup.add(led);

        this.lidPivot = lidPivot;
    }

    // =======================================================
    // Dashboard dibujado con Canvas 2D (gradiente #8B0015 → #690014 + blanco)

    private redrawScreen(): void {
        const canvas = this.createScreenCanvas();
        this.screenCanvas = canvas;
        this.screenTexture.image = canvas;
        this.screenTexture.needsUpdate = true;
    }

    private createScreenCanvas(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 620;
        const ctx = canvas.getContext('2d')!;
        const W = canvas.width;

        ctx.fillStyle = '#f4f5f7';
        ctx.fillRect(0, 0, W, canvas.height);

        const headerH = 88;
        const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
        headerGrad.addColorStop(0, this.SCREEN_GRAD_START);
        headerGrad.addColorStop(1, this.SCREEN_GRAD_END);
        ctx.fillStyle = headerGrad;
        ctx.fillRect(0, 0, W, headerH);

        ctx.fillStyle = this.SCREEN_WHITE;
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 32px Montserrat, sans-serif';
        ctx.fillText('HTAS', 40, 44);
        ctx.font = '20px Montserrat, sans-serif';
        ctx.globalAlpha = 0.85;
        ctx.fillText('Panel de Monitoreo del Paciente', 150, 46);
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.fillStyle = '#2ecc71';
        ctx.arc(W - 150, 44, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.SCREEN_WHITE;
        ctx.font = '18px Montserrat, sans-serif';
        ctx.fillText('En vivo', W - 130, 46);

        this.drawStatCard(ctx, 40, 118, 300, 190, '120/80', 'mmHg', 'Presión Arterial', true);
        this.drawStatCard(ctx, 362, 118, 300, 190, '78', 'bpm', 'Frecuencia Cardiaca', false);
        this.drawStatCard(ctx, 684, 118, 300, 190, '97%', 'SpO2', 'Oxigenación', false);

        const ecgX = 40;
        const ecgY = 332;
        const ecgW = 944;
        const ecgH = 150;
        this.roundRect(ctx, ecgX, ecgY, ecgW, ecgH, 20);
        ctx.fillStyle = this.SCREEN_WHITE;
        ctx.fill();
        ctx.strokeStyle = 'rgba(139,0,21,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = this.SCREEN_GRAD_START;
        ctx.font = 'bold 18px Montserrat, sans-serif';
        ctx.fillText('RITMO CARDIACO (ECG)', ecgX + 26, ecgY + 34);

        ctx.save();
        ctx.translate(ecgX + 24, ecgY + 95);
        const ecgGrad = ctx.createLinearGradient(0, 0, ecgW - 48, 0);
        ecgGrad.addColorStop(0, this.SCREEN_GRAD_START);
        ecgGrad.addColorStop(1, this.SCREEN_GRAD_END);
        ctx.strokeStyle = ecgGrad;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        const pts: [number, number][] = [
            [0, 40], [70, 40], [95, 0], [120, 90], [145, -30],
            [170, 110], [195, 40], [260, 40], [330, 40], [355, 0],
            [380, 90], [405, -30], [430, 110], [455, 40], [520, 40],
            [590, 40], [615, 0], [640, 90], [665, -30], [690, 110],
            [715, 40], [780, 40], [850, 40], [875, 0], [900, 40],
        ];
        pts.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#999999';
        ctx.font = '18px Montserrat, sans-serif';
        ctx.fillText('Última actualización: hace 2 minutos', 40, 560);

        return canvas;
    }

    private drawStatCard(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        value: string,
        unit: string,
        label: string,
        highlighted: boolean
    ): void {
        this.roundRect(ctx, x, y, w, h, 22);
        ctx.fillStyle = this.SCREEN_WHITE;
        ctx.fill();
        ctx.strokeStyle = 'rgba(139,0,21,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        this.roundRect(ctx, x, y, w, 8, 4);
        const accentGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        accentGrad.addColorStop(0, this.SCREEN_GRAD_START);
        accentGrad.addColorStop(1, this.SCREEN_GRAD_END);
        ctx.fillStyle = accentGrad;
        ctx.fill();

        ctx.fillStyle = highlighted ? this.SCREEN_GRAD_START : '#8B0015';
        ctx.font = 'bold 17px Montserrat, sans-serif';
        ctx.fillText(label.toUpperCase(), x + 26, y + 46);

        ctx.fillStyle = '#222222';
        ctx.font = '800 52px Montserrat, sans-serif';
        ctx.fillText(value, x + 26, y + 105);

        ctx.fillStyle = '#888888';
        ctx.font = '20px Montserrat, sans-serif';
        ctx.fillText(unit, x + 26, y + 145);
    }

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    private createLogoTexture(): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '800 90px Montserrat, sans-serif';
        ctx.fillText('HTAS', 256, 256);
        return new THREE.CanvasTexture(canvas);
    }

    // =======================================================
    // Animación (GSAP)

    private createTimelines(): void {
        this.floatingTl = gsap
            .timeline({ repeat: -1 })
            .to(this.macGroup.position, { duration: 2, y: '+=0.8', ease: 'power1.inOut' })
            .to(this.macGroup.position, { duration: 2, y: '-=0.8', ease: 'power1.inOut' })
            .timeScale(0);

        // Antes: una animación anidada (screenOnTl) controlada por
        // progress. Ahora: tween directo sobre el material, dentro del
        // mismo timeline de apertura — más simple y sin puntos de falla.
        this.laptopOpeningTl = gsap
            .timeline({ paused: true })
            .fromTo(
                this.lidPivot.rotation,
                { x: 0.5 * Math.PI },
                { x: this.OPEN_ANGLE, duration: 1.2, ease: 'power2.out' },
                0
            )
            .to(this.ledMaterial, { duration: 0.4, emissiveIntensity: 1.2 }, 0.5);

        this.laptopAppearTl = gsap.timeline({ paused: true }).fromTo(
            this.macGroup.scale,
            { x: 0.001, y: 0.001, z: 0.001 },
            { x: 1, y: 1, z: 1, duration: 1.1, ease: 'back.out(1.4)' }
        );

        this.mainTl = gsap
            .timeline({ defaults: { ease: 'none' } })
            .to(this.laptopAppearTl, { duration: 1.1, progress: 1 }, 0)
            .to(this.laptopOpeningTl, { duration: 1.2, progress: 1 }, 0.4)
            .to(this.floatingTl, { duration: 0.5, timeScale: 1 }, 1.4);
    }

    private observeVisibility(): void {
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !this.hasPlayedOnce && this.mainTl) {
                        this.hasPlayedOnce = true;
                        this.mainTl.play(0);
                    }
                });
            },
            { threshold: 0.25 }
        );
        this.intersectionObserver.observe(this.containerRef.nativeElement);
    }
}