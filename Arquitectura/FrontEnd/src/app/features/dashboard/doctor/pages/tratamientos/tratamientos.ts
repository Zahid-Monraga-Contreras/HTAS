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
    doctorId: number | null = null;
    doctorName: string = '';
    doctorFullName: string = '';

    // Lista de pacientes asignados al doctor
    pacientesAsignadosIds: number[] = [];
    pacientesAsignados: any[] = [];

    tratamientos: any[] = [];
    tratamientosFiltrados: any[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    // Diccionario de pacientes por ID para mapear nombres
    private pacientesMap: Map<number, any> = new Map();

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
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.doctorName = userData.nombre || 'Doctor';
                this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            if (!this.doctorId) {
                this.showError('Error', 'No se pudo identificar al doctor.');
                this.isLoading = false;
                return;
            }

            // 1. Cargar pacientes asignados al doctor
            await this.cargarPacientesAsignados();

            // 2. Cargar mapa de pacientes
            await this.cargarPacientes();

            // 3. Cargar tratamientos SOLO de pacientes asignados
            await this.cargarTratamientos();

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los tratamientos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // CARGAR PACIENTES ASIGNADOS AL DOCTOR
    // ============================================================
    private async cargarPacientesAsignados() {
        if (!this.doctorId) return;

        try {
            console.log('[Tratamientos] Cargando pacientes asignados al doctor:', this.doctorId);

            let response = null;
            let pacientesData: any[] = [];

            // Intentar getPacientesDeDoctor
            try {
                response = await firstValueFrom(
                    this.usersService.getPacientesDeDoctor(this.doctorId)
                );
                console.log('[Tratamientos] Respuesta getPacientesDeDoctor:', response);
            } catch (err) {
                console.warn('[Tratamientos] getPacientesDeDoctor falló:', err);
            }

            // Extraer datos de la respuesta
            if (response) {
                if (response.success !== undefined && response.data !== undefined) {
                    pacientesData = response.data || [];
                } else if (response.data !== undefined) {
                    pacientesData = response.data || [];
                } else if (Array.isArray(response)) {
                    pacientesData = response;
                } else if (typeof response === 'object') {
                    for (const key in response) {
                        if (Array.isArray(response[key]) && response[key].length > 0) {
                            pacientesData = response[key];
                            break;
                        }
                    }
                }
            }

            // Si no hay datos, usar getTodosLosPacientes y filtrar
            if (!pacientesData || pacientesData.length === 0) {
                console.log('[Tratamientos] Usando fallback con getTodosLosPacientes...');
                try {
                    const allPacientesResponse = await firstValueFrom(
                        this.usersService.getTodosLosPacientes()
                    );

                    let allPacientes: any[] = [];

                    if (allPacientesResponse) {
                        if (allPacientesResponse.data !== undefined) {
                            allPacientes = allPacientesResponse.data || [];
                        } else if (Array.isArray(allPacientesResponse)) {
                            allPacientes = allPacientesResponse;
                        } else if (typeof allPacientesResponse === 'object') {
                            for (const key in allPacientesResponse) {
                                if (Array.isArray(allPacientesResponse[key])) {
                                    allPacientes = allPacientesResponse[key];
                                    break;
                                }
                            }
                        }
                    }

                    const doctorIdNum = Number(this.doctorId);

                    // Filtrar pacientes asignados a este doctor
                    pacientesData = allPacientes.filter((p: any) => {
                        const posiblesPropiedades = [
                            'DoctorAsignado', 'doctorasignado', 'IdDoctorAsignado', 'iddoctorasignado',
                            'IdDoctor', 'iddoctor', 'DoctorId', 'doctorId', 'doctor_id'
                        ];

                        let doctorIdEncontrado = null;

                        for (const prop of posiblesPropiedades) {
                            if (p[prop] !== undefined && p[prop] !== null) {
                                doctorIdEncontrado = p[prop];
                                break;
                            }
                        }

                        const asignado = p.AsignacionActiva === true || p.asignacionactiva === true;

                        if (doctorIdEncontrado !== null && doctorIdEncontrado !== undefined) {
                            const idNum = Number(doctorIdEncontrado);
                            return idNum === doctorIdNum && asignado;
                        }
                        return false;
                    });

                    console.log('[Tratamientos] Pacientes filtrados por asignación:', pacientesData.length);

                } catch (err) {
                    console.warn('[Tratamientos] Falló la carga alternativa:', err);
                }
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

            console.log('[Tratamientos] IDs de pacientes asignados:', this.pacientesAsignadosIds);

            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Tratamientos] No se encontraron pacientes asignados para este doctor');
            }

        } catch (error: any) {
            console.error('[Tratamientos] Error cargando pacientes asignados:', error);
            this.pacientesAsignadosIds = [];
            this.pacientesAsignados = [];
        }
    }

    // ============================================================
    // CARGAR MAPA DE PACIENTES
    // ============================================================
    private async cargarPacientes() {
        try {
            const usuarios = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(usuarios)) {
                // Filtrar solo pacientes
                const pacientes = usuarios.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );

                // Crear mapa de pacientes por ID
                this.pacientesMap.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesMap.set(id, p);
                    }
                });

                console.log('[Tratamientos] Pacientes cargados en mapa:', this.pacientesMap.size);
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
                console.log('[Tratamientos] No hay pacientes asignados, no se muestran tratamientos');
                this.tratamientos = [];
                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
                return;
            }

            const data = await firstValueFrom(this.usersService.getTratamientos());

            if (Array.isArray(data)) {
                console.log('[Tratamientos] Total de tratamientos obtenidos:', data.length);

                // FILTRAR: Solo tratamientos de pacientes asignados al doctor
                const tratamientosFiltrados = data.filter(t => {
                    // Obtener el ID del paciente del tratamiento
                    const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId;
                    const pacienteIdNum = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

                    // Verificar si este paciente está en la lista de asignados
                    const estaAsignado = pacienteIdNum > 0 && this.pacientesAsignadosIds.some(id => id === pacienteIdNum);

                    if (!estaAsignado) {
                        console.log(`[Tratamientos] ❌ Tratamiento NO asignado - Paciente ID: ${pacienteIdNum}`);
                    } else {
                        console.log(`[Tratamientos] ✅ Tratamiento asignado - Paciente ID: ${pacienteIdNum}`);
                    }

                    return estaAsignado;
                });

                console.log('[Tratamientos] Tratamientos filtrados para este doctor:', tratamientosFiltrados.length);

                // Procesar los tratamientos filtrados
                this.tratamientos = tratamientosFiltrados.map(t => {
                    // Obtener el ID del paciente del tratamiento
                    const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId;

                    // Buscar el paciente en el mapa
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
                        // Fallback: intentar usar los campos que pueda tener el tratamiento
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

                    return {
                        ...t,
                        idtratamiento: t.idtratamiento || t.IdTratamiento || t.id,
                        idpaciente: pacienteId,
                        nombreMedicamento: t.nombremedicamento || t.NombreMedicamento || 'Medicamento',
                        nombrePaciente: nombreCompleto,
                        NombrePaciente: nombreCompleto,
                        nombreCompleto: nombreCompleto,
                        paciente: nombreCompleto,
                        Paciente: nombreCompleto,
                        fechaInicio: t.fechainicio || t.FechaInicio,
                        fechaFin: t.fechafin || t.FechaFin,
                        dosis: t.dosis || t.Dosis,
                        frecuenciaHoras: t.frecuenciaHoras || t.frecuenciashoras || t.FrecuenciaHoras,
                        activo: t.activo !== undefined ? t.activo : t.Activo
                    };
                });

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

    recargarDatos() {
        this.cargarDatos();
    }
}