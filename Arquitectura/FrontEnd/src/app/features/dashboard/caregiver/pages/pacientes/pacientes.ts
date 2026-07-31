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
    selector: 'app-caregiver-pacientes',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        CaregiverMenu
    ],
    templateUrl: './pacientes.html',
    styleUrls: ['./pacientes.css']
})
export class CaregiverPacientes implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    searchTerm = '';
    caregiverId: number | null = null;
    pacientes: any[] = [];
    filteredPacientes: any[] = [];
    filterGenero: string = '';
    filterEstado: string = '';

    // Modal de solicitud
    mostrarModalSolicitud: boolean = false;
    correoPaciente: string = '';
    parentesco: string = '';
    notas: string = '';
    enviandoSolicitud: boolean = false;

    // Estado de la solicitud
    solicitudPendiente: boolean = false;
    mensajeSolicitud: string = '';

    parentescos = [
        'Padre', 'Madre', 'Hermano', 'Hermana', 'Tio', 'Tia',
        'Primo', 'Prima', 'Abuelo', 'Abuela', 'Conyuge', 'Otro'
    ];

    toastNotifications: ToastNotification[] = [];
    private toastIdCounter = 0;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
    }

    async cargarDatos() {
        this.isLoading = true;
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.caregiverId = userData.idusuario || userData.uid || null;
                } catch (e) {
                    // Error silencioso
                }
            }

            if (!this.caregiverId) {
                this.isLoading = false;
                return;
            }

            // Obtener pacientes asignados desde el nuevo endpoint
            const pacientesAsignados = await firstValueFrom(
                this.usersService.getPacientesAsignados(this.caregiverId)
            );

            if (Array.isArray(pacientesAsignados) && pacientesAsignados.length > 0) {
                this.pacientes = pacientesAsignados.map(p => {
                    const nombre = p.nombre || '';
                    const apPaterno = p.apPaterno || '';
                    const apMaterno = p.apMaterno || '';
                    const nombreCompleto = nombre + ' ' + apPaterno + ' ' + apMaterno;
                    return {
                        ...p,
                        nombreCompleto: nombreCompleto.trim() || p.correo || 'Paciente',
                        activo: true
                    };
                });
            } else {
                this.pacientes = [];
            }

            this.filteredPacientes = [...this.pacientes];

            // Verificar solicitudes pendientes al cargar
            await this.verificarSolicitudPendiente();

        } catch (error) {
            this.mostrarToast('error', 'Error', 'No se pudieron cargar los pacientes');
            this.pacientes = [];
            this.filteredPacientes = [];
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================
    // VERIFICAR SOLICITUDES PENDIENTES
    // ============================================
    async verificarSolicitudPendiente() {
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
            console.error('Error al verificar solicitudes:', error);
        }
    }

    buscarPacientes() {
        const term = this.searchTerm.toLowerCase().trim();

        this.filteredPacientes = this.pacientes.filter(p => {
            const matchText = !term ||
                p.nombre?.toLowerCase().includes(term) ||
                p.apPaterno?.toLowerCase().includes(term) ||
                p.apMaterno?.toLowerCase().includes(term) ||
                p.correo?.toLowerCase().includes(term) ||
                p.nss?.toLowerCase().includes(term);

            const matchGenero = !this.filterGenero ||
                p.genero?.toLowerCase() === this.filterGenero.toLowerCase();

            const matchEstado = !this.filterEstado ||
                (this.filterEstado === 'activo' && p.activo !== false) ||
                (this.filterEstado === 'inactivo' && p.activo === false);

            return matchText && matchGenero && matchEstado;
        });
    }

    limpiarFiltros() {
        this.searchTerm = '';
        this.filterGenero = '';
        this.filterEstado = '';
        this.filteredPacientes = [...this.pacientes];
    }

    // ============================================
    // MODAL DE SOLICITUD
    // ============================================
    abrirModalSolicitud() {
        // Verificar si hay solicitud pendiente antes de abrir
        if (this.solicitudPendiente) {
            this.mostrarToast('warning', 'Solicitud pendiente',
                'Ya tienes una solicitud pendiente. Espera la aprobacion del administrador.');
            return;
        }
        this.mostrarModalSolicitud = true;
        this.correoPaciente = '';
        this.parentesco = '';
        this.notas = '';
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.correoPaciente = '';
        this.parentesco = '';
        this.notas = '';
        this.enviandoSolicitud = false;
    }

    async enviarSolicitud() {
        if (!this.correoPaciente) {
            this.mostrarToast('warning', 'Campo requerido', 'Ingresa el correo del paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: this.correoPaciente,
                    parentesco: this.parentesco,
                    notas: this.notas
                })
            );

            this.mostrarToast('success', 'Solicitud enviada',
                'Tu solicitud ha sido enviada. Espera la aprobacion del administrador.');

            // Actualizar estado de solicitud pendiente
            this.solicitudPendiente = true;
            this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobacion del administrador.';

            this.cerrarModalSolicitud();

        } catch (error: any) {
            // Manejar error específico de solicitud pendiente
            if (error.error?.error === 'Ya tienes una solicitud pendiente para este paciente') {
                this.mostrarToast('warning', 'Solicitud pendiente',
                    'Ya tienes una solicitud pendiente para este paciente. Espera la aprobacion.');
                this.solicitudPendiente = true;
                this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobacion del administrador.';
            } else {
                const mensaje = error.error?.error || 'Error al enviar la solicitud';
                this.mostrarToast('error', 'Error', mensaje);
            }
        } finally {
            this.enviandoSolicitud = false;
        }
    }

    // ============================================
    // NAVEGACIÓN
    // ============================================
    verDetalle(paciente: any) {
        this.router.navigate(['/caregiver/pacientes/detalle', paciente.idusuario]);
    }

    irASolicitarAcceso() {
        // Verificar si hay solicitud pendiente antes de navegar
        if (this.solicitudPendiente) {
            this.mostrarToast('warning', 'Solicitud pendiente',
                'Ya tienes una solicitud pendiente. Espera la aprobacion del administrador.');
            return;
        }
        this.router.navigate(['/caregiver/solicitar-acceso']);
    }

    // ============================================
    // UTILITIES
    // ============================================
    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = (nombre || '') + ' ' + (apPaterno || '');
        return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name.trim()) + '&background=b0001e&color=fff&bold=true';
    }

    getEstadoClass(activo: boolean): string {
        return activo !== false ? 'badge-success' : 'badge-danger';
    }

    getEstadoTexto(activo: boolean): string {
        return activo !== false ? 'Activo' : 'Inactivo';
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    mostrarToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration: number = 4000) {
        const toast: ToastNotification = {
            id: ++this.toastIdCounter,
            type,
            title,
            message,
            duration
        };
        this.toastNotifications.push(toast);

        setTimeout(() => {
            this.cerrarToast(toast.id);
        }, duration);
    }

    cerrarToast(id: number) {
        const toast = this.toastNotifications.find(t => t.id === id);
        if (toast) {
            toast.duration = 0;
        }
        setTimeout(() => {
            this.toastNotifications = this.toastNotifications.filter(t => t.id !== id);
        }, 300);
    }

    getToastIcon(type: string): string {
        switch (type) {
            case 'success': return 'bi-check-circle-fill';
            case 'error': return 'bi-exclamation-circle-fill';
            case 'warning': return 'bi-exclamation-triangle-fill';
            case 'info': return 'bi-info-circle-fill';
            default: return 'bi-info-circle-fill';
        }
    }
}