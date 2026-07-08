import { Component, AfterViewInit, ViewChildren, QueryList, ElementRef, Inject, PLATFORM_ID, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ShaderBackgroundComponent } from '../../shared/components/shader-background/shader-background.component';
import { HttpClient, HttpClientModule } from '@angular/common/http'; // Importa HttpClientModule
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, ShaderBackgroundComponent, HttpClientModule, FormsModule],
  templateUrl: './contacto.html',
  styleUrl: './contacto.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Contacto implements AfterViewInit {
  @ViewChildren('animateUp') elementsToAnimate!: QueryList<ElementRef>;
  private observer?: IntersectionObserver;

  datosContacto = {
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    mensaje: ''
  };
  enviando = false;

  modal = {
    visible: false,
    titulo: '',
    mensaje: '',
    tipo: 'success' // puede ser 'success' o 'error'
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initIntersectionObserver();
    }
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private initIntersectionObserver() {
    if (!this.elementsToAnimate) return;

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          this.runSingleAnimation(target);
          this.observer?.unobserve(target);
        }
      });
    }, options);

    this.elementsToAnimate.forEach(el => {
      this.observer?.observe(el.nativeElement);
    });
  }

  enviarContacto(event: Event) {
    event.preventDefault();
    this.enviando = true;

    this.http.post('http://localhost:3000/api/auth/contacto', this.datosContacto).subscribe({
      next: () => {
        this.mostrarModal(
          '¡Envío Exitoso!',
          'Tu mensaje ha sido enviado correctamente a nuestro equipo de soporte.',
          'success'
        );
        this.resetForm();
        this.enviando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al enviar:', err);
        this.mostrarModal(
          'Error de Envío',
          'No pudimos procesar tu mensaje. Por favor, verifica tu conexión o intenta más tarde.',
          'error'
        );
        this.enviando = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Funciones para el Modal
  mostrarModal(titulo: string, mensaje: string, tipo: 'success' | 'error') {
    this.modal.titulo = titulo;
    this.modal.mensaje = mensaje;
    this.modal.tipo = tipo;
    this.modal.visible = true;
    this.cdr.markForCheck();
  }

  cerrarModal() {
    this.modal.visible = false;
    this.cdr.markForCheck();
  }

  private resetForm() {
    this.datosContacto = {
      nombre: '',
      apellidos: '',
      email: '',
      telefono: '',
      mensaje: ''
    };
  }

  private runSingleAnimation(el: HTMLElement) {
    if (el.dataset['animated'] === 'true') return;
    el.dataset['animated'] = 'true';

    el.animate([
      { opacity: 0, transform: 'translateY(60px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 800,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'both'
    });
  }
}
