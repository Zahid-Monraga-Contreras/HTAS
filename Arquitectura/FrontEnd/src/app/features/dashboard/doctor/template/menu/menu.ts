import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../core/services/users.service';

@Component({
    selector: 'app-doctor-menu',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
    templateUrl: './menu.html',
    styleUrls: ['./menu.css']
})
export class DoctorMenu {
    isMenuOpen = false;
    searchActive = false;
    searchTerm = '';
    nombreCompleto: string = '';

    menuItems = [
        { path: '/doctor/inicio', icon: 'bi-house-door', label: 'Inicio' },
        { path: '/doctor/pacientes', icon: 'bi-people', label: 'Pacientes' },
        { path: '/doctor/citas', icon: 'bi-calendar-check', label: 'Citas' },
        { path: '/doctor/tratamientos', icon: 'bi-heart-pulse', label: 'Tratamientos' },
        { path: '/doctor/medicamentos', icon: 'bi-capsule', label: 'Medicamentos' },
        { path: '/doctor/dispositivos', icon: 'bi-device-hdd', label: 'Dispositivos' },
        { path: '/doctor/perfil', icon: 'bi-person', label: 'Perfil' }
    ];

    constructor(
        private router: Router,
        private usersService: Users
    ) {
        this.usersService.currentUser$.subscribe(user => {
            if (user) {
                this.nombreCompleto = user.nombreCompleto || user.nombre || 'Doctor';
            }
        });
    }

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
            this.usersService.limpiarSesion();
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
}