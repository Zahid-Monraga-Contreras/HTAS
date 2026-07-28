import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-patient-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class PatientMenu {
  isMenuOpen = false;

  menuItems = [
    { path: '/patient/inicio', icon: 'bi-house-door', label: 'Inicio' },
    { path: '/patient/citas', icon: 'bi-calendar-check', label: 'Mis Citas' },
    { path: '/patient/tratamientos', icon: 'bi-heart-pulse', label: 'Tratamientos' },
    { path: '/patient/medicamentos', icon: 'bi-capsule', label: 'Medicamentos' },
    { path: '/patient/dispositivos', icon: 'bi-device-hdd', label: 'Dispositivos' },
    { path: '/patient/perfil', icon: 'bi-person', label: 'Perfil' },
    { path: '/patient/notificaciones', icon: 'bi-bell', label: 'Notificaciones' },
    { path: '/patient/configuracion', icon: 'bi-gear', label: 'Configuración' }
  ];

  constructor(
    private auth: Auth,
    private router: Router
  ) { }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  cerrarMenu(): void {
    this.isMenuOpen = false;
  }

  async logout(): Promise<void> {
    try {
      await this.auth.signOut();
      localStorage.removeItem('token');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}