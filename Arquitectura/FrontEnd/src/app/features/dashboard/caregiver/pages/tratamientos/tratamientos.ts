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

    pacientesAsignados: Set<number> = new Set();
    pacientesConAcceso: Map<number, boolean> = new Map();

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

            if (this.caregiverId) {
                await this.cargarPacientesAsignados();
                await this.cargarPacientes();
                await this.cargarTratamientos();
            } else {
                this.showWarning('Sin datos', 'No se pudo identificar al acompanante');
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los tratamientos.');
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
                        this.pacientesConAcceso.set(id, true);
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar pacientes asignados:', error);
        }
    }

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
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
        }
    }

    private async cargarTratamientos() {
        try {
            const data = await firstValueFrom(this.usersService.getTratamientos());

            if (Array.isArray(data)) {
                this.tratamientos = data.map(t => {
                    const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente;
                    const tieneAcceso = this.pacientesAsignados.has(pacienteId);

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
                    }

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
                        tieneAcceso: tieneAcceso
                    };
                });

                await this.verificarSolicitudesPendientes();

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

    verDetalle(tratamiento: any) {
        const id = tratamiento.idtratamiento || tratamiento.id;
        if (id) {
            this.router.navigate(['/caregiver/tratamientos/detalle', id]);
        }
    }

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
}