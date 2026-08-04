import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terminos-condiciones',
  imports: [CommonModule],
  templateUrl: './terminos-condiciones.html',
  styleUrl: './terminos-condiciones.css',
})
export class TerminosCondiciones implements OnInit, OnDestroy {

  readingProgress: number = 0;

  constructor(private router: Router) { }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  ngOnDestroy(): void { }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.readingProgress = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
  }

  volver(): void {
    this.router.navigate(['/landing']);
  }

  irAAviso(): void {
    this.router.navigate(['/legal/aviso-privacidad']);
  }

  scrollTo(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
