import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, ViewportScroller } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-headermenu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './headermenu.html',
  styleUrl: './headermenu.css',
})
export class Headermenu implements OnInit {
  activeSection = 'inicio';
  isMenuOpen = false;
  scrollPercentage = 0;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private viewportScroller: ViewportScroller
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  scrollToFragment(fragment: string): void {
    this.closeMenu();
    this.activeSection = fragment;
    if (this.router.url.startsWith('/landing')) {
      if (fragment === 'inicio') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const element = document.getElementById(fragment);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else {
      this.router.navigate(['/landing'], { fragment: fragment });
    }
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.onWindowScroll();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (this.isBrowser) {
      const scrollOffset = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      this.scrollPercentage = windowHeight > 0 ? (scrollOffset / windowHeight) * 100 : 0;

      // Scroll Spy Logic
      if (this.router.url.startsWith('/landing')) {
        const sections = ['nosotros', 'recursos', 'pagos', 'contacto'];
        let currentSection = 'inicio';

        for (const sectionId of sections) {
          const element = document.getElementById(sectionId);
          if (element) {
            const offset = element.offsetTop - 150; // Threshold for active state
            if (scrollOffset >= offset) {
              currentSection = sectionId;
            }
          }
        }
        this.activeSection = currentSection;
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (this.isBrowser) {
      if (window.innerWidth > 768) {
        this.isMenuOpen = false;
      }
    }
  }
}