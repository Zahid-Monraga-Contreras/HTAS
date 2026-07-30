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
            // Obtener todos los usuarios para contar pacientes y crear mapa
            let allUsers: any[] = [];
            try {
                allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());
                if (Array.isArray(allUsers)) {
                    // Crear mapa de pacientes por ID para obtener nombres completos
                    this.pacientesMap.clear();
                    const pacientes = allUsers.filter(u => u.rol?.toLowerCase() === 'paciente');

                    pacientes.forEach(p => {
                        const id = p.idusuario || p.id;
                        if (id) {
                            this.pacientesMap.set(id, p);
                        }
                    });

                    this.metrics.totalPacientes = pacientes.length;

                    // Pacientes recientes con nombre completo
                    this.pacientesRecientes = pacientes.slice(0, 4).map(p => {
                        const nombre = p.nombre || '';
                        const apPaterno = p.apPaterno || '';
                        const apMaterno = p.apMaterno || '';
                        const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim() || p.correo || 'Paciente';
                        return {
                            ...p,
                            nombreCompleto: nombreCompleto
                        };
                    });
                }
            } catch (error) {
                console.error('Error al obtener usuarios:', error);
            }

            // Obtener todas las citas
            let todasLasCitas: any[] = [];
            try {
                todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());
            } catch (error) {
                console.error('Error al obtener citas:', error);
            }

            // Obtener tratamientos
            let tratamientos: any[] = [];
            try {
                tratamientos = await firstValueFrom(this.usersService.getTratamientos());
            } catch (error) {
                console.error('Error al obtener tratamientos:', error);
            }

            // Procesar citas - Mostrar TODAS las citas programadas con nombre completo
            if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                // Citas programadas: todas las que no están canceladas ni completadas
                this.citasProgramadas = todasLasCitas
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
                            // Fallback: usar el campo paciente si existe
                            nombreCompleto = c.paciente || c.pacienteNombre || c.nombrePaciente || 'Paciente';
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

                // Citas pendientes
                this.citasPendientes = todasLasCitas
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
                            nombreCompleto = c.paciente || c.pacienteNombre || c.nombrePaciente || 'Paciente';
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
            } else {
                this.citasProgramadas = [];
                this.citasPendientes = [];
                this.metrics.citasProgramadas = 0;
                this.metrics.citasPendientes = 0;
            }

            // Procesar tratamientos
            if (Array.isArray(tratamientos) && tratamientos.length > 0) {
                const activos = tratamientos.filter((t: any) => t.activo !== false && t.activo !== 0);
                this.metrics.tratamientosActivos = activos.length;
                this.tratamientosActivosList = activos.slice(0, 3);
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
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
        const idPaciente = paciente.idusuario || paciente.id || paciente.uid;
        if (idPaciente) {
            this.router.navigate(['/doctor/pacientes/detalle', idPaciente]);
        }
    }
}