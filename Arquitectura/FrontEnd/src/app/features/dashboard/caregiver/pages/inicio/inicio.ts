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

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.caregiverId = userData.idusuario || userData.uid || null;
                    this.caregiverName = userData.nombre || 'Acompanante';
                    this.caregiverFullName = userData.nombreCompleto || userData.nombre || 'Acompanante';
                    this.caregiverCorreo = userData.correo || '';
                    this.userEmail = userData.correo || '';

                    console.log('Acompanante ID:', this.caregiverId);
                    console.log('Acompanante Correo:', this.caregiverCorreo);
                    console.log('Acompanante Nombre:', this.caregiverFullName);
                } catch (e) {
                    console.error('Error al parsear localStorage:', e);
                }
            }

            if (this.caregiverId) {
                await this.cargarDatos();
            } else {
                console.error('No se pudo obtener el ID del acompanante');
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
            console.log('Cargando datos del acompanante...');

            let allUsers: any[] = [];
            try {
                console.log('Obteniendo todos los usuarios...');
                allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());

                if (Array.isArray(allUsers)) {
                    console.log(allUsers.length + ' usuarios encontrados en total');

                    const todosLosPacientes = allUsers.filter(u =>
                        u.rol?.toLowerCase() === 'paciente' && u.deleted_at === null
                    );

                    console.log(todosLosPacientes.length + ' pacientes encontrados');

                    this.pacientesAsignados = todosLosPacientes.filter(paciente => {
                        const pacienteId = paciente.idusuario || paciente.id;

                        return true;
                    });

                    this.pacientesAsignadosMap.clear();
                    this.pacientesAsignados.forEach(p => {
                        const id = p.idusuario || p.id;
                        if (id) {
                            this.pacientesAsignadosMap.set(id, p);
                        }
                    });

                    console.log(this.pacientesAsignados.length + ' pacientes asignados a este acompanante');

                    this.metrics.totalPacientes = this.pacientesAsignados.length;
                }
            } catch (error) {
                console.error('Error al obtener usuarios:', error);
                this.pacientesAsignados = [];
                this.metrics.totalPacientes = 0;
            }

            let todasLasCitas: any[] = [];
            try {
                console.log('Obteniendo todas las citas...');
                todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

                if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                    console.log(todasLasCitas.length + ' citas encontradas en total');

                    const citasFiltradas = todasLasCitas.filter((c: any) => {
                        const idPaciente = c.idpaciente || c.idPaciente || c.pacienteId;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    console.log(citasFiltradas.length + ' citas de pacientes asignados');

                    this.citasProgramadas = citasFiltradas
                        .filter((c: any) => {
                            const estado = (c.estado || '').toLowerCase();
                            return !['cancelada', 'completada', 'realizada', 'finalizada'].includes(estado);
                        })
                        .map((c: any) => {
                            const nombre = c.nombrepaciente || '';
                            const apPaterno = c.appaternopaciente || '';
                            const apMaterno = c.apmaternopaciente || '';
                            const nombreCompleto = nombre + ' ' + apPaterno + ' ' + apMaterno;
                            return {
                                ...c,
                                nombrePaciente: nombreCompleto.trim() || 'Paciente',
                                paciente: nombreCompleto.trim() || 'Paciente'
                            };
                        })
                        .slice(0, 5);

                    this.citasPendientes = citasFiltradas
                        .filter((c: any) => {
                            const estado = (c.estado || '').toLowerCase();
                            return ['pendiente', 'programada', 'confirmada', 'agendada'].includes(estado);
                        })
                        .map((c: any) => {
                            const nombre = c.nombrepaciente || '';
                            const apPaterno = c.appaternopaciente || '';
                            const apMaterno = c.apmaternopaciente || '';
                            const nombreCompleto = nombre + ' ' + apPaterno + ' ' + apMaterno;
                            return {
                                ...c,
                                nombrePaciente: nombreCompleto.trim() || 'Paciente',
                                paciente: nombreCompleto.trim() || 'Paciente'
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

            let tratamientos: any[] = [];
            try {
                console.log('Obteniendo todos los tratamientos...');
                tratamientos = await firstValueFrom(this.usersService.getTratamientos());

                if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                    console.log(tratamientos.length + ' tratamientos encontrados en total');

                    const tratamientosFiltrados = tratamientos.filter((t: any) => {
                        const idPaciente = t.idpaciente || t.pacienteId;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    console.log(tratamientosFiltrados.length + ' tratamientos de pacientes asignados');

                    const activos = tratamientosFiltrados.filter((t: any) => t.activo !== false && t.activo !== 0);
                    this.metrics.tratamientosActivos = activos.length;
                    this.tratamientosActivosList = activos.slice(0, 3);
                }
            } catch (error) {
                console.error('Error al obtener tratamientos:', error);
                this.metrics.tratamientosActivos = 0;
                this.tratamientosActivosList = [];
            }

            let medicamentos: any[] = [];
            try {
                console.log('Obteniendo todos los medicamentos...');
                medicamentos = await firstValueFrom(this.usersService.getMedicamentos());

                if (Array.isArray(medicamentos) && medicamentos.length > 0) {
                    console.log(medicamentos.length + ' medicamentos encontrados en total');

                    const medicamentosFiltrados = medicamentos.filter((m: any) => {
                        const idPaciente = m.idpaciente || m.pacienteId;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    console.log(medicamentosFiltrados.length + ' medicamentos de pacientes asignados');

                    this.medicamentosList = medicamentosFiltrados.slice(0, 3);
                    this.metrics.medicamentosActivos = medicamentosFiltrados.length;
                }
            } catch (error) {
                console.error('Error al obtener medicamentos:', error);
                this.medicamentosList = [];
                this.metrics.medicamentosActivos = 0;
            }

            let dispositivos: any[] = [];
            try {
                console.log('Obteniendo todos los dispositivos...');
                dispositivos = await firstValueFrom(this.usersService.getDispositivos());

                if (Array.isArray(dispositivos) && dispositivos.length > 0) {
                    console.log(dispositivos.length + ' dispositivos encontrados en total');

                    const dispositivosFiltrados = dispositivos.filter((d: any) => {
                        const idPaciente = d.idpacienteasociado || d.idPacienteAsociado || d.pacienteId || d.idusuario;
                        return this.pacientesAsignadosMap.has(idPaciente);
                    });

                    console.log(dispositivosFiltrados.length + ' dispositivos de pacientes asignados');

                    this.dispositivosList = dispositivosFiltrados.slice(0, 3);
                    this.metrics.dispositivosActivos = dispositivosFiltrados.length;
                }
            } catch (error) {
                console.error('Error al obtener dispositivos:', error);
                this.dispositivosList = [];
                this.metrics.dispositivosActivos = 0;
            }

            console.log('Datos cargados exitosamente:', this.metrics);

        } catch (error) {
            console.error('Error al cargar datos:', error);
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