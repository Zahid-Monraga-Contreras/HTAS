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

    private readonly SCREEN_IMAGE_PATH = '/assets/logs/laptop3d_2.png';

    private readonly baseWidth = 34;
    private readonly baseDepth = 22;
    // ---- GROSOR REDUCIDO ----
    // Antes: 1.4 (base) / 1 (tapa) — se veía demasiado gruesa para
    // una laptop real. Ahora ambos valores son más delgados; el resto
    // de las posiciones ya estaban calculadas EN FUNCIÓN de estas
    // constantes, así que todo se reajusta proporcionalmente solo.
    private readonly baseThickness = 0.8;
    private readonly lidWidth = 34;
    private readonly lidHeight = 21;
    // Bajado de 0.45 a 0.2: seguía viéndose gruesa la franja negra
    // (bisel + pantalla) para ser una laptop real. 0.2 da un perfil
    // delgado tipo laptop moderna, manteniendo el mismo negro/gris.
    private readonly lidThickness = 0.3;
    private readonly screenWidth = 30.5;
    private readonly screenHeight = 18.5;

    private readonly OPEN_ANGLE = -0.1 * Math.PI;

    // ---- Encuadre responsive ----
    // BASE_* son el encuadre original (desktop), tal cual estaba antes de
    // tocar nada — se usan siempre que la pantalla NO sea mobile.
    // MOBILE_BREAKPOINT debe coincidir con el media query del CSS
    // (@media max-width: 768px) para que ambos ajustes (tamaño de
    // contenedor y encuadre de cámara) cambien en el mismo punto.
    private readonly BASE_FOV = 42;
    private readonly BASE_CAMERA_DISTANCE = 85;
    private readonly BASE_MAX_DISTANCE = 100;
    private readonly REFERENCE_ASPECT = 1.6;
    private readonly MOBILE_BREAKPOINT = 768;

    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private orbit!: OrbitControls;
    private lightHolder!: THREE.Group;

    private macGroup!: THREE.Group;
    private hingeGroup!: THREE.Group;
    private baseGroup!: THREE.Group;
    private lidPivot!: THREE.Group;
    // ---- Grupo para teclado + barra espaciadora + touchpad ----
    // El problema real: con la tapa cerrada, las teclas y el touchpad
    // ocupan casi la misma altura que la tapa, así que aunque la tapa
    // esté en el ángulo/posición correctos, se atraviesan visualmente
    // con ella (las teclas "se asoman" por el borde). En vez de intentar
    // afinar alturas/ángulos (frágil y depende de la geometría exacta),
    // se oculta todo este grupo mientras está cerrada y se muestra un
    // poco después de que la tapa empieza a abrirse.
    private keyboardGroup!: THREE.Group;
    private ledMaterial!: THREE.MeshStandardMaterial;
    private screenMaterial!: THREE.MeshBasicMaterial;
    private screenTexture!: THREE.Texture;

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
        this.screenTexture?.dispose();
        this.renderer?.dispose();
    }

    // =======================================================
    // Escena base

    private initScene(): void {
        this.scene = new THREE.Scene();

        const container = this.containerRef.nativeElement;
        this.camera = new THREE.PerspectiveCamera(
            42, // FOV
            container.clientWidth / container.clientHeight,
            1,
            1000
        );
        // Posición original — el intento de "reencuadrar" acercando la
        // cámara hizo que la laptop se viera más grande de lo deseado.
        // Se revierte a los valores de antes.
        this.camera.position.set(0, 4, 85);

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

        // ---- En celular/tablet, no capturar el gesto de un dedo ----
        // OrbitControls usa el drag de un dedo para rotar la cámara, y al
        // hacerlo bloquea el scroll normal de la página con ese mismo dedo.
        // En dispositivos de puntero "coarse" (touch) se desactiva el
        // rotate — la laptop se sigue animando sola (aparición + apertura
        // + flotación), solo no se puede arrastrar con el dedo. En mouse
        // (puntero "fine") se mantiene el comportamiento original.
        const isCoarsePointer =
            typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        this.orbit.enableRotate = !isCoarsePointer;
        this.renderer.domElement.style.touchAction = isCoarsePointer ? 'pan-y' : 'none';

        this.macGroup = new THREE.Group();
        this.macGroup.position.y = -5; // Centrado
        this.scene.add(this.macGroup);

        this.updateSceneSize();
        window.addEventListener('resize', this.resizeHandler);
    }

    private updateSceneSize(): void {
        const container = this.containerRef.nativeElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;

        // ---- CORREGIDO: el ajuste solo se activa en pantallas mobile ----
        // Antes decidíamos si achicar la cámara según el aspect ratio del
        // CONTENEDOR. El problema: si el contenedor en desktop no es tan
        // ancho como el de referencia (1.6) —muchos layouts no lo son—,
        // el mismo cálculo se disparaba también ahí, achicando el modelo
        // en pantallas grandes sin que fuera mobile.
        // Ahora se decide por el ANCHO REAL DE LA VENTANA
        // (window.innerWidth), igual que el media query del CSS: en
        // desktop/tablet grande (> MOBILE_BREAKPOINT) el encuadre es
        // SIEMPRE el original (BASE_FOV / BASE_CAMERA_DISTANCE), sin
        // importar el aspect del contenedor. Solo por debajo del
        // breakpoint se abre un poco el FOV y se aleja un poco la cámara
        // (con topes) para que la laptop no se corte en pantallas
        // angostas.
        const isMobileViewport = window.innerWidth <= this.MOBILE_BREAKPOINT;

        if (isMobileViewport) {
            const narrowness = Math.max(1, this.REFERENCE_ASPECT / aspect);

            const MAX_FOV = 58;
            this.camera.fov = Math.min(MAX_FOV, this.BASE_FOV * Math.sqrt(narrowness));

            const MAX_DISTANCE = 130;
            const targetDistance = Math.min(MAX_DISTANCE, this.BASE_CAMERA_DISTANCE * Math.sqrt(narrowness));
            this.camera.position.z = targetDistance;

            // OrbitControls recorta la distancia de la cámara a
            // [minDistance, maxDistance] en cada update(); si no subimos
            // maxDistance aquí, la próxima llamada a orbit.update()
            // deshace este ajuste.
            this.orbit.maxDistance = Math.max(this.BASE_MAX_DISTANCE, targetDistance + 10);
        } else {
            // Desktop / tablet grande: encuadre original, sin excepciones.
            this.camera.fov = this.BASE_FOV;
            this.camera.position.z = this.BASE_CAMERA_DISTANCE;
            this.orbit.maxDistance = this.BASE_MAX_DISTANCE;
        }

        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
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

        // Material del indicador de encendido (blanco, antes verde).
        // Se define aquí porque ahora vive dentro del botón de encendido
        // (ver addPorts()) y ya no como un LED suelto en el borde de la base.
        this.ledMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            emissive: 0xffffff,
            emissiveIntensity: 0,
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

        // ---- Grupo contenedor, oculto por defecto ----
        // Todo lo que "sobresale" del hueco del teclado (teclas, barra
        // espaciadora, touchpad) va dentro de este grupo. Arranca oculto
        // de forma directa e inmediata, así nunca depende de en qué frame
        // decida renderizar GSAP.
        this.keyboardGroup = new THREE.Group();
        this.keyboardGroup.visible = false;
        this.baseGroup.add(this.keyboardGroup);

        this.addKeyboard();
        this.addTouchpad();
        this.addPorts();

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

        // Bisagra: radio reducido de 0.9 a 0.5 para que combine con
        // el cuerpo ahora más delgado (antes se veía sobredimensionada).
        const hinge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, this.baseWidth - 6, 20),
            darkMaterial
        );
        hinge.rotation.z = Math.PI / 2;
        hinge.position.set(0, this.baseThickness + 0.22, -this.baseDepth / 2 + 0.3);
        this.baseGroup.add(hinge);

        this.hingeGroup = new THREE.Group();
        this.hingeGroup.position.set(0, this.baseThickness + 0.22, -this.baseDepth / 2 + 0.3);
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

        const startX = -((cols - 1) * (keySize + gap)) / 2;
        const startZ = -3.6 - ((rows - 1) * (keySize + gap)) / 2;

        // La barra espaciadora ocupa el hueco de las columnas centrales
        // de la última fila (la fila más cercana al usuario/touchpad).
        // Esas posiciones se excluyen de la cuadrícula normal de teclas
        // y en su lugar se coloca una sola tecla larga.
        const spacebarStartCol = 3;
        const spacebarEndCol = 8; // inclusive -> 6 columnas de ancho
        const lastRow = rows - 1;

        const dummy = new THREE.Object3D();
        const normalKeyPositions: THREE.Vector3[] = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isSpacebarSlot = r === lastRow && c >= spacebarStartCol && c <= spacebarEndCol;
                if (isSpacebarSlot) {
                    continue;
                }
                normalKeyPositions.push(
                    new THREE.Vector3(
                        startX + c * (keySize + gap),
                        this.baseThickness + 0.25,
                        startZ + r * (keySize + gap)
                    )
                );
            }
        }

        const instanced = new THREE.InstancedMesh(keyGeometry, keyMaterial, normalKeyPositions.length);
        normalKeyPositions.forEach((pos, i) => {
            dummy.position.copy(pos);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
        });
        this.keyboardGroup.add(instanced);

        // ---- Barra espaciadora ----
        // Una sola tecla ancha centrada, ocupando el espacio de las
        // columnas 3 a 8 en la última fila.
        const spacebarCols = spacebarEndCol - spacebarStartCol + 1;
        const spacebarWidth = spacebarCols * keySize + (spacebarCols - 1) * gap;
        const spacebarGeometry = new RoundedBoxGeometry(spacebarWidth, 0.35, keySize, 1, 0.15);
        const spacebar = new THREE.Mesh(spacebarGeometry, keyMaterial);

        const spacebarCenterCol = (spacebarStartCol + spacebarEndCol) / 2;
        spacebar.position.set(
            startX + spacebarCenterCol * (keySize + gap),
            this.baseThickness + 0.25,
            startZ + lastRow * (keySize + gap)
        );
        this.keyboardGroup.add(spacebar);
    }

    private addTouchpad(): void {
        // El marco (11.5 ancho x 6.2 profundo) queda completamente
        // contenido dentro del área oscura del teclado (keyboardWell).
        const trackpadFrame = new THREE.Mesh(
            new RoundedBoxGeometry(11.5, 0.14, 6.2, 3, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x0d0f11, metalness: 0.15, roughness: 0.85 })
        );
        trackpadFrame.position.set(0, this.baseThickness + 0.08, 5.2);
        this.keyboardGroup.add(trackpadFrame);

        const touchpad = new THREE.Mesh(
            new RoundedBoxGeometry(10, 0.18, 5.4, 3, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x3d4147, metalness: 0.35, roughness: 0.1 })
        );
        touchpad.position.set(0, this.baseThickness + 0.15, 5.2);
        this.keyboardGroup.add(touchpad);
    }

    // =======================================================
    // Puertos (huecos) en los laterales de la base:
    // cargador, 2x USB, audífonos y HDMI. Se representan como
    // pequeñas formas oscuras "hundidas" justo en la superficie
    // de los lados izquierdo y derecho de la carcasa.

    private addPorts(): void {
        const portMaterial = new THREE.MeshStandardMaterial({
            color: 0x030303,
            metalness: 0.1,
            roughness: 0.9,
        });

        const portY = this.baseThickness / 2;
        const leftX = -this.baseWidth / 2 - 0.01;
        const rightX = this.baseWidth / 2 + 0.01;

        // ---- Lado izquierdo: BOTÓN DE ENCENDIDO + 2 puertos USB ----
        // Botón de encendido blanco. Tamaño reducido de nuevo
        // (antes 0.3/0.22/0.08 de radio, ahora 0.18/0.13/0.05).
        const powerButtonMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.05,
            roughness: 0.4,
        });

        const powerButtonRing = new THREE.Mesh(
            new THREE.CircleGeometry(0.18, 24),
            powerButtonMaterial
        );
        powerButtonRing.rotation.y = -Math.PI / 2;
        powerButtonRing.position.set(leftX, portY, -7.5);
        this.baseGroup.add(powerButtonRing);

        const powerButtonFace = new THREE.Mesh(
            new THREE.CircleGeometry(0.13, 24),
            powerButtonMaterial
        );
        powerButtonFace.rotation.y = -Math.PI / 2;
        powerButtonFace.position.set(leftX + 0.005, portY, -7.5);
        this.baseGroup.add(powerButtonFace);

        const powerButtonIndicator = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 16),
            this.ledMaterial
        );
        powerButtonIndicator.rotation.y = -Math.PI / 2;
        powerButtonIndicator.position.set(leftX + 0.01, portY, -7.5);
        this.baseGroup.add(powerButtonIndicator);

        const usbGeometry = new THREE.PlaneGeometry(1.0, 0.4);
        const usb1 = new THREE.Mesh(usbGeometry, portMaterial);
        usb1.rotation.y = -Math.PI / 2;
        usb1.position.set(leftX, portY, -4.5);
        this.baseGroup.add(usb1);

        const usb2 = new THREE.Mesh(usbGeometry, portMaterial);
        usb2.rotation.y = -Math.PI / 2;
        usb2.position.set(leftX, portY, -2);
        this.baseGroup.add(usb2);

        // ---- Lado derecho: audífonos + HDMI ----
        const headphoneJack = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), portMaterial);
        headphoneJack.rotation.y = Math.PI / 2;
        headphoneJack.position.set(rightX, portY, -6.5);
        this.baseGroup.add(headphoneJack);

        const hdmiPort = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.35), portMaterial);
        hdmiPort.rotation.y = Math.PI / 2;
        hdmiPort.position.set(rightX, portY, -3);
        this.baseGroup.add(hdmiPort);
    }

    private buildLid(bodyMaterial: THREE.Material, darkMaterial: THREE.Material): void {
        const lidPivot = new THREE.Group();
        // FIX: antes esta rotación "cerrada" solo se aplicaba dentro del
        // fromTo() de GSAP (más abajo, en createTimelines()). Al estar
        // anidada dentro de otra timeline controlada por progreso, GSAP
        // no garantizaba aplicarla en el primer frame — por eso se veía
        // el teclado descubierto antes de que la animación arrancara.
        // Ahora se fija de forma directa e inmediata: la tapa SIEMPRE
        // arranca cerrada, sin depender de cuándo GSAP decida renderizar.
        lidPivot.rotation.x = 0.5 * Math.PI;
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

        // ---- Cámara web: AHORA VISIBLE ----
        // Antes: un anillo (0x2a2d31) casi idéntico en tono al bisel
        // (0x16181a) — se perdía por falta de contraste. Ahora el
        // anillo es más claro y metálico, más grande, y se agrega un
        // pequeño "glint" (brillo de lente) para venderla como una
        // cámara real en vez de un punto plano.
        const webcamRing = new THREE.Mesh(
            new THREE.CircleGeometry(0.38, 24),
            new THREE.MeshStandardMaterial({ color: 0x5a5f66, metalness: 0.6, roughness: 0.3 })
        );
        webcamRing.position.set(0, this.lidHeight - 0.5, this.lidThickness / 2 + 0.005);
        lidPivot.add(webcamRing);

        const webcam = new THREE.Mesh(
            new THREE.CircleGeometry(0.2, 20),
            new THREE.MeshStandardMaterial({ color: 0x020202, metalness: 0.2, roughness: 0.5 })
        );
        webcam.position.set(0, this.lidHeight - 0.5, this.lidThickness / 2 + 0.01);
        lidPivot.add(webcam);

        const webcamGlint = new THREE.Mesh(
            new THREE.CircleGeometry(0.05, 12),
            new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.85 })
        );
        webcamGlint.position.set(-0.07, this.lidHeight - 0.43, this.lidThickness / 2 + 0.015);
        lidPivot.add(webcamGlint);

        // ---- Pantalla ----
        // Antes: se dibujaba el dashboard a mano con Canvas 2D.
        // Ahora: se carga la imagen real del dashboard (laptop3d_2.png)
        // como textura. Arranca con un material "placeholder" oscuro
        // para que no haya parpadeo mientras carga la imagen.
        this.screenMaterial = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 1,
        });

        const screenMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(this.screenWidth, this.screenHeight),
            this.screenMaterial
        );
        // La pantalla estaba "enterrada" dentro del marco (bezel).
        // El bezel llega hasta z = this.lidThickness, así que la pantalla va un poco más adelante.
        screenMesh.position.set(0, this.lidHeight / 2, this.lidThickness + 0.01);
        lidPivot.add(screenMesh);

        this.loadScreenTexture();

        this.lidPivot = lidPivot;
    }

    // =======================================================
    // Carga de la imagen del dashboard (reemplaza el dibujo con Canvas 2D)

    private loadScreenTexture(): void {
        const loader = new THREE.TextureLoader();
        loader.load(
            this.SCREEN_IMAGE_PATH,
            (texture) => {
                // Color correcto (evita que se vea "lavado" o muy oscuro)
                texture.colorSpace = THREE.SRGBColorSpace;

                // FIX nitidez: antes usábamos LinearFilter como minFilter,
                // lo cual desactiva mipmaps y produce aliasing/borrosidad
                // al minificar la textura (la imagen es más grande que el
                // espacio que ocupa en pantalla). Con mipmaps + filtro
                // trilinear el texto de la captura se ve nítido.
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                texture.needsUpdate = true;

                this.screenTexture = texture;
                this.screenMaterial.map = texture;
                this.screenMaterial.color.set(0xffffff);
                this.screenMaterial.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error('No se pudo cargar la imagen de la pantalla:', this.SCREEN_IMAGE_PATH, error);
            }
        );
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

        this.laptopOpeningTl = gsap
            .timeline({ paused: true })
            .to(
                this.lidPivot.rotation,
                { x: this.OPEN_ANGLE, duration: 1.2, ease: 'power2.out' },
                0
            )
            // ---- Revelar el teclado un poco DESPUÉS del inicio ----
            // Si el teclado se hace visible en el instante 0 de la apertura,
            // con power2.out la tapa arranca lenta y en esos primeros frames
            // casi no se ha movido — el teclado se asoma por debajo de una
            // tapa todavía casi cerrada. Con este delay (~30% del giro) la
            // tapa ya se levantó lo suficiente antes de mostrar el teclado.
            // Si aún se alcanza a ver un parpadeo, sube este valor (p. ej. 0.5).
            .set(this.keyboardGroup, { visible: true }, 0.35)
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