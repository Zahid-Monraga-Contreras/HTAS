import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-cita-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, DoctorMenu],
    templateUrl: './cita-detalle.html',
    styleUrls: ['./cita-detalle.css']
})
export class DoctorCitaDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    citaId: number | null = null;
    cita: any = null;
    loadingAction = false;
    cargandoCancelar = false;

    // Notificaciones toast
    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    // Modal de confirmacion para cancelar
    mostrarModalConfirmacionCancelar = false;
    citaParaCancelar: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.route.params.subscribe(params => {
            this.citaId = +params['id'];
            if (this.citaId) {
                this.cargarCita(this.citaId);
            }
        });
    }

    // ==========================================
    // SISTEMA DE NOTIFICACIONES TOAST
    // ==========================================
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

    // ==========================================
    // MODAL DE CONFIRMACION PARA CANCELAR
    // ==========================================
    mostrarConfirmacionCancelar(cita: any) {
        const estado = (cita.estado || '').toLowerCase();
        if (estado === 'cancelada') {
            this.showWarning('Cita ya cancelada', 'Esta cita ya ha sido cancelada anteriormente.');
            return;
        }
        if (estado === 'completada' || estado === 'realizada' || estado === 'finalizada') {
            this.showWarning('No se puede cancelar', 'No se puede cancelar una cita que ya ha sido completada.');
            return;
        }

        this.citaParaCancelar = cita;
        this.modalConfirmacion = {
            titulo: 'Cancelar Cita',
            mensaje: 'Estas seguro de que deseas cancelar esta cita? Esta accion no se puede deshacer.',
            accion: 'cancelar'
        };
        this.mostrarModalConfirmacionCancelar = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalConfirmacionCancelar() {
        this.mostrarModalConfirmacionCancelar = false;
        this.citaParaCancelar = null;
        document.body.style.overflow = '';
    }

    async ejecutarCancelarCita() {
        if (!this.citaParaCancelar) {
            this.cerrarModalConfirmacionCancelar();
            return;
        }

        this.cargandoCancelar = true;
        this.cdr.detectChanges();

        try {
            const cita = this.citaParaCancelar;
            const idCita = cita.idcita || cita.id;

            if (!idCita) {
                this.showError('Error', 'No se pudo identificar la cita a cancelar.');
                this.cargandoCancelar = false;
                this.cerrarModalConfirmacionCancelar();
                return;
            }

            const idNumerico = typeof idCita === 'string' ? parseInt(idCita, 10) : idCita;

            if (isNaN(idNumerico) || idNumerico <= 0) {
                this.showError('Error', 'ID de cita invalido.');
                this.cargandoCancelar = false;
                this.cerrarModalConfirmacionCancelar();
                return;
            }

            await firstValueFrom(
                this.usersService.cancelarCita(idNumerico, 'Cancelada por el doctor')
            );

            this.cerrarModalConfirmacionCancelar();

            this.showSuccess(
                'Cita Cancelada',
                'La cita ha sido cancelada exitosamente.'
            );

            setTimeout(async () => {
                await this.cargarCita(this.citaId!);
                this.cdr.detectChanges();
            }, 300);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al cancelar la cita.';

            if (error.error && error.error.error) {
                mensajeError = error.error.error;
            } else if (error.error && typeof error.error === 'string') {
                mensajeError = error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.showError('Error al Cancelar', mensajeError);
            this.cerrarModalConfirmacionCancelar();
        } finally {
            this.cargandoCancelar = false;
            this.cdr.detectChanges();
        }
    }

    // ==========================================
    // CARGA DE CITA
    // ==========================================
    async cargarCita(id: number) {
        this.isLoading = true;
        try {
            const data = await firstValueFrom(this.usersService.getCitaById(id));

            // CONSTRUIR NOMBRE COMPLETO DEL PACIENTE
            // Los campos vienen del backend: nombrepaciente, appaternopaciente, apmaternopaciente
            const nombre = data.nombrepaciente || data.nombrePaciente || data.NombrePaciente || '';
            const apPaterno = data.appaternopaciente || data.apPaternoPaciente || data.ApPaternoPaciente || '';
            const apMaterno = data.apmaternopaciente || data.apMaternoPaciente || data.ApMaternoPaciente || '';

            let nombreCompleto = '';
            if (nombre || apPaterno || apMaterno) {
                nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
            } else {
                // Fallback: usar el campo paciente si existe
                nombreCompleto = data.paciente || data.pacienteNombre || data.nombrePaciente || 'Paciente';
            }

            // Si está vacío, usar 'Paciente'
            if (!nombreCompleto || nombreCompleto.trim() === '') {
                nombreCompleto = 'Paciente';
            }

            this.cita = {
                ...data,
                id: data.idcita || data.id,
                // Guardar el nombre en todos los formatos posibles
                paciente: nombreCompleto,
                nombrePaciente: nombreCompleto,
                NombrePaciente: nombreCompleto,
                pacienteNombre: nombreCompleto,
                nombreCompleto: nombreCompleto
            };
        } catch (error) {
            console.error('Error al cargar cita:', error);
            this.showError('Error', 'No se pudo cargar la informacion de la cita.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ==========================================
    // METODOS DE UTILIDAD
    // ==========================================
    getEstadoClass(estado: string): string {
        if (!estado) return 'estado-info';
        const estadoLower = estado.toLowerCase();
        switch (estadoLower) {
            case 'completada':
            case 'realizada':
            case 'finalizada':
                return 'estado-completada';
            case 'programada':
            case 'pendiente':
            case 'confirmada':
                return 'estado-programada';
            case 'cancelada':
                return 'estado-cancelada';
            default:
                return 'estado-info';
        }
    }

    getEstadoIcon(estado: string): string {
        if (!estado) return 'bi-question-circle';
        const estadoLower = estado.toLowerCase();
        switch (estadoLower) {
            case 'completada':
            case 'realizada':
            case 'finalizada':
                return 'bi-check-circle-fill';
            case 'programada':
            case 'pendiente':
            case 'confirmada':
                return 'bi-calendar-plus';
            case 'cancelada':
                return 'bi-x-circle-fill';
            default:
                return 'bi-calendar-event';
        }
    }

    getModalidadClass(modalidad: string): string {
        if (!modalidad) return 'modalidad-presencial';
        return modalidad.toLowerCase() === 'virtual' ? 'modalidad-virtual' : 'modalidad-presencial';
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return `${diasSemana[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    formatearHora(hora: string): string {
        if (!hora) return 'S/H';
        try {
            const partes = hora.split(':');
            if (partes.length >= 2) {
                let h = parseInt(partes[0]);
                const m = partes[1];
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${m} ${ampm}`;
            }
            return hora;
        } catch {
            return hora;
        }
    }

    volver() {
        this.router.navigate(['/doctor/citas']);
    }
}