import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../template/menu/menu";
import { firstValueFrom, timeout } from 'rxjs';
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
    verificandoSolicitud: boolean = false;

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
                    console.log('[Caregiver] ID del acompañante:', this.caregiverId);
                } catch (e) {
                    console.error('Error al parsear localStorage:', e);
                }
            }

            if (!this.caregiverId) {
                console.warn('[Caregiver] No se encontró ID del acompañante');
                this.isLoading = false;
                this.mostrarToast('warning', 'Sin identificación', 'No se pudo identificar al acompañante.');
                return;
            }

            // Cargar pacientes asignados
            await this.cargarPacientesAsignados();

            // Verificar solicitudes pendientes al cargar
            await this.verificarSolicitudPendiente();

        } catch (error) {
            console.error('[Caregiver] Error al cargar datos:', error);
            this.mostrarToast('error', 'Error', 'No se pudieron cargar los pacientes');
            this.pacientes = [];
            this.filteredPacientes = [];
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================
    // CARGAR PACIENTES ASIGNADOS
    // ============================================
    async cargarPacientesAsignados() {
        try {
            console.log('[Caregiver] Cargando pacientes asignados para ID:', this.caregiverId);

            // Intentar obtener pacientes asignados
            let pacientesData: any[] = [];

            try {
                // Intentar con getPacientesAsignados (método en el service)
                const response = await firstValueFrom(
                    this.usersService.getPacientesAsignados(this.caregiverId!).pipe(timeout(10000))
                );
                console.log('[Caregiver] Respuesta getPacientesAsignados:', response);

                if (response && typeof response === 'object') {
                    // Verificar si tiene success y data
                    if ('success' in response && 'data' in response) {
                        pacientesData = (response as any).data || [];
                    } else if (Array.isArray(response)) {
                        pacientesData = response;
                    } else if ('data' in response) {
                        pacientesData = (response as any).data || [];
                    } else {
                        // Intentar extraer el array de la respuesta - CORREGIDO
                        const respObj = response as Record<string, any>;
                        for (const key in respObj) {
                            if (Object.prototype.hasOwnProperty.call(respObj, key) && Array.isArray(respObj[key])) {
                                pacientesData = respObj[key];
                                break;
                            }
                        }
                    }
                } else if (Array.isArray(response)) {
                    pacientesData = response;
                }
            } catch (error) {
                console.warn('[Caregiver] Error con getPacientesAsignados, intentando alternativa:', error);

                // Fallback: intentar con getMisPacientes
                try {
                    const fallbackResponse = await firstValueFrom(
                        this.usersService.getPacientesAsignados(this.caregiverId!).pipe(timeout(10000))
                    );
                    console.log('[Caregiver] Respuesta fallback:', fallbackResponse);
                    if (Array.isArray(fallbackResponse)) {
                        pacientesData = fallbackResponse;
                    } else if (fallbackResponse && typeof fallbackResponse === 'object' && 'data' in fallbackResponse) {
                        pacientesData = (fallbackResponse as any).data || [];
                    }
                } catch (fallbackError) {
                    console.warn('[Caregiver] Fallback también falló:', fallbackError);
                }
            }

            // Procesar pacientes
            if (Array.isArray(pacientesData) && pacientesData.length > 0) {
                this.pacientes = pacientesData.map(p => {
                    const nombre = p.nombre || p.Nombre || '';
                    const apPaterno = p.apPaterno || p.ApPaterno || p.apellido_paterno || '';
                    const apMaterno = p.apMaterno || p.ApMaterno || p.apellido_materno || '';
                    const nombreCompleto = [nombre, apPaterno, apMaterno].filter(Boolean).join(' ').trim() || p.correo || 'Paciente';

                    return {
                        ...p,
                        idusuario: p.idusuario || p.IdUsuario || p.id,
                        nombreCompleto: nombreCompleto,
                        activo: p.activo !== false
                    };
                });
                console.log('[Caregiver] Pacientes cargados:', this.pacientes.length);
            } else {
                this.pacientes = [];
                console.log('[Caregiver] No se encontraron pacientes asignados');
                this.mostrarToast('info', 'Sin pacientes', 'No tienes pacientes asignados aún.');
            }

            this.filteredPacientes = [...this.pacientes];

        } catch (error) {
            console.error('[Caregiver] Error en cargarPacientesAsignados:', error);
            this.pacientes = [];
            this.filteredPacientes = [];
            this.mostrarToast('error', 'Error', 'No se pudieron cargar los pacientes asignados.');
        }
    }

    // ============================================
    // VERIFICAR SOLICITUDES PENDIENTES
    // ============================================
    async verificarSolicitudPendiente() {
        if (!this.caregiverId) return;

        this.verificandoSolicitud = true;
        try {
            console.log('[Caregiver] Verificando solicitudes pendientes para ID:', this.caregiverId);

            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId).pipe(timeout(10000))
            );
            console.log('[Caregiver] Respuesta getMisSolicitudes:', solicitudes);

            if (Array.isArray(solicitudes)) {
                const pendientes = solicitudes.filter(s => s.estado === 'pendiente' || s.Estado === 'pendiente');
                if (pendientes.length > 0) {
                    this.solicitudPendiente = true;
                    this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobación del administrador.';
                    console.log('[Caregiver] Solicitud pendiente encontrada');
                } else {
                    this.solicitudPendiente = false;
                    this.mensajeSolicitud = '';
                    console.log('[Caregiver] No hay solicitudes pendientes');
                }
            } else {
                // Si la respuesta no es un array, verificar si hay alguna pendiente en la estructura
                if (solicitudes && typeof solicitudes === 'object') {
                    const data = (solicitudes as any).data || solicitudes;
                    if (Array.isArray(data)) {
                        const pendientes = data.filter((s: any) => s.estado === 'pendiente' || s.Estado === 'pendiente');
                        this.solicitudPendiente = pendientes.length > 0;
                        if (this.solicitudPendiente) {
                            this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobación del administrador.';
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Caregiver] Error al verificar solicitudes:', error);
            // No mostrar error al usuario, solo log
        } finally {
            this.verificandoSolicitud = false;
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
                p.nss?.toLowerCase().includes(term) ||
                p.nombreCompleto?.toLowerCase().includes(term);

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
                'Ya tienes una solicitud pendiente. Espera la aprobación del administrador.');
            return;
        }
        this.mostrarModalSolicitud = true;
        this.correoPaciente = '';
        this.parentesco = '';
        this.notas = '';
        this.enviandoSolicitud = false;
        // Resetear errores del formulario
        this.cdr.detectChanges();
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.correoPaciente = '';
        this.parentesco = '';
        this.notas = '';
        this.enviandoSolicitud = false;
        this.cdr.detectChanges();
    }

    async enviarSolicitud() {
        // Validaciones
        if (!this.correoPaciente || !this.correoPaciente.trim()) {
            this.mostrarToast('warning', 'Campo requerido', 'Ingresa el correo del paciente');
            return;
        }

        // Validación básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.correoPaciente.trim())) {
            this.mostrarToast('warning', 'Email inválido', 'Ingresa un correo electrónico válido.');
            return;
        }

        if (!this.parentesco) {
            this.mostrarToast('warning', 'Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        this.cdr.detectChanges();

        try {
            console.log('[Caregiver] Enviando solicitud para:', this.correoPaciente);

            const response = await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: this.correoPaciente.trim(),
                    parentesco: this.parentesco,
                    notas: this.notas || ''
                }).pipe(timeout(15000))
            );

            console.log('[Caregiver] Respuesta de solicitud:', response);

            // Verificar si la solicitud fue exitosa
            const exito = response?.success !== false;
            const mensaje = response?.message || response?.mensaje || 'Solicitud enviada correctamente.';

            if (exito) {
                this.mostrarToast('success', 'Solicitud enviada',
                    'Tu solicitud ha sido enviada. Espera la aprobación del administrador.');

                // Actualizar estado de solicitud pendiente
                this.solicitudPendiente = true;
                this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobación del administrador.';

                this.cerrarModalSolicitud();
            } else {
                this.mostrarToast('error', 'Error', mensaje || 'No se pudo enviar la solicitud.');
            }

        } catch (error: any) {
            console.error('[Caregiver] Error al enviar solicitud:', error);

            // Manejar errores específicos
            let mensajeError = 'Error al enviar la solicitud. Intenta nuevamente.';

            if (error.error?.error) {
                mensajeError = error.error.error;
                if (mensajeError.includes('pendiente')) {
                    this.solicitudPendiente = true;
                    this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobación del administrador.';
                    this.cerrarModalSolicitud();
                    this.mostrarToast('warning', 'Solicitud pendiente', mensajeError);
                    return;
                }
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.mostrarToast('error', 'Error', mensajeError);
        } finally {
            this.enviandoSolicitud = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================
    // NAVEGACIÓN
    // ============================================
    verDetalle(paciente: any) {
        const id = paciente.idusuario || paciente.IdUsuario || paciente.id;
        if (id) {
            this.router.navigate(['/caregiver/pacientes/detalle', id]);
        } else {
            this.mostrarToast('warning', 'Error', 'No se pudo identificar al paciente.');
        }
    }

    irASolicitarAcceso() {
        if (this.solicitudPendiente) {
            this.mostrarToast('warning', 'Solicitud pendiente',
                'Ya tienes una solicitud pendiente. Espera la aprobación del administrador.');
            return;
        }
        this.router.navigate(['/caregiver/solicitar-acceso']);
    }

    recargarDatos() {
        this.cargarDatos();
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

    getIniciales(nombre: string, apPaterno: string): string {
        const first = (nombre || '').charAt(0) || '';
        const second = (apPaterno || '').charAt(0) || '';
        return (first + second).toUpperCase() || 'P';
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
        this.cdr.detectChanges();

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
            this.cdr.detectChanges();
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