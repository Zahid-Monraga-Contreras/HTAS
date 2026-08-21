import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { DoctorMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-doctor-citas',
    standalone: true,
    imports: [CommonModule, RouterModule, DoctorMenu],
    templateUrl: './citas.html',
    styleUrls: ['./citas.css']
})
export class DoctorCitas implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    userEmail: string = '';
    doctorName: string = '';
    doctorFullName: string = '';
    doctorId: number | null = null;

    // Lista de pacientes asignados al doctor (con información completa)
    pacientesAsignados: any[] = [];
    pacientesAsignadosIds: number[] = [];
    pacientesAsignadosEmails: string[] = [];

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
                this.userEmail = userData.correo || '';
                this.doctorName = userData.nombre || 'Doctor';
                this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            if (!this.doctorId) {
                console.error('No se pudo identificar al doctor');
                this.isLoading = false;
                return;
            }

            // 1. Primero cargar los pacientes asignados al doctor
            await this.cargarPacientesAsignados();

            // 2. Luego cargar las citas y filtrar por pacientes asignados
            await this.cargarCitas();

        } catch (error) {
            console.error('Error al cargar datos:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // CARGAR PACIENTES ASIGNADOS AL DOCTOR
    // ============================================================
    async cargarPacientesAsignados() {
        if (!this.doctorId) return;

        try {
            console.log('[Citas] Cargando pacientes asignados al doctor:', this.doctorId);

            let response = null;
            let pacientesData: any[] = [];

            // Intentar getPacientesDeDoctor
            try {
                response = await firstValueFrom(
                    this.usersService.getPacientesDeDoctor(this.doctorId)
                );
                console.log('[Citas] Respuesta getPacientesDeDoctor:', response);
            } catch (err) {
                console.warn('[Citas] getPacientesDeDoctor falló:', err);
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
                console.log('[Citas] Usando fallback con getTodosLosPacientes...');
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

                    console.log('[Citas] Pacientes filtrados por asignación:', pacientesData.length);

                } catch (err) {
                    console.warn('[Citas] Falló la carga alternativa:', err);
                }
            }

            // Almacenar pacientes con toda su información
            this.pacientesAsignados = pacientesData;

            // Extraer IDs de pacientes (en todos los formatos posibles)
            this.pacientesAsignadosIds = pacientesData
                .map((p: any) => {
                    const id = p.id_usuario || p.IdUsuario || p.idusuario || p.id || p.IdPaciente || p.idpaciente || p.pacienteId;
                    return typeof id === 'string' ? parseInt(id, 10) : id;
                })
                .filter((id: number) => id > 0);

            // Extraer emails de pacientes para matching adicional
            this.pacientesAsignadosEmails = pacientesData
                .map((p: any) => p.correo || p.Correo || p.email || p.Email || '')
                .filter((email: string) => email && email.length > 0);

            console.log('[Citas] IDs de pacientes asignados:', this.pacientesAsignadosIds);
            console.log('[Citas] Emails de pacientes asignados:', this.pacientesAsignadosEmails);

            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Citas] No se encontraron pacientes asignados para este doctor');
            }

        } catch (error: any) {
            console.error('[Citas] Error cargando pacientes asignados:', error);
            this.pacientesAsignadosIds = [];
            this.pacientesAsignadosEmails = [];
        }
    }

    // ============================================================
    // CARGAR CITAS Y FILTRAR POR PACIENTES ASIGNADOS
    // ============================================================
    private async cargarCitas() {
        try {
            const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

            console.log('[Citas] Todas las citas obtenidas:', todasLasCitas?.length || 0);

            // Si no hay citas, salir
            if (!todasLasCitas || !Array.isArray(todasLasCitas) || todasLasCitas.length === 0) {
                this.citas = [];
                this.calcularEstadisticas();
                this.aplicarFiltro('todas');
                return;
            }

            // Si no hay pacientes asignados, no mostrar citas
            if (this.pacientesAsignadosIds.length === 0) {
                console.log('[Citas] No hay pacientes asignados, no se muestran citas');
                this.citas = [];
                this.calcularEstadisticas();
                this.aplicarFiltro('todas');
                return;
            }

            console.log('[Citas] Total de citas sin filtrar:', todasLasCitas.length);

            // FILTRAR: Solo citas de pacientes asignados al doctor
            const citasFiltradas = todasLasCitas.filter((c: any) => {
                // Buscar el ID del paciente en la cita (en todos los formatos posibles)
                const posiblesIds = [
                    c.idpaciente, c.IdPaciente, c.idPaciente,
                    c.pacienteId, c.id_usuario, c.IdUsuario,
                    c.idusuario, c.id
                ];

                let idPacienteCita = null;
                for (const pid of posiblesIds) {
                    if (pid !== undefined && pid !== null) {
                        idPacienteCita = pid;
                        break;
                    }
                }

                // Si encontramos ID, convertir a número
                let idPacienteCitaNum = null;
                if (idPacienteCita !== null && idPacienteCita !== undefined) {
                    idPacienteCitaNum = typeof idPacienteCita === 'string' ? parseInt(idPacienteCita, 10) : idPacienteCita;
                }

                // Buscar el correo del paciente en la cita
                const correoPaciente = c.correopaciente || c.correoPaciente || c.CorreoPaciente ||
                    c.emailPaciente || c.email || c.correo || c.Correo;

                console.log(`[Citas] Verificando cita - ID Paciente: ${idPacienteCitaNum}, Correo: ${correoPaciente}`);

                // Verificar si el ID del paciente está en la lista de asignados
                let esAsignado = false;

                if (idPacienteCitaNum && idPacienteCitaNum > 0) {
                    esAsignado = this.pacientesAsignadosIds.some(id => id === idPacienteCitaNum);
                    if (esAsignado) {
                        console.log(`[Citas] ✅ Cita asignada por ID: ${idPacienteCitaNum}`);
                        return true;
                    }
                }

                // Si no se encontró por ID, intentar por correo
                if (!esAsignado && correoPaciente) {
                    esAsignado = this.pacientesAsignadosEmails.some(
                        email => email && email.toLowerCase() === correoPaciente.toLowerCase()
                    );
                    if (esAsignado) {
                        console.log(`[Citas] ✅ Cita asignada por correo: ${correoPaciente}`);
                        return true;
                    }
                }

                // Si no se encontró por ID ni por correo, intentar verificar si el paciente 
                // está en la lista de pacientes asignados por nombre
                if (!esAsignado) {
                    const nombrePaciente = c.nombrepaciente || c.nombrePaciente || c.NombrePaciente || '';
                    const apPaterno = c.appaternopaciente || c.apPaternoPaciente || c.ApPaternoPaciente || '';
                    const apMaterno = c.apmaternopaciente || c.apMaternoPaciente || c.ApMaternoPaciente || '';
                    const nombreCompleto = `${nombrePaciente} ${apPaterno} ${apMaterno}`.trim().toLowerCase();

                    if (nombreCompleto && nombreCompleto.length > 0) {
                        // Buscar en pacientes asignados por nombre
                        esAsignado = this.pacientesAsignados.some((p: any) => {
                            const pNombre = p.nombre || p.Nombre || '';
                            const pApPaterno = p.apellido_paterno || p.apPaterno || p.ApPaterno || p.appaterno || '';
                            const pApMaterno = p.apellido_materno || p.apMaterno || p.ApMaterno || p.apmaterno || '';
                            const pNombreCompleto = `${pNombre} ${pApPaterno} ${pApMaterno}`.trim().toLowerCase();
                            return pNombreCompleto && nombreCompleto.includes(pNombreCompleto) ||
                                pNombreCompleto.includes(nombreCompleto);
                        });
                        if (esAsignado) {
                            console.log(`[Citas] ✅ Cita asignada por nombre: ${nombreCompleto}`);
                            return true;
                        }
                    }
                }

                console.log(`[Citas] ❌ Cita NO asignada: ID=${idPacienteCitaNum}, Correo=${correoPaciente}`);
                return false;
            });

            console.log('[Citas] Citas filtradas para este doctor:', citasFiltradas.length);
            console.log('[Citas] IDs de citas filtradas:', citasFiltradas.map((c: any) => c.idcita || c.id));

            // Procesar las citas filtradas
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

                return {
                    ...c,
                    id: c.idcita || c.id,
                    fechacita: c.fechacita || c.fecha || c.fechaCita,
                    horacita: c.horacita || c.hora || c.horaCita,
                    paciente: nombreCompleto,
                    nombrePaciente: nombreCompleto,
                    NombrePaciente: nombreCompleto,
                    pacienteNombre: nombreCompleto,
                    especialidad: c.especialidad || c.Especialidad || 'General'
                };
            });

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

        } catch (error) {
            console.error('Error al cargar citas:', error);
            this.citas = [];
            this.calcularEstadisticas();
            this.aplicarFiltro('todas');
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

        // Citas próximas (futuras)
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
            if (isNaN(d.getTime())) return fecha;
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
            if (isNaN(d.getTime())) return '';
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
            if (isNaN(d.getTime())) return '??';
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

    verDetalleCita(cita: any) {
        const idCita = cita.idcita || cita.id;
        if (idCita) {
            this.router.navigate(['/doctor/citas/detalle', idCita]);
        }
    }

    recargarDatos() {
        this.cargarDatos();
    }
}