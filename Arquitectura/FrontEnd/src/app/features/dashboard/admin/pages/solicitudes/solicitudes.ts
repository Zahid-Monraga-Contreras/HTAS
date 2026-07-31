import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';
import { Menu } from '../../template/menu/menu';

type ToastType = 'success' | 'error' | 'warning';
type TabType = 'pendientes' | 'aprobadas' | 'asignaciones';

@Component({
    selector: 'app-solicitudes',
    standalone: true,
    imports: [CommonModule, RouterModule, Menu],
    templateUrl: './solicitudes.html',
    styleUrls: ['./solicitudes.css']
})
export class Solicitudes implements OnInit, OnDestroy {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = false;
    activeTab: TabType = 'pendientes';
    adminId: number | null = null;

    solicitudesPendientes: any[] = [];
    solicitudesAprobadas: any[] = [];
    asignacionesActivas: any[] = [];

    mostrarToast = false;
    mensajeToast = '';
    tipoToast: ToastType = 'success';
    private toastTimeout: any = null;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        const storedUser = localStorage.getItem('user_htas');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            this.adminId = userData.idusuario || userData.uid || null;
        }

        this.cargarTodosLosDatos();
    }

    ngOnDestroy() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
    }

    cambiarTab(tab: TabType) {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.cdr.detectChanges();
    }

    async cargarTodosLosDatos() {
        this.isLoading = true;
        try {
            const todasLasSolicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(1)
            );

            if (Array.isArray(todasLasSolicitudes)) {
                this.solicitudesPendientes = todasLasSolicitudes.filter(s => s.estado === 'pendiente');
                this.solicitudesAprobadas = todasLasSolicitudes.filter(s => s.estado === 'aprobada');
                this.asignacionesActivas = todasLasSolicitudes.filter(s => s.estado === 'aprobada');
            }
        } catch (error) {
            this.lanzarNotificacion('No se pudieron cargar los datos', 'error');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    async aprobarSolicitud(idSolicitud: number) {
        if (!this.adminId) return;

        try {
            await firstValueFrom(
                this.usersService.aprobarSolicitud(idSolicitud, this.adminId)
            );

            this.lanzarNotificacion('Solicitud aprobada correctamente', 'success');

            const index = this.solicitudesPendientes.findIndex(s => s.idsolicitud === idSolicitud);
            if (index !== -1) {
                const solicitud = this.solicitudesPendientes[index];
                solicitud.estado = 'aprobada';
                this.solicitudesPendientes.splice(index, 1);
                this.solicitudesAprobadas.push(solicitud);
                this.asignacionesActivas.push(solicitud);
            }

            this.cdr.detectChanges();
        } catch (error) {
            this.lanzarNotificacion('No se pudo aprobar la solicitud', 'error');
        }
    }

    async rechazarSolicitud(idSolicitud: number) {
        if (!this.adminId) return;

        if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;

        try {
            await firstValueFrom(
                this.usersService.rechazarSolicitud(idSolicitud, this.adminId)
            );

            this.lanzarNotificacion('Solicitud rechazada', 'warning');

            const index = this.solicitudesPendientes.findIndex(s => s.idsolicitud === idSolicitud);
            if (index !== -1) {
                this.solicitudesPendientes.splice(index, 1);
            }

            this.cdr.detectChanges();
        } catch (error) {
            this.lanzarNotificacion('No se pudo rechazar la solicitud', 'error');
        }
    }

    verDetalleAcompanante(idAcompanante: number) {
        this.router.navigate(['/admin/acompanantes/editar', idAcompanante]);
    }

    verDetallePaciente(idPaciente: number) {
        this.router.navigate(['/admin/pacientes/editar', idPaciente]);
    }

    obtenerNombreCompleto(persona: any): string {
        if (!persona) return 'No disponible';
        const nombre = persona.nombre || '';
        const apPaterno = persona.appaterno || persona.apPaterno || '';
        const apMaterno = persona.apmaterno || persona.apMaterno || '';
        return `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'No disponible';
    }

    lanzarNotificacion(mensaje: string, tipo: ToastType = 'success') {
        this.mensajeToast = mensaje;
        this.tipoToast = tipo;
        this.mostrarToast = true;
        this.cdr.detectChanges();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.mostrarToast = false;
            this.cdr.detectChanges();
        }, 4000);
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return '';
        try {
            const d = new Date(fecha);
            return d.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return fecha;
        }
    }

    formatearFechaCorta(fecha: string): string {
        if (!fecha) return '';
        try {
            const d = new Date(fecha);
            return d.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return fecha;
        }
    }

    getEstadoClass(estado: string): string {
        switch (estado) {
            case 'pendiente': return 'estado-pendiente';
            case 'aprobada': return 'estado-aprobada';
            case 'rechazada': return 'estado-rechazada';
            default: return '';
        }
    }

    getEstadoTexto(estado: string): string {
        switch (estado) {
            case 'pendiente': return 'Pendiente';
            case 'aprobada': return 'Aprobada';
            case 'rechazada': return 'Rechazada';
            default: return estado;
        }
    }

    getEstadoIcon(estado: string): string {
        switch (estado) {
            case 'pendiente': return 'bi-clock';
            case 'aprobada': return 'bi-check-circle-fill';
            case 'rechazada': return 'bi-x-circle-fill';
            default: return '';
        }
    }

    getTabTitle(tab: TabType): string {
        switch (tab) {
            case 'pendientes': return 'Solicitudes Pendientes';
            case 'aprobadas': return 'Solicitudes Aprobadas';
            case 'asignaciones': return 'Asignaciones Activas';
            default: return '';
        }
    }

    getTabCount(tab: TabType): number {
        switch (tab) {
            case 'pendientes': return this.solicitudesPendientes.length;
            case 'aprobadas': return this.solicitudesAprobadas.length;
            case 'asignaciones': return this.asignacionesActivas.length;
            default: return 0;
        }
    }
}