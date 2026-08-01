import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { CaregiverMenu } from "../../../template/menu/menu";
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-caregiver-cita-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, CaregiverMenu],
    templateUrl: './cita-detalle.html',
    styleUrls: ['./cita-detalle.css']
})
export class CaregiverCitaDetalle implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private location = inject(Location);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    citaId: number | null = null;
    cita: any = null;
    caregiverId: number | null = null;

    notifications: ToastNotification[] = [];
    private toastIdCounter = 0;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.route.params.subscribe(params => {
            this.citaId = +params['id'];
            if (this.citaId) {
                this.cargarCita();
            }
        });
    }

    async cargarCita() {
        this.isLoading = true;
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.caregiverId = userData.idusuario || userData.uid || null;
            }

            const citaData = await firstValueFrom(
                this.usersService.getCitaById(this.citaId!)
            );

            if (citaData) {
                const nombre = citaData.nombrepaciente || citaData.nombrePaciente || citaData.NombrePaciente || '';
                const apPaterno = citaData.appaternopaciente || citaData.apPaternoPaciente || citaData.ApPaternoPaciente || '';
                const apMaterno = citaData.apmaternopaciente || citaData.apMaternoPaciente || citaData.ApMaternoPaciente || '';

                let nombreCompleto = '';
                if (nombre || apPaterno || apMaterno) {
                    nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                } else {
                    nombreCompleto = citaData.paciente || citaData.pacienteNombre || citaData.nombrePaciente || 'Paciente';
                }

                if (!nombreCompleto || nombreCompleto.trim() === '') {
                    nombreCompleto = 'Paciente';
                }

                this.cita = {
                    ...citaData,
                    id: citaData.idcita || citaData.id,
                    fechacita: citaData.fechacita || citaData.fecha || citaData.fechaCita,
                    horacita: citaData.horacita || citaData.hora || citaData.horaCita,
                    paciente: nombreCompleto,
                    nombrePaciente: nombreCompleto
                };
            }

        } catch (error) {
            console.error('Error al cargar cita:', error);
            this.mostrarToast('error', 'Error', 'No se pudo cargar la informacion de la cita');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    volver() {
        this.location.back();
    }

    formatearFechaCompleta(fecha: string): string {
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
            case 'agendada':
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
            case 'agendada':
                return 'bi-calendar-plus';
            case 'cancelada':
                return 'bi-x-circle-fill';
            default:
                return 'bi-calendar-event';
        }
    }

    getEstadoTexto(estado: string): string {
        if (!estado) return 'Programada';
        const estadoLower = estado.toLowerCase();
        switch (estadoLower) {
            case 'completada':
            case 'realizada':
            case 'finalizada':
                return 'Completada';
            case 'programada':
            case 'pendiente':
            case 'confirmada':
            case 'agendada':
                return 'Programada';
            case 'cancelada':
                return 'Cancelada';
            default:
                return estado;
        }
    }

    getModalidadClass(modalidad: string): string {
        if (!modalidad) return 'modalidad-presencial';
        return modalidad.toLowerCase() === 'virtual' ? 'modalidad-virtual' : 'modalidad-presencial';
    }

    getBadgeTiempoClass(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'badge-hoy';
        if (this.esCitaProxima(fecha)) return 'badge-proxima';
        return 'badge-pasada';
    }

    obtenerBadgeTiempo(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'Hoy';
        if (this.esCitaProxima(fecha)) return 'Proxima';
        return 'Pasada';
    }

    esCitaHoy(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const hoy = new Date();
            const fechaCita = new Date(fecha);
            return hoy.getDate() === fechaCita.getDate() &&
                hoy.getMonth() === fechaCita.getMonth() &&
                hoy.getFullYear() === fechaCita.getFullYear();
        } catch {
            return false;
        }
    }

    esCitaProxima(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const hoy = new Date();
            const fechaCita = new Date(fecha);
            return fechaCita > hoy;
        } catch {
            return false;
        }
    }

    mostrarToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration: number = 4000) {
        const toast: ToastNotification = {
            id: ++this.toastIdCounter,
            type,
            title,
            message,
            duration
        };
        this.notifications.push(toast);

        setTimeout(() => {
            this.removerToast(toast.id);
        }, duration);
    }

    removerToast(id: number) {
        const toast = this.notifications.find(t => t.id === id);
        if (toast) {
            toast.duration = 0;
        }
        setTimeout(() => {
            this.notifications = this.notifications.filter(t => t.id !== id);
        }, 300);
    }
}