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

    // Lista de pacientes asignados al doctor
    pacientesAsignadosIds: number[] = [];
    pacientesAsignados: any[] = [];

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

            if (!this.doctorId) {
                this.showError('Error', 'No se pudo identificar al doctor.');
                this.isLoading = false;
                return;
            }

            // 1. Cargar pacientes asignados al doctor
            await this.cargarPacientesAsignados();

            // 2. Cargar dispositivos SOLO de pacientes asignados
            await this.cargarDispositivos();

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los dispositivos.');
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
            console.log('[Dispositivos] Cargando pacientes asignados al doctor:', this.doctorId);

            let response = null;
            let pacientesData: any[] = [];

            // Intentar getPacientesDeDoctor
            try {
                response = await firstValueFrom(
                    this.usersService.getPacientesDeDoctor(this.doctorId)
                );
                console.log('[Dispositivos] Respuesta getPacientesDeDoctor:', response);
            } catch (err) {
                console.warn('[Dispositivos] getPacientesDeDoctor falló:', err);
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
                console.log('[Dispositivos] Usando fallback con getTodosLosPacientes...');
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

                    console.log('[Dispositivos] Pacientes filtrados por asignación:', pacientesData.length);

                } catch (err) {
                    console.warn('[Dispositivos] Falló la carga alternativa:', err);
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

            console.log('[Dispositivos] IDs de pacientes asignados:', this.pacientesAsignadosIds);

            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Dispositivos] No se encontraron pacientes asignados para este doctor');
            }

        } catch (error: any) {
            console.error('[Dispositivos] Error cargando pacientes asignados:', error);
            this.pacientesAsignadosIds = [];
            this.pacientesAsignados = [];
        }
    }

    // ============================================================
    // CARGAR DISPOSITIVOS SOLO DE PACIENTES ASIGNADOS
    // ============================================================
    private async cargarDispositivos() {
        try {
            // Si no hay pacientes asignados, no mostrar dispositivos
            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Dispositivos] No hay pacientes asignados, no se muestran dispositivos');
                this.dispositivos = [];
                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
                return;
            }

            const data = await firstValueFrom(this.usersService.getDispositivos());

            if (Array.isArray(data)) {
                console.log('[Dispositivos] Total de dispositivos obtenidos:', data.length);

                // FILTRAR: Solo dispositivos de pacientes asignados al doctor
                const dispositivosFiltrados = data.filter(d => {
                    const pacienteId = d.idpacienteasociado || d.idPacienteAsociado || d.pacienteId;
                    const pacienteIdNum = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;

                    // Si no tiene paciente asignado, no se muestra (solo dispositivos asignados)
                    if (!pacienteIdNum || pacienteIdNum === 0) {
                        return false;
                    }

                    // Verificar si este paciente está en la lista de asignados
                    const estaAsignado = this.pacientesAsignadosIds.some(id => id === pacienteIdNum);

                    if (!estaAsignado) {
                        console.log(`[Dispositivos] ❌ Dispositivo NO asignado - Paciente ID: ${pacienteIdNum}`);
                    } else {
                        console.log(`[Dispositivos] ✅ Dispositivo asignado - Paciente ID: ${pacienteIdNum}`);
                    }

                    return estaAsignado;
                });

                console.log('[Dispositivos] Dispositivos filtrados para este doctor:', dispositivosFiltrados.length);

                // Procesar los dispositivos filtrados
                this.dispositivos = dispositivosFiltrados.map(d => {
                    // Buscar el nombre del paciente en la lista de asignados
                    const paciente = this.pacientesAsignados.find(p => {
                        const id = p.id_usuario || p.IdUsuario || p.idusuario || p.id || p.IdPaciente || p.idpaciente || p.pacienteId;
                        const pacienteId = d.idpacienteasociado || d.idPacienteAsociado || d.pacienteId;
                        return id === pacienteId;
                    });

                    let nombrePaciente = 'Sin asignar';
                    if (paciente) {
                        const nombre = paciente.nombre || paciente.Nombre || '';
                        const apPaterno = paciente.apellido_paterno || paciente.apPaterno || paciente.ApPaterno || '';
                        const apMaterno = paciente.apellido_materno || paciente.apMaterno || paciente.ApMaterno || '';
                        nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'Paciente';
                    }

                    return {
                        ...d,
                        iddispositivo: d.iddispositivo || d.IdDispositivo || d.id,
                        nombre: d.nombre || 'Dispositivo sin nombre',
                        direccionmac: d.direccionmac || d.direccionMac || 'No especificada',
                        idpacienteasociado: d.idpacienteasociado || d.idPacienteAsociado || d.pacienteId,
                        activo: d.activo !== false,
                        ultimasincronizacion: d.ultimasincronizacion || null,
                        nombrepaciente: nombrePaciente
                    };
                });

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

    private calcularEstadisticas() {
        this.estadisticas.total = this.dispositivos.length;
        this.estadisticas.activos = this.dispositivos.filter(d => d.activo === true).length;
        this.estadisticas.inactivos = this.dispositivos.filter(d => d.activo === false).length;

        // Dispositivos sin asignar (siempre serán 0 porque filtramos)
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

    recargarDatos() {
        this.cargarDatos();
    }
}