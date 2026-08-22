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
        canceladas: 0,
        hoy: 0,
        proximas: 0
    };

    // Solo pacientes asignados al acompañante
    pacientesAsignadosIds: number[] = [];
    pacientesAsignados: any[] = [];
    pacientesAsignadosEmails: string[] = [];

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

            if (!this.caregiverId) {
                this.mostrarToast('warning', 'Sin datos', 'No se pudo identificar al acompanante');
                this.isLoading = false;
                return;
            }

            console.log('[CaregiverCitas] ID del acompañante:', this.caregiverId);

            // 1. Cargar pacientes asignados al acompañante
            await this.cargarPacientesAsignados();

            // 2. Si tiene pacientes asignados, cargar sus citas
            if (this.pacientesAsignadosIds.length > 0) {
                await this.cargarCitas();
            } else {
                console.log('[CaregiverCitas] No hay pacientes asignados');
                this.citas = [];
                this.citasFiltradas = [];
                this.calcularEstadisticas();
                this.mostrarToast('info', 'Sin pacientes', 'No tienes pacientes asignados aún.');
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.mostrarToast('error', 'Error', 'No se pudieron cargar las citas');
            this.citas = [];
            this.citasFiltradas = [];
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // CARGAR PACIENTES ASIGNADOS AL ACOMPAÑANTE
    // ============================================================
    private async cargarPacientesAsignados() {
        try {
            console.log('[CaregiverCitas] Cargando pacientes asignados para ID:', this.caregiverId);

            let pacientesData: any[] = [];

            try {
                const response = await firstValueFrom(
                    this.usersService.getPacientesAsignados(this.caregiverId!)
                );
                console.log('[CaregiverCitas] Respuesta getPacientesAsignados:', response);

                if (response && typeof response === 'object') {
                    if ('success' in response && 'data' in response) {
                        pacientesData = (response as any).data || [];
                    } else if (Array.isArray(response)) {
                        pacientesData = response;
                    } else if ('data' in response) {
                        pacientesData = (response as any).data || [];
                    } else {
                        // Buscar array en la respuesta
                        const respObj = response as Record<string, any>;
                        for (const key in respObj) {
                            if (Object.prototype.hasOwnProperty.call(respObj, key) && Array.isArray(respObj[key])) {
                                pacientesData = respObj[key];
                                break;
                            }
                        }
                    }
                } else if (Array.isArray(response)) {
                    pacientesData = response;
                }
            } catch (error) {
                console.warn('[CaregiverCitas] Error con getPacientesAsignados:', error);
            }

            // Almacenar pacientes asignados
            this.pacientesAsignados = pacientesData;

            // Extraer IDs de pacientes (en todos los formatos posibles)
            this.pacientesAsignadosIds = pacientesData
                .map((p: any) => {
                    const id = p.id_usuario || p.IdUsuario || p.idusuario || p.id || p.IdPaciente || p.idpaciente || p.pacienteId;
                    return typeof id === 'string' ? parseInt(id, 10) : id;
                })
                .filter((id: number) => id > 0);

            // Extraer emails de pacientes asignados
            this.pacientesAsignadosEmails = pacientesData
                .map((p: any) => p.correo || p.Correo || p.email || p.Email || '')
                .filter((email: string) => email && email.length > 0);

            console.log('[CaregiverCitas] IDs de pacientes asignados:', this.pacientesAsignadosIds);
            console.log('[CaregiverCitas] Emails de pacientes asignados:', this.pacientesAsignadosEmails);

        } catch (error) {
            console.error('[CaregiverCitas] Error al cargar pacientes asignados:', error);
            this.pacientesAsignadosIds = [];
            this.pacientesAsignados = [];
            this.pacientesAsignadosEmails = [];
        }
    }

    // ============================================================
    // CARGAR CITAS SOLO DE PACIENTES ASIGNADOS
    // ============================================================
    private async cargarCitas() {
        try {
            // Si no hay pacientes asignados, no mostrar citas
            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[CaregiverCitas] No hay pacientes asignados, no se muestran citas');
                this.citas = [];
                this.citasFiltradas = [];
                this.calcularEstadisticas();
                return;
            }

            const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());
            console.log('[CaregiverCitas] Total de citas obtenidas:', todasLasCitas?.length || 0);

            if (!Array.isArray(todasLasCitas) || todasLasCitas.length === 0) {
                this.citas = [];
                this.citasFiltradas = [];
                this.calcularEstadisticas();
                this.mostrarToast('info', 'Sin citas', 'No hay citas registradas para tus pacientes.');
                return;
            }

            // FILTRAR: Solo citas de pacientes asignados al acompañante
            const citasFiltradas = todasLasCitas.filter((c: any) => {
                // Intentar obtener el ID del paciente en múltiples formatos
                const posiblesIds = [
                    c.idpaciente, c.IdPaciente, c.idPaciente,
                    c.pacienteId, c.id_usuario, c.IdUsuario,
                    c.idusuario, c.paciente_id
                ];

                let idPacienteCita = null;
                for (const pid of posiblesIds) {
                    if (pid !== undefined && pid !== null && pid !== '') {
                        idPacienteCita = pid;
                        break;
                    }
                }

                let idPacienteCitaNum = null;
                if (idPacienteCita !== null) {
                    idPacienteCitaNum = typeof idPacienteCita === 'string' ? parseInt(idPacienteCita, 10) : idPacienteCita;
                }

                // Verificar si el ID del paciente está en la lista de asignados
                if (idPacienteCitaNum && idPacienteCitaNum > 0) {
                    const estaAsignado = this.pacientesAsignadosIds.some(id => id === idPacienteCitaNum);
                    if (estaAsignado) {
                        console.log(`[CaregiverCitas] ✅ Cita asignada por ID: ${idPacienteCitaNum}`);
                        return true;
                    }
                }

                // Si no se encontró por ID, intentar por correo
                const correoPaciente = c.correopaciente || c.correoPaciente || c.CorreoPaciente ||
                    c.emailPaciente || c.email || c.correo || c.Correo;

                if (correoPaciente && correoPaciente.length > 0) {
                    const estaAsignado = this.pacientesAsignadosEmails.some(
                        email => email && email.toLowerCase() === correoPaciente.toLowerCase()
                    );
                    if (estaAsignado) {
                        console.log(`[CaregiverCitas] ✅ Cita asignada por correo: ${correoPaciente}`);
                        return true;
                    }
                }

                // Si no se encontró por ID ni correo, intentar por nombre
                const nombrePaciente = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
                const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
                const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';
                const nombreCompleto = `${nombrePaciente} ${apPaterno} ${apMaterno}`.trim().toLowerCase();

                if (nombreCompleto && nombreCompleto.length > 0) {
                    // Buscar en pacientes asignados por nombre
                    const estaAsignado = this.pacientesAsignados.some((p: any) => {
                        const pNombre = p.nombre || p.Nombre || '';
                        const pApPaterno = p.apellido_paterno || p.apPaterno || p.ApPaterno || '';
                        const pApMaterno = p.apellido_materno || p.apMaterno || p.ApMaterno || '';
                        const pNombreCompleto = `${pNombre} ${pApPaterno} ${pApMaterno}`.trim().toLowerCase();

                        if (pNombreCompleto && pNombreCompleto.length > 0) {
                            return nombreCompleto === pNombreCompleto ||
                                nombreCompleto.includes(pNombreCompleto) ||
                                pNombreCompleto.includes(nombreCompleto);
                        }
                        return false;
                    });
                    if (estaAsignado) {
                        console.log(`[CaregiverCitas] ✅ Cita asignada por nombre: ${nombreCompleto}`);
                        return true;
                    }
                }

                console.log(`[CaregiverCitas] ❌ Cita NO asignada: ID=${idPacienteCitaNum}, Nombre=${nombreCompleto}`);
                return false;
            });

            console.log('[CaregiverCitas] Citas de pacientes asignados:', citasFiltradas.length);

            // Procesar citas filtradas
            this.citas = citasFiltradas.map(c => {
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

                const idPaciente = c.idpaciente || c.idPaciente || c.pacienteId || c.id_usuario;
                const tieneAcceso = this.pacientesAsignadosIds.some(id => id === idPaciente);

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

            // Verificar solicitudes pendientes para mostrar estado
            await this.verificarSolicitudesPendientes();

            // Ordenar por fecha (más reciente primero)
            this.citas.sort((a: any, b: any) => {
                const fechaA = new Date(a.fechacita || a.fecha || a.fechaCita);
                const fechaB = new Date(b.fechacita || b.fecha || b.fechaCita);
                if (isNaN(fechaA.getTime())) return 1;
                if (isNaN(fechaB.getTime())) return -1;
                return fechaB.getTime() - fechaA.getTime();
            });

            this.calcularEstadisticas();
            this.aplicarFiltro('todas');

            if (this.citas.length === 0) {
                this.mostrarToast('info', 'Sin citas', 'No hay citas registradas para tus pacientes asignados.');
            } else {
                this.mostrarToast('success', 'Citas cargadas', `Se encontraron ${this.citas.length} citas de tus pacientes.`);
            }

        } catch (error) {
            console.error('Error al cargar citas:', error);
            this.citas = [];
            this.citasFiltradas = [];
            this.calcularEstadisticas();
            this.mostrarToast('error', 'Error', 'No se pudieron cargar las citas');
        }
    }

    // ============================================================
    // VERIFICAR SOLICITUDES PENDIENTES
    // ============================================================
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

    // ============================================================
    // ESTADÍSTICAS
    // ============================================================
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

        // Citas de hoy
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        this.citasEstadisticas.hoy = this.citas.filter(c => {
            if (!c.fechacita) return false;
            try {
                const fechaCita = new Date(c.fechacita);
                fechaCita.setHours(0, 0, 0, 0);
                return fechaCita.getTime() === hoy.getTime();
            } catch {
                return false;
            }
        }).length;

        // Citas próximas
        const ahora = new Date();
        this.citasEstadisticas.proximas = this.citas.filter(c => {
            if (!c.fechacita) return false;
            try {
                const fechaCita = new Date(c.fechacita);
                return fechaCita > ahora;
            } catch {
                return false;
            }
        }).length;
    }

    // ============================================================
    // FILTROS
    // ============================================================
    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todas') {
            this.citasFiltradas = [...this.citas];
        } else if (estado === 'hoy') {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            this.citasFiltradas = this.citas.filter(c => {
                if (!c.fechacita) return false;
                try {
                    const fechaCita = new Date(c.fechacita);
                    fechaCita.setHours(0, 0, 0, 0);
                    return fechaCita.getTime() === hoy.getTime();
                } catch {
                    return false;
                }
            });
        } else if (estado === 'proximas') {
            const ahora = new Date();
            this.citasFiltradas = this.citas.filter(c => {
                if (!c.fechacita) return false;
                try {
                    const fechaCita = new Date(c.fechacita);
                    return fechaCita > ahora;
                } catch {
                    return false;
                }
            });
        } else {
            this.citasFiltradas = this.citas.filter(c =>
                (c.estado || '').toLowerCase() === estado.toLowerCase()
            );
        }
    }

    // ============================================================
    // NAVEGACIÓN
    // ============================================================
    verDetalleCita(cita: any) {
        const idCita = cita.idcita || cita.id;
        if (idCita) {
            this.router.navigate(['/caregiver/citas/detalle', idCita]);
        }
    }

    // ============================================================
    // MODAL DE SOLICITUD
    // ============================================================
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
                    correoPaciente: this.pacienteSolicitado.correoPaciente || this.pacienteSolicitado.correo || '',
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

    // ============================================================
    // UTILITIES
    // ============================================================
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
            hoy.setHours(0, 0, 0, 0);
            const fechaCita = new Date(fecha);
            fechaCita.setHours(0, 0, 0, 0);
            return hoy.getTime() === fechaCita.getTime();
        } catch {
            return false;
        }
    }

    esCitaProxima(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const ahora = new Date();
            const fechaCita = new Date(fecha);
            return fechaCita > ahora;
        } catch {
            return false;
        }
    }

    obtenerBadgeTiempo(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'Hoy';
        if (this.esCitaProxima(fecha)) return 'Próxima';
        return 'Pasada';
    }

    getBadgeTiempoClass(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'badge-hoy';
        if (this.esCitaProxima(fecha)) return 'badge-proxima';
        return 'badge-pasada';
    }

    recargarDatos() {
        this.cargarDatos();
    }

    // ============================================================
    // TOAST NOTIFICATIONS
    // ============================================================
    mostrarToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration: number = 4000) {
        const toast: ToastNotification = {
            id: ++this.toastIdCounter,
            type,
            title,
            message,
            duration
        };
        this.notifications.push(toast);
        this.cdr.detectChanges();

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
            this.cdr.detectChanges();
        }, 300);
    }
}