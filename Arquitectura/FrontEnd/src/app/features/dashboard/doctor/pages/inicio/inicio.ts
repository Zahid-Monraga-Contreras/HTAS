import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { DoctorMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';

@Component({
    selector: 'app-doctor-inicio',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        DoctorMenu
    ],
    templateUrl: './inicio.html',
    styleUrls: ['./inicio.css']
})
export class DoctorInicio implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    doctorName = '';
    doctorFullName = '';
    doctorId: number | null = null;
    userEmail: string = '';

    // Lista de pacientes asignados al doctor
    pacientesAsignadosIds: number[] = [];
    pacientesAsignados: any[] = [];
    pacientesAsignadosEmails: string[] = [];

    // Mapa de pacientes para obtener nombres completos
    private pacientesMap: Map<number, any> = new Map();

    metrics = {
        totalPacientes: 0,
        citasProgramadas: 0,
        citasPendientes: 0,
        tratamientosActivos: 0,
        pacientesAtendidos: 0
    };

    citasProgramadas: any[] = [];
    citasPendientes: any[] = [];
    pacientesRecientes: any[] = [];
    tratamientosActivosList: any[] = [];

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.doctorId = userData.idusuario || userData.uid || null;
                    this.doctorName = userData.nombre || 'Doctor';
                    this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                    this.userEmail = userData.correo || '';
                } catch (e) {
                    console.error('Error al parsear localStorage:', e);
                }
            }

            if (!this.doctorId) {
                console.error('No se pudo identificar al doctor');
                this.isLoading = false;
                return;
            }

            await this.cargarDatos();

        } catch (error) {
            console.error('Error en ngOnInit:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarDatos() {
        try {
            // 1. Cargar pacientes asignados al doctor
            await this.cargarPacientesAsignados();

            // 2. Cargar todos los usuarios para crear mapa de pacientes
            await this.cargarMapaPacientes();

            // 3. Cargar citas SOLO de pacientes asignados
            await this.cargarCitas();

            // 4. Cargar tratamientos SOLO de pacientes asignados
            await this.cargarTratamientos();

        } catch (error) {
            console.error('Error al cargar datos:', error);
        }
    }

    // ============================================================
    // CARGAR PACIENTES ASIGNADOS AL DOCTOR
    // ============================================================
    private async cargarPacientesAsignados() {
        if (!this.doctorId) return;

        try {
            console.log('[Inicio] Cargando pacientes asignados al doctor:', this.doctorId);

            let response = null;
            let pacientesData: any[] = [];

            // Intentar getPacientesDeDoctor
            try {
                response = await firstValueFrom(
                    this.usersService.getPacientesDeDoctor(this.doctorId)
                );
                console.log('[Inicio] Respuesta getPacientesDeDoctor:', response);
            } catch (err) {
                console.warn('[Inicio] getPacientesDeDoctor falló:', err);
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
                console.log('[Inicio] Usando fallback con getTodosLosPacientes...');
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

                    console.log('[Inicio] Pacientes filtrados por asignación:', pacientesData.length);

                } catch (err) {
                    console.warn('[Inicio] Falló la carga alternativa:', err);
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

            // Extraer emails de pacientes asignados
            this.pacientesAsignadosEmails = pacientesData
                .map((p: any) => p.correo || p.Correo || p.email || p.Email || '')
                .filter((email: string) => email && email.length > 0);

            console.log('[Inicio] IDs de pacientes asignados:', this.pacientesAsignadosIds);
            console.log('[Inicio] Emails de pacientes asignados:', this.pacientesAsignadosEmails);

            // Actualizar métrica de pacientes totales
            this.metrics.totalPacientes = this.pacientesAsignadosIds.length;

            // Crear lista de pacientes recientes (los primeros 4)
            this.pacientesRecientes = pacientesData.slice(0, 4).map((p: any) => {
                const nombre = p.nombre || p.Nombre || '';
                const apPaterno = p.apellido_paterno || p.apPaterno || p.ApPaterno || '';
                const apMaterno = p.apellido_materno || p.apMaterno || p.ApMaterno || '';
                const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim() || p.correo || 'Paciente';
                return {
                    ...p,
                    idusuario: p.id_usuario || p.IdUsuario || p.idusuario || p.id,
                    nombreCompleto: nombreCompleto
                };
            });

            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Inicio] No se encontraron pacientes asignados para este doctor');
            }

        } catch (error: any) {
            console.error('[Inicio] Error cargando pacientes asignados:', error);
            this.pacientesAsignadosIds = [];
            this.pacientesAsignados = [];
            this.pacientesAsignadosEmails = [];
        }
    }

    // ============================================================
    // CARGAR MAPA DE PACIENTES
    // ============================================================
    private async cargarMapaPacientes() {
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

                console.log('[Inicio] Pacientes cargados en mapa:', this.pacientesMap.size);
            }
        } catch (error) {
            console.error('Error al cargar mapa de pacientes:', error);
        }
    }

    // ============================================================
    // CARGAR CITAS SOLO DE PACIENTES ASIGNADOS - CORREGIDO
    // ============================================================
    private async cargarCitas() {
        try {
            // Si no hay pacientes asignados, no mostrar citas
            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Inicio] No hay pacientes asignados, no se muestran citas');
                this.citasProgramadas = [];
                this.citasPendientes = [];
                this.metrics.citasProgramadas = 0;
                this.metrics.citasPendientes = 0;
                return;
            }

            const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

            if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                console.log('[Inicio] Total de citas obtenidas:', todasLasCitas.length);

                // Filtrar citas de pacientes asignados - BUSCANDO EN MÚLTIPLES FORMATOS
                const citasAsignadas = todasLasCitas.filter((c: any) => {
                    // Intentar obtener el ID del paciente de la cita en múltiples formatos
                    const posiblesIds = [
                        c.idpaciente, c.IdPaciente, c.idPaciente,
                        c.pacienteId, c.id_usuario, c.IdUsuario,
                        c.idusuario, c.paciente_id, c.pacienteId
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

                    // Si encontramos un ID válido, verificar si está en la lista de asignados
                    if (idPacienteCitaNum && idPacienteCitaNum > 0) {
                        const estaAsignado = this.pacientesAsignadosIds.some(id => id === idPacienteCitaNum);
                        if (estaAsignado) {
                            console.log(`[Inicio] ✅ Cita asignada por ID: ${idPacienteCitaNum}`);
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
                            console.log(`[Inicio] ✅ Cita asignada por correo: ${correoPaciente}`);
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

                            // Si el nombre completo coincide o es similar
                            if (pNombreCompleto && pNombreCompleto.length > 0) {
                                return nombreCompleto === pNombreCompleto ||
                                    nombreCompleto.includes(pNombreCompleto) ||
                                    pNombreCompleto.includes(nombreCompleto);
                            }
                            return false;
                        });
                        if (estaAsignado) {
                            console.log(`[Inicio] ✅ Cita asignada por nombre: ${nombreCompleto}`);
                            return true;
                        }
                    }

                    console.log(`[Inicio] ❌ Cita NO asignada: ID=${idPacienteCitaNum}, Nombre=${nombreCompleto}`);
                    return false;
                });

                console.log('[Inicio] Citas de pacientes asignados:', citasAsignadas.length);

                // Citas programadas: todas las que no están canceladas ni completadas
                this.citasProgramadas = citasAsignadas
                    .filter((c: any) => {
                        const estado = (c.estado || '').toLowerCase();
                        return !['cancelada', 'completada', 'realizada', 'finalizada'].includes(estado);
                    })
                    .map((c: any) => {
                        // Construir nombre completo del paciente de la cita
                        const nombre = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
                        const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
                        const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';

                        let nombreCompleto = '';
                        if (nombre || apPaterno || apMaterno) {
                            nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        } else {
                            // Buscar en el mapa de pacientes
                            const pacienteId = c.idpaciente || c.IdPaciente || c.idPaciente || c.pacienteId || c.id_usuario;
                            const paciente = this.pacientesMap.get(pacienteId);
                            if (paciente) {
                                const pNombre = paciente.nombre || '';
                                const pApPaterno = paciente.apPaterno || '';
                                const pApMaterno = paciente.apMaterno || '';
                                nombreCompleto = `${pNombre} ${pApPaterno} ${pApMaterno}`.trim() || 'Paciente';
                            } else {
                                nombreCompleto = c.paciente || c.pacienteNombre || c.nombrePaciente || 'Paciente';
                            }
                        }

                        if (!nombreCompleto || nombreCompleto.trim() === '') {
                            nombreCompleto = 'Paciente';
                        }

                        return {
                            ...c,
                            id: c.idcita || c.id,
                            nombrePaciente: nombreCompleto,
                            paciente: nombreCompleto
                        };
                    })
                    .slice(0, 5);

                // Citas pendientes (programadas + confirmadas)
                this.citasPendientes = citasAsignadas
                    .filter((c: any) => {
                        const estado = (c.estado || '').toLowerCase();
                        return ['pendiente', 'programada', 'confirmada', 'agendada'].includes(estado);
                    })
                    .map((c: any) => {
                        const nombre = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
                        const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
                        const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';

                        let nombreCompleto = '';
                        if (nombre || apPaterno || apMaterno) {
                            nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        } else {
                            const pacienteId = c.idpaciente || c.IdPaciente || c.idPaciente || c.pacienteId || c.id_usuario;
                            const paciente = this.pacientesMap.get(pacienteId);
                            if (paciente) {
                                const pNombre = paciente.nombre || '';
                                const pApPaterno = paciente.apPaterno || '';
                                const pApMaterno = paciente.apMaterno || '';
                                nombreCompleto = `${pNombre} ${pApPaterno} ${pApMaterno}`.trim() || 'Paciente';
                            } else {
                                nombreCompleto = c.paciente || c.pacienteNombre || c.nombrePaciente || 'Paciente';
                            }
                        }

                        if (!nombreCompleto || nombreCompleto.trim() === '') {
                            nombreCompleto = 'Paciente';
                        }

                        return {
                            ...c,
                            id: c.idcita || c.id,
                            nombrePaciente: nombreCompleto,
                            paciente: nombreCompleto
                        };
                    });

                this.metrics.citasProgramadas = this.citasProgramadas.length;
                this.metrics.citasPendientes = this.citasPendientes.length;

                console.log('[Inicio] Citas programadas:', this.citasProgramadas.length);
                console.log('[Inicio] Citas pendientes:', this.citasPendientes.length);

            } else {
                this.citasProgramadas = [];
                this.citasPendientes = [];
                this.metrics.citasProgramadas = 0;
                this.metrics.citasPendientes = 0;
            }
        } catch (error) {
            console.error('Error al cargar citas:', error);
            this.citasProgramadas = [];
            this.citasPendientes = [];
            this.metrics.citasProgramadas = 0;
            this.metrics.citasPendientes = 0;
        }
    }

    // ============================================================
    // CARGAR TRATAMIENTOS SOLO DE PACIENTES ASIGNADOS
    // ============================================================
    private async cargarTratamientos() {
        try {
            // Si no hay pacientes asignados, no mostrar tratamientos
            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Inicio] No hay pacientes asignados, no se muestran tratamientos');
                this.tratamientosActivosList = [];
                this.metrics.tratamientosActivos = 0;
                return;
            }

            const tratamientos = await firstValueFrom(this.usersService.getTratamientos());

            if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                console.log('[Inicio] Total de tratamientos obtenidos:', tratamientos.length);

                // Filtrar tratamientos de pacientes asignados
                const tratamientosAsignados = tratamientos.filter((t: any) => {
                    const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId || t.id_usuario;
                    const pacienteIdNum = typeof pacienteId === 'string' ? parseInt(pacienteId, 10) : pacienteId;
                    return pacienteIdNum > 0 && this.pacientesAsignadosIds.some(id => id === pacienteIdNum);
                });

                console.log('[Inicio] Tratamientos de pacientes asignados:', tratamientosAsignados.length);

                // Tratamientos activos
                const activos = tratamientosAsignados.filter((t: any) => t.activo !== false && t.activo !== 0);
                this.metrics.tratamientosActivos = activos.length;
                this.tratamientosActivosList = activos.slice(0, 3).map((t: any) => {
                    // Buscar nombre del paciente
                    const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId;
                    const paciente = this.pacientesMap.get(pacienteId);
                    let nombrePaciente = 'Paciente';
                    if (paciente) {
                        const nombre = paciente.nombre || '';
                        const apPaterno = paciente.apPaterno || '';
                        const apMaterno = paciente.apMaterno || '';
                        nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'Paciente';
                    }
                    return {
                        ...t,
                        nombrePaciente: nombrePaciente,
                        nombreMedicamento: t.nombremedicamento || t.NombreMedicamento || 'Medicamento'
                    };
                });

                // Pacientes atendidos (con al menos un tratamiento activo)
                const pacientesConTratamiento = new Set();
                tratamientosAsignados.forEach((t: any) => {
                    if (t.activo !== false && t.activo !== 0) {
                        const pacienteId = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId;
                        if (pacienteId) {
                            pacientesConTratamiento.add(pacienteId);
                        }
                    }
                });
                this.metrics.pacientesAtendidos = pacientesConTratamiento.size;

            } else {
                this.tratamientosActivosList = [];
                this.metrics.tratamientosActivos = 0;
                this.metrics.pacientesAtendidos = 0;
            }
        } catch (error) {
            console.error('Error al cargar tratamientos:', error);
            this.tratamientosActivosList = [];
            this.metrics.tratamientosActivos = 0;
            this.metrics.pacientesAtendidos = 0;
        }
    }

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = `${nombre || ''} ${apPaterno || ''}`.trim();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
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

    getEstadoClass(estado: string): string {
        if (!estado) return 'badge-info';
        const estadoLower = estado.toLowerCase();
        switch (estadoLower) {
            case 'completada':
            case 'realizada':
            case 'finalizada':
                return 'badge-success';
            case 'programada':
            case 'pendiente':
            case 'confirmada':
            case 'agendada':
                return 'badge-warning';
            case 'cancelada':
                return 'badge-danger';
            default:
                return 'badge-info';
        }
    }

    verDetalleCita(cita: any) {
        const idCita = cita.idcita || cita.id;
        if (idCita) {
            this.router.navigate(['/doctor/citas/detalle', idCita]);
        }
    }

    verDetallePaciente(paciente: any) {
        const idPaciente = paciente.idusuario || paciente.id || paciente.uid || paciente.id_usuario;
        if (idPaciente) {
            this.router.navigate(['/doctor/pacientes/detalle', idPaciente]);
        }
    }

    recargarDatos() {
        this.cargarDatos();
    }
}