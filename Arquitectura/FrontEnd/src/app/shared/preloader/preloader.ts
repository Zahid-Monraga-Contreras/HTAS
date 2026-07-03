import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-preloader',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './preloader.html',
    styleUrl: './preloader.css'
})
export class Preloader implements OnInit {
    isVisible = signal(true);
    isBrowser: boolean;

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    ngOnInit() {
        if (this.isBrowser) {
            // Ocultar preloader después de un tiempo prudencial
            setTimeout(() => {
                this.isVisible.set(false);
            }, 2500);
        }
    }
}
