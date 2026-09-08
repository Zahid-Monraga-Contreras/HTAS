import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-caregiver-menu',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
    templateUrl: './menu.html',
    styleUrls: ['./menu.css']
})
export class CaregiverMenu {
    isMenuOpen = false;
    searchActive = false;
    searchTerm = '';

    menuItems = [
        { path: '/dashboard/caregiver/inicio', icon: 'bi-house-door', label: 'Inicio' },
        { path: '/dashboard/caregiver/pacientes', icon: 'bi-people', label: 'Pacientes' },
        { path: '/dashboard/caregiver/citas', icon: 'bi-calendar-check', label: 'Citas' },
        { path: '/dashboard/caregiver/tratamientos', icon: 'bi-heart-pulse', label: 'Tratamientos' },
        { path: '/dashboard/caregiver/medicamentos', icon: 'bi-capsule', label: 'Medicamentos' },
        { path: '/dashboard/caregiver/dispositivos', icon: 'bi-device-hdd', label: 'Dispositivos' },
        { path: '/dashboard/caregiver/perfil', icon: 'bi-person', label: 'Perfil' }
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

    toggleSearch(): void {
        this.searchActive = !this.searchActive;
        if (!this.searchActive) {
            this.searchTerm = '';
        }
    }

    closeSearch(): void {
        if (!this.searchTerm) {
            this.searchActive = false;
        }
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