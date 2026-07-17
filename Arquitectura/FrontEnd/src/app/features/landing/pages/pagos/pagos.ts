import { Component, AfterViewInit, ViewChildren, QueryList, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StripeService } from '../../../../core/services/stripe.service';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagos.html',
  styleUrl: './pagos.css',
})
export class Pagos implements AfterViewInit {
  @ViewChildren('animateUp') elementsToAnimate!: QueryList<ElementRef>;

  loadingBasic = false;
  loadingPro = false;

  private observer?: IntersectionObserver;

  constructor(@Inject(PLATFORM_ID) private platformId: Object,
    private stripeService: StripeService) { }

  async empezarGratis() {
    if (this.loadingBasic || this.loadingPro) return;

    this.loadingBasic = true;
    try {
      // Generamos el ID de invitado igual que en el plan Full
      const guestId = 'guest_' + Date.now();

      console.log('Iniciando proceso de Plan Básico para invitado:', guestId);

      // Llamamos al mismo servicio pero con el plan 'BASIC'
      await this.stripeService.redirectToCheckout('BASIC', guestId);
    } finally {
      // In case redirect fails or is slow
      this.loadingBasic = false;
    }
  }

  // Función para el Plan HTAS Full (Stripe)
  async contratarPlanFull() {
    if (this.loadingBasic || this.loadingPro) return;

    this.loadingPro = true;
    try {
      // Generamos un ID temporal para que el backend no reciba un valor vacío
      // Usamos un timestamp para que sea único: "invitado_171145..."
      const guestId = 'guest_' + Date.now();

      console.log('Iniciando pago como invitado:', guestId);

      // Llamamos al servicio pasando este ID temporal
      await this.stripeService.redirectToCheckout('PRO', guestId);
    } finally {
      // In case redirect fails or is slow
      this.loadingPro = false;
    }
  }

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

  private runSingleAnimation(el: HTMLElement) {
    if (el.dataset['animated'] === 'true') return;
    el.dataset['animated'] = 'true';

    const anim = el.animate([
      { opacity: 0, transform: 'translateY(40px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    });

    anim.onfinish = () => {
      el.style.opacity = '1';
      if (el.classList.contains('feature-label-box')) {
        el.style.transform = '';
      }
    };
  }
}
