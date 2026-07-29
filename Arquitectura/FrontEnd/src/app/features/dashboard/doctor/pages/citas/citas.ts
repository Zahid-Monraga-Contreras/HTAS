import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; // ✅ Agregar Router
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
    private router = inject(Router); // ✅ Inyectar Router
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    userEmail: string = '';
    doctorName: string = '';
    doctorFullName: string = '';
    doctorId: number | null = null;

    citas: any[] = [];
    citasFiltradas: any[] = [];
    filterEstado: string = 'todas';
    citasEstadisticas = {
        total: 0,
        programadas: 0,
        completadas: 0,
        canceladas: 0
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

            console.log('📧 Email del doctor:', this.userEmail);
            console.log('🆔 ID del doctor:', this.doctorId);

            await this.cargarCitas();
        } catch (error) {
            console.error('Error al cargar datos:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarCitas() {
        try {
            const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

            console.log('📋 Total de citas en backend:', todasLasCitas?.length || 0);

            if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                // 🔍 Ver la primera cita para ver qué campos tiene
                console.log('🔍 Primera cita:', todasLasCitas[0]);
                console.log('🔍 Campos de la primera cita:', Object.keys(todasLasCitas[0]));

                // Mostrar TODAS las citas
                this.citas = todasLasCitas.map(c => ({
                    ...c,
                    id: c.idcita || c.id,
                    fechacita: c.fechacita || c.fecha || c.fechaCita,
                    horacita: c.horacita || c.hora || c.horaCita,
                    paciente: c.pacienteNombre || c.nombrePaciente || c.paciente || 'Paciente',
                    especialidad: c.especialidad || c.Especialidad || 'General'
                }));

                console.log('✅ Total de citas mostradas:', this.citas.length);

                this.citas.sort((a: any, b: any) => {
                    const fechaA = new Date(a.fechacita || a.fecha || a.fechaCita);
                    const fechaB = new Date(b.fechacita || b.fecha || b.fechaCita);
                    return fechaB.getTime() - fechaA.getTime();
                });

                this.calcularEstadisticas();
                this.aplicarFiltro('todas');
            } else {
                console.warn('⚠️ No hay citas en el backend');
                this.citas = [];
                this.calcularEstadisticas();
                this.aplicarFiltro('todas');
            }
        } catch (error) {
            console.error('❌ Error al cargar citas:', error);
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
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todas') {
            this.citasFiltradas = [...this.citas];
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

    esCitaHoy(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const hoy = new Date();
            const fechaCita = new Date(fecha);
            return hoy.getDate() === fechaCita.getDate() &&
                hoy.getMonth() === fechaCita.getMonth() &&
                hoy.getFullYear() === fechaCita.getFullYear();
        } catch {
            return false;
        }
    }

    esCitaProxima(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const hoy = new Date();
            const fechaCita = new Date(fecha);
            return fechaCita > hoy;
        } catch {
            return false;
        }
    }

    obtenerBadgeTiempo(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'Hoy';
        if (this.esCitaProxima(fecha)) return 'Proxima';
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
}