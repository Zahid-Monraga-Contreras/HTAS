import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-tratamientos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        DoctorMenu
    ],
    templateUrl: './tratamientos.html',
    styleUrls: ['./tratamientos.css']
})
export class DoctorTratamientos implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    tratamientos: any[] = [];
    tratamientosFiltrados: any[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0,
        vencidos: 0
    };

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    mostrarModalConfirmacion = false;
    tratamientoParaEliminar: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
    }

    private showToast(type: ToastNotification['type'], title: string, message: string, duration: number = 5000) {
        const id = ++this.notificationCounter;
        const notification: ToastNotification = {
            id,
            type,
            title,
            message,
            duration
        };

        this.notifications.unshift(notification);
        this.cdr.detectChanges();

        setTimeout(() => {
            this.removeToast(id);
        }, duration);
    }

    removeToast(id: number) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.cdr.detectChanges();
    }

    showSuccess(title: string, message: string, duration: number = 5000) {
        this.showToast('success', title, message, duration);
    }

    showError(title: string, message: string, duration: number = 7000) {
        this.showToast('error', title, message, duration);
    }

    showWarning(title: string, message: string, duration: number = 5000) {
        this.showToast('warning', title, message, duration);
    }

    showInfo(title: string, message: string, duration: number = 4000) {
        this.showToast('info', title, message, duration);
    }

    mostrarConfirmacionEliminar(tratamiento: any) {
        this.tratamientoParaEliminar = tratamiento;
        this.modalConfirmacion = {
            titulo: 'Eliminar Tratamiento',
            mensaje: 'Estas seguro de que deseas eliminar este tratamiento? Esta accion no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        this.tratamientoParaEliminar = null;
        document.body.style.overflow = '';
    }

    async ejecutarEliminarTratamiento() {
        if (!this.tratamientoParaEliminar) {
            this.cerrarModalConfirmacion();
            return;
        }

        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const id = this.tratamientoParaEliminar.idtratamiento || this.tratamientoParaEliminar.id;

            await firstValueFrom(this.usersService.eliminarTratamiento(id));

            this.cerrarModalConfirmacion();
            this.showSuccess(
                'Tratamiento Eliminado',
                'El tratamiento ha sido eliminado exitosamente.'
            );

            setTimeout(async () => {
                await this.cargarDatos();
                this.cdr.detectChanges();
            }, 300);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al eliminar el tratamiento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Eliminar', mensajeError);
            this.cerrarModalConfirmacion();
        } finally {
            this.cargandoEliminar = false;
            this.cdr.detectChanges();
        }
    }

    async cargarDatos() {
        this.isLoading = true;
        try {
            await this.cargarTratamientos();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los tratamientos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarTratamientos() {
        try {
            const data = await firstValueFrom(this.usersService.getTratamientos());

            if (Array.isArray(data)) {
                this.tratamientos = data.map(t => ({
                    ...t,
                    nombreMedicamento: t.nombremedicamento || t.NombreMedicamento || 'Medicamento',
                    fechaInicio: t.fechainicio || t.FechaInicio,
                    fechaFin: t.fechafin || t.FechaFin
                }));

                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
            } else {
                this.tratamientos = [];
            }
        } catch (error) {
            console.error('Error al cargar tratamientos:', error);
            this.tratamientos = [];
        }
    }

    private calcularEstadisticas() {
        this.estadisticas.total = this.tratamientos.length;
        this.estadisticas.activos = this.tratamientos.filter(t => t.activo !== false && t.activo !== 0).length;
        this.estadisticas.inactivos = this.tratamientos.filter(t => t.activo === false || t.activo === 0).length;

        const hoy = new Date();
        this.estadisticas.vencidos = this.tratamientos.filter(t => {
            const fechaFin = new Date(t.fechaFin || t.fechafin);
            return fechaFin < hoy && t.activo !== false && t.activo !== 0;
        }).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        this.filtrarTratamientos();
    }

    buscarTratamientos() {
        this.filtrarTratamientos();
    }

    private filtrarTratamientos() {
        const term = this.searchTerm.toLowerCase().trim();

        this.tratamientosFiltrados = this.tratamientos.filter(t => {
            let matchEstado = true;
            if (this.filterEstado === 'activos') {
                matchEstado = t.activo !== false && t.activo !== 0;
            } else if (this.filterEstado === 'inactivos') {
                matchEstado = t.activo === false || t.activo === 0;
            } else if (this.filterEstado === 'vencidos') {
                const hoy = new Date();
                const fechaFin = new Date(t.fechaFin || t.fechafin);
                matchEstado = fechaFin < hoy && t.activo !== false && t.activo !== 0;
            }

            let matchSearch = true;
            if (term) {
                matchSearch =
                    (t.nombreMedicamento || '').toLowerCase().includes(term) ||
                    (t.nombrePaciente || '').toLowerCase().includes(term) ||
                    (t.dosis || '').toLowerCase().includes(term);
            }

            return matchEstado && matchSearch;
        });
    }

    getEstadoClass(activo: boolean): string {
        return activo ? 'badge-success' : 'badge-danger';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            return d.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return fecha;
        }
    }

    esTratamientoVencido(fechaFin: string): boolean {
        if (!fechaFin) return false;
        try {
            const hoy = new Date();
            const fin = new Date(fechaFin);
            return fin < hoy;
        } catch {
            return false;
        }
    }

    verDetalle(tratamiento: any) {
        const id = tratamiento.idtratamiento || tratamiento.id;
        if (id) {
            this.router.navigate(['/doctor/tratamientos/detalle', id]);
        }
    }

    irANuevo() {
        this.router.navigate(['/doctor/tratamientos/nuevo']);
    }
}