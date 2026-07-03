import { Directive, ElementRef, HostBinding, OnInit, OnDestroy } from '@angular/core';

@Directive({
    selector: '[appScrollReveal]',
    standalone: true
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
    @HostBinding('class.revealed') isRevealed = false;

    private observer: IntersectionObserver | null = null;

    constructor(private el: ElementRef) { }

    ngOnInit() {
        if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.isRevealed = true;
                        this.observer?.unobserve(this.el.nativeElement);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px' // Slightly before it enters for smoother effect
            });

            this.observer.observe(this.el.nativeElement);
        } else {
            // Fallback for environments without IntersectionObserver
            this.isRevealed = true;
        }
    }

    ngOnDestroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}
