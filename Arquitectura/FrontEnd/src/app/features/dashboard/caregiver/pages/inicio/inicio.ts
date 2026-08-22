import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CaregiverMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';

@Component({
    selector: 'app-caregiver-inicio',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        CaregiverMenu
    ],
    templateUrl: './inicio.html',
    styleUrls: ['./inicio.css']
})
export class CaregiverInicio implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    caregiverName = '';
    caregiverFullName = '';
    caregiverId: number | null = null;
    caregiverCorreo: string = '';
    userEmail: string = '';

    metrics = {
        totalPacientes: 0,
        citasProgramadas: 0,
        citasPendientes: 0,
        tratamientosActivos: 0,
        medicamentosActivos: 0,
        dispositivosActivos: 0
    };

    citasProgramadas: any[] = [];
    citasPendientes: any[] = [];
    pacientesAsignados: any[] = [];
    tratamientosActivosList: any[] = [];
    medicamentosList: any[] = [];
    dispositivosList: any[] = [];

    private pacientesAsignadosMap: Map<number, any> = new Map();

    // Control para saber si hay datos reales
    tieneDatos: boolean = false;

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.caregiverId = userData.idusuario || userData.uid || null;
                    this.caregiverName = userData.nombre || 'Acompañante';
                    this.caregiverFullName = userData.nombreCompleto || userData.nombre || 'Acompañante';
                    this.caregiverCorreo = userData.correo || '';
                    this.userEmail = userData.correo || '';
                } catch (e) {
                    console.error('Error al parsear localStorage:', e);
                }
            }

            if (this.caregiverId) {
                await this.cargarDatos();
            } else {
                console.error('No se pudo obtener el ID del acompañante');
            }

        } catch (error) {
            console.error('Error en ngOnInit:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarDatos() {
        try {
            // 1. OBTENER PACIENTES ASIGNADOS REALES
            let pacientesAsignadosReal: any[] = [];
            try {
                pacientesAsignadosReal = await firstValueFrom(
                    this.usersService.getPacientesAsignados(this.caregiverId!)
                );

                if (Array.isArray(pacientesAsignadosReal) && pacientesAsignadosReal.length > 0) {
                    this.pacientesAsignados = pacientesAsignadosReal;

                    this.pacientesAsignadosMap.clear();
                    this.pacientesAsignados.forEach(p => {
                        const id = p.idusuario || p.id;
                        if (id) {
                            this.pacientesAsignadosMap.set(id, p);
                        }
                    });

                    this.metrics.totalPacientes = this.pacientesAsignados.length;
                } else {
                    this.pacientesAsignados = [];
                    this.metrics.totalPacientes = 0;
                }
            } catch (error) {
                console.error('Error al obtener pacientes asignados:', error);
                this.pacientesAsignados = [];
                this.metrics.totalPacientes = 0;
            }

            // VERIFICAR SI TIENE PACIENTES ASIGNADOS
            if (this.pacientesAsignados.length === 0) {
                this.tieneDatos = false;
                return;
            }

            this.tieneDatos = true;

            // 2. OBTENER CITAS DE PACIENTES ASIGNADOS
            let todasLasCitas: any[] = [];
            try {
                todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

                if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                    // Buscar citas de pacientes asignados por ID o por nombre
                    const citasFiltradas = todasLasCitas.filter((c: any) => {
                        // Buscar ID del paciente en múltiples campos
                        const idPaciente = c.idpaciente || c.IdPaciente || c.idPaciente || c.pacienteId || c.IdPaciente || c.id_usuario;

                        // Verificar si el ID está en el mapa
                        if (idPaciente && this.pacientesAsignadosMap.has(idPaciente)) {
                            return true;
                        }

                        // Si no tiene ID o no está en el mapa, buscar por nombre
                        const nombrePaciente = (c.nombrepaciente || c.NombrePaciente || c.nombrePaciente || '').toLowerCase().trim();
                        const apPaterno = (c.appaternopaciente || c.ApPaternoPaciente || c.apPaternoPaciente || '').toLowerCase().trim();
                        const nombreCompleto = `${nombrePaciente} ${apPaterno}`.trim();

                        // Buscar en pacientes asignados por nombre
                        for (const [id, paciente] of this.pacientesAsignadosMap) {
                            const pNombre = (paciente.nombre || '').toLowerCase().trim();
                            const pApPaterno = (paciente.apPaterno || '').toLowerCase().trim();
                            const pNombreCompleto = `${pNombre} ${pApPaterno}`.trim();

                            if (pNombreCompleto === nombreCompleto || pNombre === nombrePaciente) {
                                // Asignar el ID encontrado
                                c.idpaciente = id;
                                return true;
                            }
                        }

                        return false;
                    });

                    this.citasProgramadas = citasFiltradas
                        .filter((c: any) => {
                            const estado = (c.estado || '').toLowerCase();
                            return !['cancelada', 'completada', 'realizada', 'finalizada'].includes(estado);
                        })
                        .map((c: any) => {
                            const idPaciente = c.idpaciente || c.IdPaciente || c.idPaciente || c.pacienteId;
                            let nombreCompleto = 'Paciente';

                            // Intentar obtener nombre del mapa
                            if (idPaciente && this.pacientesAsignadosMap.has(idPaciente)) {
                                const paciente = this.pacientesAsignadosMap.get(idPaciente);
                                const nombre = paciente.nombre || '';
                                const apPaterno = paciente.apPaterno || '';
                                const apMaterno = paciente.apMaterno || '';
                                nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                                if (!nombreCompleto) {
                                    nombreCompleto = paciente.correo || 'Paciente';
                                }
                            } else {
                                // Usar el nombre de la cita
                                const nombre = c.nombrepaciente || c.NombrePaciente || c.nombrePaciente || '';
                                const apPaterno = c.appaternopaciente || c.ApPaternoPaciente || c.apPaternoPaciente || '';
                                const apMaterno = c.apmaternopaciente || c.ApMaternoPaciente || c.apMaternoPaciente || '';
                                nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                                if (!nombreCompleto) {
                                    nombreCompleto = 'Paciente';
                                }
                            }

                            return {
                                ...c,
                                nombrePaciente: nombreCompleto,
                                paciente: nombreCompleto
                            };
                        })
                        .slice(0, 5);

                    this.citasPendientes = citasFiltradas
                        .filter((c: any) => {
                            const estado = (c.estado || '').toLowerCase();
                            return ['pendiente', 'programada', 'confirmada', 'agendada'].includes(estado);
                        })
                        .map((c: any) => {
                            const idPaciente = c.idpaciente || c.IdPaciente || c.idPaciente || c.pacienteId;
                            let nombreCompleto = 'Paciente';

                            if (idPaciente && this.pacientesAsignadosMap.has(idPaciente)) {
                                const paciente = this.pacientesAsignadosMap.get(idPaciente);
                                const nombre = paciente.nombre || '';
                                const apPaterno = paciente.apPaterno || '';
                                const apMaterno = paciente.apMaterno || '';
                                nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                                if (!nombreCompleto) {
                                    nombreCompleto = paciente.correo || 'Paciente';
                                }
                            } else {
                                const nombre = c.nombrepaciente || c.NombrePaciente || c.nombrePaciente || '';
                                const apPaterno = c.appaternopaciente || c.ApPaternoPaciente || c.apPaternoPaciente || '';
                                const apMaterno = c.apmaternopaciente || c.ApMaternoPaciente || c.apMaternoPaciente || '';
                                nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                                if (!nombreCompleto) {
                                    nombreCompleto = 'Paciente';
                                }
                            }

                            return {
                                ...c,
                                nombrePaciente: nombreCompleto,
                                paciente: nombreCompleto
                            };
                        });

                    this.metrics.citasProgramadas = this.citasProgramadas.length;
                    this.metrics.citasPendientes = this.citasPendientes.length;
                }
            } catch (error) {
                console.error('Error al obtener citas:', error);
                this.citasProgramadas = [];
                this.citasPendientes = [];
                this.metrics.citasProgramadas = 0;
                this.metrics.citasPendientes = 0;
            }

            // 3. OBTENER TRATAMIENTOS DE PACIENTES ASIGNADOS
            let tratamientos: any[] = [];
            try {
                tratamientos = await firstValueFrom(this.usersService.getTratamientos());

                if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                    const tratamientosFiltrados = tratamientos.filter((t: any) => {
                        const idPaciente = t.idpaciente || t.IdPaciente || t.idPaciente || t.pacienteId;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    const activos = tratamientosFiltrados.filter((t: any) => t.activo !== false && t.activo !== 0);
                    this.metrics.tratamientosActivos = activos.length;
                    this.tratamientosActivosList = activos.slice(0, 3);
                }
            } catch (error) {
                console.error('Error al obtener tratamientos:', error);
                this.metrics.tratamientosActivos = 0;
                this.tratamientosActivosList = [];
            }

            // 4. OBTENER MEDICAMENTOS
            let medicamentos: any[] = [];
            try {
                medicamentos = await firstValueFrom(this.usersService.getMedicamentos());

                if (Array.isArray(medicamentos) && medicamentos.length > 0) {
                    const medicamentosFiltrados = medicamentos.filter((m: any) => {
                        const idPaciente = m.idpaciente || m.pacienteId;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    this.medicamentosList = medicamentosFiltrados.slice(0, 3);
                    this.metrics.medicamentosActivos = medicamentosFiltrados.length;
                }
            } catch (error) {
                console.error('Error al obtener medicamentos:', error);
                this.medicamentosList = [];
                this.metrics.medicamentosActivos = 0;
            }

            // 5. OBTENER DISPOSITIVOS
            let dispositivos: any[] = [];
            try {
                dispositivos = await firstValueFrom(this.usersService.getDispositivos());

                if (Array.isArray(dispositivos) && dispositivos.length > 0) {
                    const dispositivosFiltrados = dispositivos.filter((d: any) => {
                        const idPaciente = d.idpacienteasociado || d.idPacienteAsociado || d.pacienteId || d.idusuario;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    this.dispositivosList = dispositivosFiltrados.slice(0, 3);
                    this.metrics.dispositivosActivos = dispositivosFiltrados.length;
                }
            } catch (error) {
                console.error('Error al obtener dispositivos:', error);
                this.dispositivosList = [];
                this.metrics.dispositivosActivos = 0;
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.tieneDatos = false;
        }
    }

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = (nombre || '') + ' ' + (apPaterno || '');
        return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name.trim()) + '&background=b0001e&color=fff&bold=true';
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
            this.router.navigate(['/caregiver/citas/detalle', idCita]);
        }
    }

    verDetallePaciente(paciente: any) {
        const idPaciente = paciente.idusuario || paciente.id || paciente.uid;
        if (idPaciente) {
            this.router.navigate(['/caregiver/pacientes/detalle', idPaciente]);
        }
    }
}