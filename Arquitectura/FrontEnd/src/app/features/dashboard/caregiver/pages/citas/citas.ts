import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-caregiver-citas',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        CaregiverMenu
    ],
    templateUrl: './citas.html',
    styleUrls: ['./citas.css']
})
export class CaregiverCitas implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    caregiverId: number | null = null;
    caregiverName: string = '';
    caregiverCorreo: string = '';

    citas: any[] = [];
    citasFiltradas: any[] = [];
    filterEstado: string = 'todas';
    citasEstadisticas = {
        total: 0,
        programadas: 0,
        completadas: 0,
        canceladas: 0
    };

    pacientesAsignados: Set<number> = new Set();

    mostrarModalSolicitud: boolean = false;
    pacienteSolicitado: any = null;
    parentesco: string = '';
    notas: string = '';
    enviandoSolicitud: boolean = false;

    parentescos = [
        'Padre', 'Madre', 'Hermano', 'Hermana', 'Tio', 'Tia',
        'Primo', 'Prima', 'Abuelo', 'Abuela', 'Conyuge', 'Otro'
    ];

    notifications: ToastNotification[] = [];
    private toastIdCounter = 0;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
    }

    async cargarDatos() {
        this.isLoading = true;
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.caregiverId = userData.idusuario || userData.uid || null;
                this.caregiverName = userData.nombre || 'Acompanante';
                this.caregiverCorreo = userData.correo || '';
            }

            if (this.caregiverId) {
                await this.cargarPacientesAsignados();
                await this.cargarCitas();
            } else {
                this.mostrarToast('warning', 'Sin datos', 'No se pudo identificar al acompanante');
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.mostrarToast('error', 'Error', 'No se pudieron cargar las citas');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarPacientesAsignados() {
        try {
            const pacientes = await firstValueFrom(
                this.usersService.getPacientesAsignados(this.caregiverId!)
            );

            if (Array.isArray(pacientes)) {
                this.pacientesAsignados.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesAsignados.add(id);
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar pacientes asignados:', error);
        }
    }

    private async cargarCitas() {
        try {
            const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

            if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                this.citas = todasLasCitas.map(c => {
                    const nombre = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
                    const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
                    const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';

                    let nombreCompleto = '';
                    if (nombre || apPaterno || apMaterno) {
                        nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                    } else {
                        nombreCompleto = c.paciente || c.pacienteNombre || c.nombrePaciente || 'Paciente';
                    }

                    if (!nombreCompleto || nombreCompleto.trim() === '') {
                        nombreCompleto = 'Paciente';
                    }

                    const idPaciente = c.idpaciente || c.idPaciente || c.pacienteId;
                    const tieneAcceso = this.pacientesAsignados.has(idPaciente);

                    return {
                        ...c,
                        id: c.idcita || c.id,
                        idPaciente: idPaciente,
                        fechacita: c.fechacita || c.fecha || c.fechaCita,
                        horacita: c.horacita || c.hora || c.horaCita,
                        paciente: nombreCompleto,
                        nombrePaciente: nombreCompleto,
                        especialidad: c.especialidad || c.Especialidad || 'General',
                        tieneAcceso: tieneAcceso,
                        correoPaciente: c.correopaciente || c.correoPaciente || c.CorreoPaciente
                    };
                });

                await this.verificarSolicitudesPendientes();

                this.citas.sort((a: any, b: any) => {
                    const fechaA = new Date(a.fechacita || a.fecha || a.fechaCita);
                    const fechaB = new Date(b.fechacita || b.fecha || b.fechaCita);
                    return fechaB.getTime() - fechaA.getTime();
                });

                this.calcularEstadisticas();
                this.aplicarFiltro('todas');
            } else {
                this.citas = [];
                this.calcularEstadisticas();
                this.aplicarFiltro('todas');
            }
        } catch (error) {
            console.error('Error al cargar citas:', error);
            this.citas = [];
            this.calcularEstadisticas();
            this.aplicarFiltro('todas');
            this.mostrarToast('error', 'Error', 'No se pudieron cargar las citas');
        }
    }

    private async verificarSolicitudesPendientes() {
        try {
            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId!)
            );

            if (Array.isArray(solicitudes)) {
                const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
                const pacientesPendientes = new Set(pendientes.map(s => s.idpaciente));

                this.citas.forEach(c => {
                    if (pacientesPendientes.has(c.idPaciente)) {
                        c.solicitudEnviada = true;
                    }
                });
            }
        } catch (error) {
            console.error('Error al verificar solicitudes pendientes:', error);
        }
    }

    private calcularEstadisticas() {
        this.citasEstadisticas.total = this.citas.length;
        this.citasEstadisticas.programadas = this.citas.filter(c =>
            (c.estado || '').toLowerCase() === 'programada' ||
            (c.estado || '').toLowerCase() === 'pendiente' ||
            (c.estado || '').toLowerCase() === 'confirmada' ||
            (c.estado || '').toLowerCase() === 'agendada'
        ).length;
        this.citasEstadisticas.completadas = this.citas.filter(c =>
            (c.estado || '').toLowerCase() === 'completada' ||
            (c.estado || '').toLowerCase() === 'realizada' ||
            (c.estado || '').toLowerCase() === 'finalizada'
        ).length;
        this.citasEstadisticas.canceladas = this.citas.filter(c =>
            (c.estado || '').toLowerCase() === 'cancelada'
        ).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todas') {
            this.citasFiltradas = [...this.citas];
        } else {
            this.citasFiltradas = this.citas.filter(c =>
                (c.estado || '').toLowerCase() === estado.toLowerCase()
            );
        }
    }

    verDetalleCita(cita: any) {
        const idCita = cita.idcita || cita.id;
        if (idCita) {
            this.router.navigate(['/caregiver/citas/detalle', idCita]);
        }
    }

    abrirModalSolicitud(paciente: any) {
        this.pacienteSolicitado = paciente;
        this.parentesco = '';
        this.notas = '';
        this.mostrarModalSolicitud = true;
        this.cdr.detectChanges();
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.pacienteSolicitado = null;
        this.parentesco = '';
        this.notas = '';
        this.enviandoSolicitud = false;
    }

    async enviarSolicitud() {
        if (!this.parentesco) {
            this.mostrarToast('warning', 'Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: this.pacienteSolicitado.correoPaciente || this.pacienteSolicitado.correo,
                    parentesco: this.parentesco,
                    notas: this.notas
                })
            );

            this.mostrarToast('success', 'Solicitud enviada',
                'Tu solicitud ha sido enviada. Espera la aprobacion del administrador.');

            if (this.pacienteSolicitado) {
                const citaIndex = this.citas.findIndex(c => c.id === this.pacienteSolicitado.id);
                if (citaIndex !== -1) {
                    this.citas[citaIndex].solicitudEnviada = true;
                }
            }

            this.cerrarModalSolicitud();

        } catch (error: any) {
            const mensaje = error.error?.error || 'Error al enviar la solicitud';
            this.mostrarToast('error', 'Error', mensaje);
        } finally {
            this.enviandoSolicitud = false;
        }
    }

    getAccesoStatus(cita: any): { texto: string; clase: string; icono: string; tieneAcceso: boolean } {
        if (cita.tieneAcceso) {
            return {
                texto: 'Tienes acceso',
                clase: 'acceso-si',
                icono: 'bi-check-circle-fill',
                tieneAcceso: true
            };
        }
        if (cita.solicitudEnviada) {
            return {
                texto: 'Solicitud enviada',
                clase: 'acceso-pendiente',
                icono: 'bi-clock-history',
                tieneAcceso: false
            };
        }
        return {
            texto: 'Sin acceso',
            clase: 'acceso-no',
            icono: 'bi-x-circle-fill',
            tieneAcceso: false
        };
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

    obtenerMes(fecha: string): string {
        if (!fecha) return '';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return meses[d.getMonth()] || '';
        } catch {
            return '';
        }
    }

    obtenerDia(fecha: string): string {
        if (!fecha) return '??';
        try {
            const d = new Date(fecha);
            return d.getDate().toString().padStart(2, '0');
        } catch {
            return '??';
        }
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

    obtenerBadgeTiempo(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'Hoy';
        if (this.esCitaProxima(fecha)) return 'Proxima';
        return 'Pasada';
    }

    getBadgeTiempoClass(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'badge-hoy';
        if (this.esCitaProxima(fecha)) return 'badge-proxima';
        return 'badge-pasada';
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