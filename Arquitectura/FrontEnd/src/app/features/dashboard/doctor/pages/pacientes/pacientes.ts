import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; // ✅ Agregar Router
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';

@Component({
    selector: 'app-doctor-pacientes',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        DoctorMenu
    ],
    templateUrl: './pacientes.html',
    styleUrls: ['./pacientes.css']
})
export class DoctorPacientes implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router); // ✅ Inyectar Router
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    searchTerm = '';
    pacientes: any[] = [];
    filteredPacientes: any[] = [];

    // Filtros
    filterGenero: string = '';
    filterEstado: string = '';

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarPacientes();
    }

    async cargarPacientes() {
        this.isLoading = true;
        try {
            const allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());

            if (Array.isArray(allUsers)) {
                // Filtrar solo pacientes
                this.pacientes = allUsers.filter(u =>
                    u.rol?.toLowerCase() === 'paciente'
                );
                this.filteredPacientes = [...this.pacientes];
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    buscarPacientes() {
        const term = this.searchTerm.toLowerCase().trim();

        this.filteredPacientes = this.pacientes.filter(p => {
            // Búsqueda por texto
            const matchText = !term ||
                p.nombre?.toLowerCase().includes(term) ||
                p.apPaterno?.toLowerCase().includes(term) ||
                p.apMaterno?.toLowerCase().includes(term) ||
                p.correo?.toLowerCase().includes(term) ||
                p.nss?.toLowerCase().includes(term);

            // Filtro por género
            const matchGenero = !this.filterGenero ||
                p.genero?.toLowerCase() === this.filterGenero.toLowerCase();

            // Filtro por estado
            const matchEstado = !this.filterEstado ||
                (this.filterEstado === 'activo' && p.activo === true) ||
                (this.filterEstado === 'inactivo' && p.activo === false);

            return matchText && matchGenero && matchEstado;
        });
    }

    limpiarFiltros() {
        this.searchTerm = '';
        this.filterGenero = '';
        this.filterEstado = '';
        this.filteredPacientes = [...this.pacientes];
    }

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = `${nombre || ''} ${apPaterno || ''}`.trim();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
    }

    getEstadoClass(activo: boolean): string {
        return activo ? 'badge-success' : 'badge-danger';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    verDetalle(paciente: any) {
        // ✅ Navegar al detalle del paciente
        this.router.navigate(['/doctor/pacientes/detalle', paciente.idusuario]);
    }
}