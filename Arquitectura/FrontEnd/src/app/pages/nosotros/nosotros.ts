import { Component, AfterViewInit, ElementRef, QueryList, ViewChildren, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css',
})
export class Nosotros implements AfterViewInit {
  // Referencias para las secciones y las cards
  @ViewChildren('animateUp') elementsToAnimate!: QueryList<ElementRef>;
  @ViewChildren('infoCard') infoCards!: QueryList<ElementRef>;

  private observer?: IntersectionObserver;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

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

          this.observer?.unobserve(target);
        }
      });
    }, options);

    this.elementsToAnimate.forEach(el => {
      el.nativeElement.setAttribute('data-animate', 'up');
      this.observer?.observe(el.nativeElement);
    });

    this.infoCards.forEach(el => {
      el.nativeElement.setAttribute('data-animate', '3d');
      this.observer?.observe(el.nativeElement);
    });
  }
}