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
    selector: 'app-doctor-dispositivos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        DoctorMenu
    ],
    templateUrl: './dispositivos.html',
    styleUrls: ['./dispositivos.css']
})
export class DoctorDispositivos implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    doctorName: string = '';
    doctorFullName: string = '';
    doctorId: number | null = null;

    dispositivos: any[] = [];
    dispositivosFiltrados: any[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0,
        sinAsignar: 0,
        pacientesConDispositivos: 0
    };

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    mostrarModalConfirmacion = false;
    dispositivoParaEliminar: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    mostrarModalDetalle = false;
    dispositivoSeleccionado: any = null;

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

    async cargarDatos() {
        this.isLoading = true;
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.doctorName = userData.nombre || 'Doctor';
                this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            await this.cargarDispositivos();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los dispositivos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarDispositivos() {
        try {
            const data = await firstValueFrom(this.usersService.getDispositivos());

            if (Array.isArray(data)) {
                this.dispositivos = data.map(d => ({
                    ...d,
                    iddispositivo: d.iddispositivo || d.IdDispositivo || d.id,
                    nombre: d.nombre || 'Dispositivo sin nombre',
                    direccionmac: d.direccionmac || d.direccionMac || 'No especificada',
                    idpacienteasociado: d.idpacienteasociado || d.idPacienteAsociado,
                    activo: d.activo !== false,
                    ultimasincronizacion: d.ultimasincronizacion || null,
                    nombrepaciente: this.obtenerNombrePaciente(d),
                    appaternopaciente: d.appaternopaciente || ''
                }));

                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
            } else {
                this.dispositivos = [];
            }
        } catch (error) {
            console.error('Error al cargar dispositivos:', error);
            this.dispositivos = [];
        }
    }

    private obtenerNombrePaciente(dispositivo: any): string {
        const nombre = dispositivo.nombrepaciente || dispositivo.nombrePaciente || '';
        const apPaterno = dispositivo.appaternopaciente || dispositivo.apPaternoPaciente || '';
        const apMaterno = dispositivo.apmaternopaciente || dispositivo.apMaternoPaciente || '';

        if (nombre || apPaterno || apMaterno) {
            return `${nombre} ${apPaterno} ${apMaterno}`.trim();
        }
        return 'Sin asignar';
    }

    private calcularEstadisticas() {
        this.estadisticas.total = this.dispositivos.length;
        this.estadisticas.activos = this.dispositivos.filter(d => d.activo === true).length;
        this.estadisticas.inactivos = this.dispositivos.filter(d => d.activo === false).length;
        this.estadisticas.sinAsignar = this.dispositivos.filter(d => !d.idpacienteasociado).length;

        const pacientesSet = new Set();
        this.dispositivos.forEach(d => {
            if (d.idpacienteasociado) {
                pacientesSet.add(d.idpacienteasociado);
            }
        });
        this.estadisticas.pacientesConDispositivos = pacientesSet.size;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        this.filtrarDispositivos();
    }

    buscarDispositivos() {
        this.filtrarDispositivos();
    }

    private filtrarDispositivos() {
        const term = this.searchTerm.toLowerCase().trim();

        this.dispositivosFiltrados = this.dispositivos.filter(d => {
            let matchEstado = true;
            if (this.filterEstado === 'activos') {
                matchEstado = d.activo === true;
            } else if (this.filterEstado === 'inactivos') {
                matchEstado = d.activo === false;
            } else if (this.filterEstado === 'sin-asignar') {
                matchEstado = !d.idpacienteasociado;
            }

            let matchSearch = true;
            if (term) {
                matchSearch =
                    (d.nombre || '').toLowerCase().includes(term) ||
                    (d.direccionmac || '').toLowerCase().includes(term) ||
                    (d.nombrepaciente || '').toLowerCase().includes(term);
            }

            return matchEstado && matchSearch;
        });
    }

    mostrarConfirmacionEliminar(dispositivo: any) {
        this.dispositivoParaEliminar = dispositivo;
        this.modalConfirmacion = {
            titulo: 'Eliminar Dispositivo',
            mensaje: 'Esta seguro de que desea eliminar este dispositivo? Esta accion no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        this.dispositivoParaEliminar = null;
        document.body.style.overflow = '';
    }

    async ejecutarEliminarDispositivo() {
        if (!this.dispositivoParaEliminar) {
            this.cerrarModalConfirmacion();
            return;
        }

        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const id = this.dispositivoParaEliminar.iddispositivo || this.dispositivoParaEliminar.id;

            await firstValueFrom(this.usersService.eliminarDispositivo(id));

            this.cerrarModalConfirmacion();
            this.showSuccess(
                'Dispositivo Eliminado',
                'El dispositivo ha sido eliminado exitosamente.'
            );

            setTimeout(async () => {
                await this.cargarDispositivos();
                this.cdr.detectChanges();
            }, 300);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al eliminar el dispositivo.';
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

    async toggleEstadoDispositivo(dispositivo: any) {
        try {
            const nuevoEstado = !dispositivo.activo;

            if (nuevoEstado) {
                await firstValueFrom(
                    this.usersService.activarDispositivo(dispositivo.iddispositivo)
                );
                this.showSuccess('Exito', 'Dispositivo activado correctamente');
            } else {
                await firstValueFrom(
                    this.usersService.desactivarDispositivo(dispositivo.iddispositivo)
                );
                this.showSuccess('Exito', 'Dispositivo desactivado correctamente');
            }

            await this.cargarDispositivos();

        } catch (error) {
            console.error('Error al cambiar estado:', error);
            this.showError('Error', 'Error al cambiar el estado del dispositivo');
        }
    }

    async sincronizarDispositivo(id: number) {
        try {
            await firstValueFrom(
                this.usersService.sincronizarDispositivo(id)
            );

            this.showSuccess('Exito', 'Dispositivo sincronizado correctamente');
            await this.cargarDispositivos();

        } catch (error) {
            console.error('Error al sincronizar dispositivo:', error);
            this.showError('Error', 'Error al sincronizar el dispositivo');
        }
    }

    verDetalle(dispositivo: any) {
        const id = dispositivo.iddispositivo || dispositivo.id;
        if (id) {
            this.router.navigate(['/doctor/dispositivos/detalle', id]);
        }
    }

    cerrarModalDetalle() {
        this.mostrarModalDetalle = false;
        this.dispositivoSeleccionado = null;
        document.body.style.overflow = '';
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'No sincronizado';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    getEstadoClass(activo: boolean): string {
        return activo ? 'estado-activo' : 'estado-inactivo';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    getEstadoIcon(activo: boolean): string {
        return activo ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
    }

    irANuevo() {
        this.router.navigate(['/doctor/dispositivos/nuevo']);
    }
}