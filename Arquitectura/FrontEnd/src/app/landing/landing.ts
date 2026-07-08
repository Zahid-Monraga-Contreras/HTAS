import { Component, HostListener, AfterViewInit, ElementRef, QueryList, ViewChildren, Inject, PLATFORM_ID, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Headermenu } from "../template/headermenu/headermenu";
import { Footer } from "../template/footer/footer";
import { Pagos } from "../pages/pagos/pagos";
import { Contacto } from "../pages/contacto/contacto";
import { Nosotros } from "../pages/nosotros/nosotros";
import { Recursos } from "../pages/recursos/recursos";
import { ElectricWavesComponent } from '../shared/components/electric-waves/electric-waves.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, Headermenu, Footer, Pagos, Contacto, Nosotros, Recursos, ElectricWavesComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Landing implements AfterViewInit {
  @ViewChildren('animateUp') elementsToAnimate!: QueryList<ElementRef>;
  @ViewChildren('infoCard') infoCards!: QueryList<ElementRef>;

  activeGalleryTab = 1;
  activeFeatureIndex = 0;

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private cdr: ChangeDetectorRef) { }

  private observer?: IntersectionObserver;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initScrollAnimations();
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /**
   * Animación Reversible (Subir/Bajar) con IntersectionObserver
   * Los elementos se animan solo cuando entran en el viewport.
   */
  private initScrollAnimations() {
    if (!this.elementsToAnimate && !this.infoCards) return;

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;

          // Animación para elementos normales
          if (target.getAttribute('animate-type') === 'up') {
            target.animate([
              { opacity: 0, transform: 'translateY(40px)' },
              { opacity: 1, transform: 'translateY(0)' }
            ], {
              duration: 800,
              easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              fill: 'both'
            });
          }
          // Animación para cards 3D
          else if (target.getAttribute('animate-type') === '3d') {
            target.animate([
              { transform: 'perspective(1000px) rotateX(30deg) scale(0.9)', opacity: 0 },
              { transform: 'perspective(1000px) rotateX(0deg) scale(1)', opacity: 1 }
            ], {
              duration: 900,
              easing: 'ease-out',
              fill: 'both'
            });
          }

          // Dejar de observar una vez animado
          this.observer?.unobserve(target);
        }
      });
    }, options);

    // Observar elementos normales
    this.elementsToAnimate?.forEach((el) => {
      el.nativeElement.setAttribute('animate-type', 'up');
      this.observer?.observe(el.nativeElement);
    });

    // Observar cards 3D
    this.infoCards?.forEach((card) => {
      card.nativeElement.setAttribute('animate-type', '3d');
      this.observer?.observe(card.nativeElement);
    });
  }

  // --- Lógica de Galería ---
  setActiveGalleryTab(tab: number) {
    this.activeGalleryTab = tab;
    this.cdr.markForCheck();
  }

  get sliderTransform() {
    const desplazamiento = (this.activeGalleryTab - 1) * 33.333;
    return `translateX(-${desplazamiento}%)`;
  }

  modalData = [
    {
      title: 'Tu Salud en tus Manos',
      description: 'Nuestra app permite un seguimiento exhaustivo de tus signos vitales sin complicaciones.',
      additionalTitle: 'Beneficios de Autocontrol',
      additionalText: 'El monitoreo constante reduce el riesgo de crisis hipertensivas en un 40%.',
      features: ['Gráficas de tendencia semanal', 'Alertas de valores críticos', 'Exportación de datos a Excel']
    },
    {
      title: 'Gestión Inteligente',
      description: 'Utilizamos algoritmos para analizar la relación entre tu actividad física y tu presión.',
      additionalTitle: 'Ecosistema Conectado',
      additionalText: 'Sincronización automática entre tu pulsera y la plataforma en la nube.',
      features: ['Sincronización vía Bluetooth BLE', 'Bajo consumo de batería', 'Respaldo automático en la nube']
    },
    {
      title: 'Control Tensional',
      description: 'Mantenemos un registro histórico de todas tus mediciones sistólicas y diastólicas.',
      additionalTitle: 'Precisión Médica',
      additionalText: 'Validado bajo estándares internacionales de salud cardiovascular.',
      features: ['Registro de frecuencia cardíaca', 'Detección de arritmias básicas', 'Historial clínico digitalizado']
    },
    {
      title: 'Vivir con Tranquilidad',
      description: 'Siéntete seguro sabiendo que tu familia puede recibir alertas en caso de emergencia.',
      additionalTitle: 'Seguridad y Familia',
      additionalText: 'Un sistema de notificaciones diseñado para actuar rápido cuando más se necesita.',
      features: ['Notificaciones a contactos de emergencia', 'Botón de pánico integrado', 'Localización GPS en emergencias']
    }
  ];

  // --- Lógica del Showcase Interactivo ---
  activeScreenIndex = 0;

  appScreens = [
    {
      id: 0,
      title: 'Monitoreo en Tiempo Real',
      features: [
        { title: 'Presión Arterial', desc: 'Control preciso de sístole y diástole.', position: 'top-left', icon: 'bi-heart-pulse-fill' },
        { title: 'Nivel de Riesgo', desc: 'Interpretación instantánea de tus valores.', position: 'bottom-right', icon: 'bi-exclamation-triangle-fill' }
      ]
    },
    {
      id: 1,
      title: 'Gestión de Tratamiento',
      features: [
        { title: 'Adherencia Diaria', desc: 'Progreso real de tu tratamiento médico.', position: 'top-right', icon: 'bi-calendar-check-fill' },
        { title: 'Alertas Inteligentes', desc: 'Recordatorios para toma de medicación.', position: 'bottom-left', icon: 'bi-bell-fill' }
      ]
    },
    {
      id: 2,
      title: 'Perfil y Configuración',
      features: [
        { title: 'Historial Clínico', desc: 'Más de 150 mediciones almacenadas.', position: 'top-left', icon: 'bi-file-earmark-medical-fill' },
        { title: 'Umbral de Alerta', desc: 'Personalización de límites de seguridad.', position: 'bottom-right', icon: 'bi-gear-wide-connected' }
      ]
    }
  ];

  setActiveFeature(index: number) {
    this.activeFeatureIndex = index;
    this.cdr.markForCheck();
  }

  setScreenIndex(index: number) {
    this.activeScreenIndex = index;
    this.cdr.markForCheck();
  }

  get screenTransform() {
    return `translateY(-${this.activeScreenIndex * 100}%)`;
  }

  /**
   * Método para hacer scroll suave a una sección específica
   * @param sectionId El ID del elemento al que queremos ir
   */
  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  }
}