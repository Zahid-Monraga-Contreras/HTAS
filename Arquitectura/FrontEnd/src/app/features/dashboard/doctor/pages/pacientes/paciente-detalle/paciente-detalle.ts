import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

@Component({
    selector: 'app-doctor-paciente-detalle',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        DoctorMenu
    ],
    templateUrl: './paciente-detalle.html',
    styleUrls: ['./paciente-detalle.css']
})
export class DoctorPacienteDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    pacienteId: number | null = null;
    paciente: any = null;

    activeTab: 'info' | 'citas' | 'tratamientos' | 'medicaciones' = 'info';

    citasPaciente: any[] = [];
    tratamientosPaciente: any[] = [];
    medicacionesPaciente: any[] = [];
    medicionesPaciente: any[] = [];

    stats = {
        totalCitas: 0,
        citasCompletadas: 0,
        tratamientosActivos: 0,
        medicacionesActivas: 0
    };

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.route.params.subscribe(params => {
            this.pacienteId = +params['id'];
            if (this.pacienteId) {
                this.cargarPaciente(this.pacienteId);
            }
        });
    }

    async cargarPaciente(id: number) {
        this.isLoading = true;
        try {
            const pacienteData = await firstValueFrom(this.usersService.getUsuarioById(id));
            this.paciente = pacienteData;

            const todasCitas = await firstValueFrom(this.usersService.getAllCitas());
            if (Array.isArray(todasCitas)) {
                this.citasPaciente = todasCitas.filter((c: any) => {
                    const emailPaciente = (c.correopaciente || c.correoPaciente || c.email || '').toLowerCase().trim();
                    const emailUsuario = (this.paciente.correo || '').toLowerCase().trim();
                    return emailPaciente === emailUsuario;
                });

                this.stats.totalCitas = this.citasPaciente.length;
                this.stats.citasCompletadas = this.citasPaciente.filter((c: any) =>
                    ['completada', 'realizada', 'finalizada'].includes((c.estado || '').toLowerCase())
                ).length;
            }

            const tratamientos = await firstValueFrom(this.usersService.getTratamientosByPaciente(id));
            if (Array.isArray(tratamientos)) {
                this.tratamientosPaciente = tratamientos.map((t: any) => {
                    return {
                        ...t,
                        nombreMedicamento: t.nombremedicamento || 'Medicamento',
                        dosis: t.dosis || 'Dosis no especificada',
                        frecuenciaHoras: t.frecuenciashoras || t.frecuenciahoras,
                        fechaInicio: t.fechainicio,
                        fechaFin: t.fechafin,
                        notasInstrucciones: t.notasinstrucciones || t.notas_instrucciones,
                        activo: t.activo !== undefined ? t.activo : true
                    };
                });
                this.stats.tratamientosActivos = this.tratamientosPaciente.filter((t: any) =>
                    t.activo !== false && t.activo !== 0
                ).length;
            }

            const mediciones = await firstValueFrom(this.usersService.getMedicionesPaciente(id, 10));
            if (mediciones && Array.isArray(mediciones)) {
                this.medicionesPaciente = mediciones.slice(0, 5);
            }

            const todosMedicamentos = await firstValueFrom(this.usersService.getMedicamentos());
            if (Array.isArray(todosMedicamentos)) {
                const medicamentosIds = new Set(
                    this.tratamientosPaciente
                        .filter(t => t.idmedicamento)
                        .map(t => t.idmedicamento)
                );
                this.medicacionesPaciente = todosMedicamentos.filter(m =>
                    medicamentosIds.has(m.idmedicamento)
                );
                this.stats.medicacionesActivas = this.medicacionesPaciente.length;
            }

        } catch (error) {
            console.error('Error al cargar paciente:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
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

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = `${nombre || ''} ${apPaterno || ''}`.trim();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
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

    getEstadoClassActivo(activo: boolean): string {
        return activo ? 'badge-success' : 'badge-danger';
    }

    getEstadoTextoActivo(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    cambiarTab(tab: 'info' | 'citas' | 'tratamientos' | 'medicaciones') {
        this.activeTab = tab;
    }

    volver() {
        this.router.navigate(['/doctor/pacientes']);
    }

    irACita(cita: any) {
        this.router.navigate(['/doctor/citas/detalle', cita.idcita]);
    }

    irATratamiento(tratamiento: any) {
        this.router.navigate(['/doctor/tratamientos/detalle', tratamiento.idtratamiento]);
    }
}