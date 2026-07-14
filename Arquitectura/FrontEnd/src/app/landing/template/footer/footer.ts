import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { RouterLink, Router } from "@angular/router";
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  scrollToFragment(fragment: string): void {
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
}
