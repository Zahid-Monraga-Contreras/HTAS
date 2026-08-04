import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-aviso-privacidad',
  imports: [CommonModule],
  templateUrl: './aviso-privacidad.html',
  styleUrl: './aviso-privacidad.css',
})
export class AvisoPrivacidad implements OnInit, OnDestroy {

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

  irATerminos(): void {
    this.router.navigate(['/legal/terminos-condiciones']);
  }

  scrollTo(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
