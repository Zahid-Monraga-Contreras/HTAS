import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../template/menu/menu";
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
    selector: 'app-caregiver-tratamientos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        CaregiverMenu
    ],
    templateUrl: './tratamientos.html',
    styleUrls: ['./tratamientos.css']
})
export class CaregiverTratamientos implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    caregiverId: number | null = null;
    caregiverName: string = '';

    tratamientos: any[] = [];
    tratamientosFiltrados: any[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    // Solo pacientes asignados al acompañante
    pacientesAsignadosIds: number[] = [];
    pacientesAsignados: any[] = [];
    pacientesAsignadosEmails: string[] = [];

    private pacientesMap: Map<number, any> = new Map();

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0,
        vencidos: 0
    };

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
    private notificationCounter = 0;

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
                this.caregiverId = userData.idusuario || userData.uid || null;
                this.caregiverName = userData.nombre || 'Acompanante';
            }

            if (!this.caregiverId) {
                this.showWarning('Sin datos', 'No se pudo identificar al acompanante');
                this.isLoading = false;
                return;
            }

            console.log('[CaregiverTratamientos] ID del acompañante:', this.caregiverId);

            // 1. Cargar pacientes asignados al acompañante
            await this.cargarPacientesAsignados();

            // 2. Cargar mapa de pacientes
            await this.cargarPacientes();

            // 3. Cargar tratamientos SOLO de pacientes asignados
            if (this.pacientesAsignadosIds.length > 0) {
                await this.cargarTratamientos();
            } else {
                console.log('[CaregiverTratamientos] No hay pacientes asignados');
                this.tratamientos = [];
                this.tratamientosFiltrados = [];
                this.calcularEstadisticas();
                this.showInfo('Sin pacientes', 'No tienes pacientes asignados aún.');
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los tratamientos.');
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
            console.log('[CaregiverTratamientos] Cargando pacientes asignados para ID:', this.caregiverId);

            let pacientesData: any[] = [];

            try {
                const response = await firstValueFrom(
                    this.usersService.getPacientesAsignados(this.caregiverId!)
                );
                console.log('[CaregiverTratamientos] Respuesta getPacientesAsignados:', response);

                if (response && typeof response === 'object') {
                    if ('success' in response && 'data' in response) {
                        pacientesData = (response as any).data || [];
                    } else if (Array.isArray(response)) {
                        pacientesData = response;
                    } else if ('data' in response) {
                        pacientesData = (response as any).data || [];
                    } else {
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
                console.warn('[CaregiverTratamientos] Error con getPacientesAsignados:', error);
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

            console.log('[CaregiverTratamientos] IDs de pacientes asignados:', this.pacientesAsignadosIds);
            console.log('[CaregiverTratamientos] Emails de pacientes asignados:', this.pacientesAsignadosEmails);

        } catch (error) {
            console.error('[CaregiverTratamientos] Error al cargar pacientes asignados:', error);
            this.pacientesAsignadosIds = [];
            this.pacientesAsignados = [];
            this.pacientesAsignadosEmails = [];
        }
    }

    // ============================================================
    // CARGAR MAPA DE PACIENTES
    // ============================================================
    private async cargarPacientes() {
        try {
            const usuarios = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(usuarios)) {
                const pacientes = usuarios.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );

                this.pacientesMap.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesMap.set(id, p);
                    }
                });

                console.log('[CaregiverTratamientos] Pacientes cargados en mapa:', this.pacientesMap.size);
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
        }
    }

    // ============================================================
    // CARGAR TRATAMIENTOS SOLO DE PACIENTES ASIGNADOS
    // ============================================================
    private async cargarTratamientos() {
        try {
            // Si no hay pacientes asignados, no mostrar tratamientos
            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[CaregiverTratamientos] No hay pacientes asignados, no se muestran tratamientos');
                this.tratamientos = [];
                this.tratamientosFiltrados = [];
                this.calcularEstadisticas();
                return;
            }

            const data = await firstValueFrom(this.usersService.getTratamientos());
            console.log('[CaregiverTratamientos] Total de tratamientos obtenidos:', data?.length || 0);

            if (!Array.isArray(data) || data.length === 0) {
                this.tratamientos = [];
                this.tratamientosFiltrados = [];
                this.calcularEstadisticas();
                this.showInfo('Sin tratamientos', 'No hay tratamientos registrados para tus pacientes.');
                return;
            }

            // FILTRAR: Solo tratamientos de pacientes asignados al acompañante
            const tratamientosFiltrados = data.filter((t: any) => {
                const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId || t.id_usuario;
                const pacienteIdNum = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

                // Verificar si el paciente está en la lista de asignados
                if (pacienteIdNum && pacienteIdNum > 0) {
                    const estaAsignado = this.pacientesAsignadosIds.some(id => id === pacienteIdNum);
                    if (estaAsignado) {
                        console.log(`[CaregiverTratamientos] ✅ Tratamiento asignado - Paciente ID: ${pacienteIdNum}`);
                        return true;
                    }
                }

                // Si no se encontró por ID, intentar por correo
                const correoPaciente = t.correo || t.Correo || t.correopaciente || t.CorreoPaciente;
                if (correoPaciente && correoPaciente.length > 0) {
                    const estaAsignado = this.pacientesAsignadosEmails.some(
                        email => email && email.toLowerCase() === correoPaciente.toLowerCase()
                    );
                    if (estaAsignado) {
                        console.log(`[CaregiverTratamientos] ✅ Tratamiento asignado por correo: ${correoPaciente}`);
                        return true;
                    }
                }

                console.log(`[CaregiverTratamientos] ❌ Tratamiento NO asignado - Paciente ID: ${pacienteIdNum}`);
                return false;
            });

            console.log('[CaregiverTratamientos] Tratamientos de pacientes asignados:', tratamientosFiltrados.length);

            // Procesar tratamientos filtrados
            this.tratamientos = tratamientosFiltrados.map(t => {
                const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId;

                let nombreCompleto = 'Paciente';
                if (pacienteId && this.pacientesMap.has(pacienteId)) {
                    const paciente = this.pacientesMap.get(pacienteId);
                    const nombre = paciente.nombre || '';
                    const apPaterno = paciente.apPaterno || '';
                    const apMaterno = paciente.apMaterno || '';
                    nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                    if (!nombreCompleto) {
                        nombreCompleto = paciente.correo || 'Paciente';
                    }
                } else {
                    // Buscar por nombre si está en el tratamiento
                    const nombre = t.nombre || t.Nombre || '';
                    const apPaterno = t.appaterno || t.ApPaterno || t.apPaterno || '';
                    const apMaterno = t.apmaterno || t.ApMaterno || t.apMaterno || '';
                    if (nombre || apPaterno || apMaterno) {
                        nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                    } else if (t.nombrepaciente) {
                        nombreCompleto = t.nombrepaciente;
                    } else if (t.paciente) {
                        nombreCompleto = t.paciente;
                    }
                }

                const tieneAcceso = this.pacientesAsignadosIds.some(id => id === pacienteId);

                return {
                    ...t,
                    idtratamiento: t.idtratamiento || t.IdTratamiento || t.id,
                    idpaciente: pacienteId,
                    nombreMedicamento: t.nombremedicamento || t.NombreMedicamento || 'Medicamento',
                    nombrePaciente: nombreCompleto,
                    paciente: nombreCompleto,
                    fechaInicio: t.fechainicio || t.FechaInicio,
                    fechaFin: t.fechafin || t.FechaFin,
                    dosis: t.dosis || t.Dosis,
                    frecuenciaHoras: t.frecuenciaHoras || t.frecuenciashoras || t.FrecuenciaHoras,
                    activo: t.activo !== undefined ? t.activo : t.Activo,
                    tieneAcceso: tieneAcceso,
                    solicitudEnviada: false
                };
            });

            await this.verificarSolicitudesPendientes();

            this.calcularEstadisticas();
            this.aplicarFiltro('todos');

            if (this.tratamientos.length === 0) {
                this.showInfo('Sin tratamientos', 'No hay tratamientos registrados para tus pacientes asignados.');
            } else {
                this.showSuccess('Tratamientos cargados', `Se encontraron ${this.tratamientos.length} tratamientos de tus pacientes.`);
            }

        } catch (error) {
            console.error('Error al cargar tratamientos:', error);
            this.tratamientos = [];
            this.tratamientosFiltrados = [];
            this.calcularEstadisticas();
            this.showError('Error', 'No se pudieron cargar los tratamientos.');
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

                this.tratamientos.forEach(t => {
                    if (pacientesPendientes.has(t.idpaciente)) {
                        t.solicitudEnviada = true;
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
        this.estadisticas.total = this.tratamientos.length;
        this.estadisticas.activos = this.tratamientos.filter(t => t.activo !== false && t.activo !== 0).length;
        this.estadisticas.inactivos = this.tratamientos.filter(t => t.activo === false || t.activo === 0).length;

        const hoy = new Date();
        this.estadisticas.vencidos = this.tratamientos.filter(t => {
            const fechaFin = new Date(t.fechaFin || t.fechafin);
            return fechaFin < hoy && t.activo !== false && t.activo !== 0;
        }).length;
    }

    // ============================================================
    // FILTROS
    // ============================================================
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
                    (t.dosis || '').toLowerCase().includes(term) ||
                    (t.medicamento || '').toLowerCase().includes(term);
            }

            return matchEstado && matchSearch;
        });
    }

    // ============================================================
    // NAVEGACIÓN
    // ============================================================
    verDetalle(tratamiento: any) {
        const id = tratamiento.idtratamiento || tratamiento.id;
        if (id) {
            this.router.navigate(['/caregiver/tratamientos/detalle', id]);
        }
    }

    // ============================================================
    // MODAL DE SOLICITUD
    // ============================================================
    abrirModalSolicitud(tratamiento: any) {
        this.pacienteSolicitado = tratamiento;
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
            this.showWarning('Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            const paciente = this.pacientesMap.get(this.pacienteSolicitado.idpaciente);
            const correoPaciente = paciente?.correo || '';

            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: correoPaciente,
                    parentesco: this.parentesco,
                    notas: this.notas
                })
            );

            this.showSuccess('Solicitud enviada',
                'Tu solicitud ha sido enviada. Espera la aprobacion del administrador.');

            const index = this.tratamientos.findIndex(t => t.idtratamiento === this.pacienteSolicitado.idtratamiento);
            if (index !== -1) {
                this.tratamientos[index].solicitudEnviada = true;
            }

            this.cerrarModalSolicitud();

        } catch (error: any) {
            const mensaje = error.error?.error || 'Error al enviar la solicitud';
            this.showError('Error', mensaje);
        } finally {
            this.enviandoSolicitud = false;
        }
    }

    // ============================================================
    // UTILITIES
    // ============================================================
    getAccesoStatus(tratamiento: any): { texto: string; clase: string; icono: string; tieneAcceso: boolean } {
        if (tratamiento.tieneAcceso) {
            return {
                texto: 'Tienes acceso',
                clase: 'acceso-si',
                icono: 'bi-check-circle-fill',
                tieneAcceso: true
            };
        }
        if (tratamiento.solicitudEnviada) {
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

    recargarDatos() {
        this.cargarDatos();
    }
}