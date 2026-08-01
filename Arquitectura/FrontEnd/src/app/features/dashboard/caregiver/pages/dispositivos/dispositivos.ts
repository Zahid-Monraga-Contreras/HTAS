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
    selector: 'app-caregiver-dispositivos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        CaregiverMenu
    ],
    templateUrl: './dispositivos.html',
    styleUrls: ['./dispositivos.css']
})
export class CaregiverDispositivos implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    caregiverId: number | null = null;
    caregiverName: string = '';

    dispositivos: any[] = [];
    dispositivosFiltrados: any[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    pacientesAsignados: Set<number> = new Set();
    pacientesConAcceso: Map<number, boolean> = new Map();
    private pacientesMap: Map<number, any> = new Map();

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0,
        sinAsignar: 0,
        pacientesConDispositivos: 0
    };

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    solicitudPendiente: boolean = false;
    mensajeSolicitud: string = '';

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
                await this.cargarDispositivos();
                await this.verificarSolicitudesPendientes();
            } else {
                this.showWarning('Sin datos', 'No se pudo identificar al acompanante');
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los dispositivos.');
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

    private async verificarSolicitudesPendientes() {
        try {
            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId!)
            );

            if (Array.isArray(solicitudes)) {
                const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
                if (pendientes.length > 0) {
                    this.solicitudPendiente = true;
                    this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobacion del administrador.';
                } else {
                    this.solicitudPendiente = false;
                    this.mensajeSolicitud = '';
                }
            }
        } catch (error) {
            console.error('Error al verificar solicitudes pendientes:', error);
        }
    }

    private async cargarDispositivos() {
        try {
            const data = await firstValueFrom(this.usersService.getDispositivos());

            if (Array.isArray(data)) {
                const dispositivosFiltrados = data.filter(d => {
                    const idPaciente = d.idpacienteasociado || d.idPacienteAsociado;
                    return idPaciente && this.pacientesAsignados.has(idPaciente);
                });

                this.dispositivos = dispositivosFiltrados.map(d => {
                    const idPaciente = d.idpacienteasociado || d.idPacienteAsociado;
                    let nombrePaciente = 'Sin asignar';

                    if (idPaciente && this.pacientesMap.has(idPaciente)) {
                        const paciente = this.pacientesMap.get(idPaciente);
                        const nombre = paciente.nombre || '';
                        const apPaterno = paciente.apPaterno || '';
                        const apMaterno = paciente.apMaterno || '';
                        nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        if (!nombrePaciente) {
                            nombrePaciente = paciente.correo || 'Sin asignar';
                        }
                    }

                    return {
                        ...d,
                        iddispositivo: d.iddispositivo || d.IdDispositivo || d.id,
                        nombre: d.nombre || 'Dispositivo sin nombre',
                        direccionmac: d.direccionmac || d.direccionMac || 'No especificada',
                        idpacienteasociado: idPaciente,
                        activo: d.activo !== false,
                        ultimasincronizacion: d.ultimasincronizacion || null,
                        nombrepaciente: nombrePaciente,
                        tieneAcceso: true
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

    verDetalle(dispositivo: any) {
        const id = dispositivo.iddispositivo || dispositivo.id;
        if (id) {
            this.router.navigate(['/caregiver/dispositivos/detalle', id]);
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
}