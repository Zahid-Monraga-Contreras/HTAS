import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DoctorMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

interface AnalisisItem {
    folio_expediente_db: number;
    fecha_analisis: string;
    nivel_riesgo_clinico: string;
    sistolica_usada: number;
    diastolica_usada: number;
    probabilidad_porcentual: number;
    prediccion_crisis: number;
    motor_inferencia_usado: string;
    nombre_paciente?: string;
    id_paciente?: number;
}

@Component({
    selector: 'app-doctor-analisis',
    standalone: true,
    imports: [CommonModule, FormsModule, DoctorMenu],
    templateUrl: './analisis.html',
    styleUrls: ['./analisis.css']
})
export class DoctorAnalisis implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    // Estado
    isLoading = true;
    sistemaActivo = false;

    // Datos del doctor (para mostrar en header)
    doctorName: string = '';
    doctorFullName: string = '';
    doctorId: number | null = null;

    // Lista de análisis (TODOS, sin filtrar por paciente)
    analisis: AnalisisItem[] = [];
    analisisFiltrados: AnalisisItem[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    // Estadísticas
    estadisticas = {
        total: 0,
        criticos: 0,
        moderados: 0,
        estables: 0
    };

    // Notificaciones
    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    // Modal de confirmación
    mostrarModalConfirmacion = false;
    analisisParaEliminar: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
    }

    // ============================================================
    // TOAST
    // ============================================================
    private showToast(type: ToastNotification['type'], title: string, message: string, duration: number = 5000) {
        const id = ++this.notificationCounter;
        const notification: ToastNotification = { id, type, title, message, duration };
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

    // ============================================================
    // CARGA DE DATOS - CORREGIDO (como citas y tratamientos)
    // ============================================================
    async cargarDatos() {
        this.isLoading = true;
        try {
            console.log('[Analisis] Iniciando carga de datos...');

            // Obtener datos del doctor logueado
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.doctorName = userData.nombre || 'Doctor';
                this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            await this.verificarEstadoSistema();
            await this.cargarTodosLosAnalisis();

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los análisis.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    async verificarEstadoSistema() {
        try {
            await firstValueFrom(this.usersService.verificarEstadoAlgoritmo());
            this.sistemaActivo = true;
        } catch (error) {
            this.sistemaActivo = false;
            this.showWarning('Sistema desconectado', 'El sistema de análisis no está disponible');
        }
    }

    // ============================================================
    // CARGA DE TODOS LOS ANÁLISIS (como citas y tratamientos)
    // ============================================================
    async cargarTodosLosAnalisis() {
        try {
            // ✅ OBTENER TODOS LOS PACIENTES
            const allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());

            // Filtrar solo pacientes
            const pacientes = allUsers.filter(u =>
                u.rol?.toLowerCase() === 'paciente'
            );

            console.log('[Analisis] Pacientes encontrados:', pacientes.length);

            // ✅ POR CADA PACIENTE, OBTENER SU EXPEDIENTE
            const analisisPromises = pacientes.map(async (paciente) => {
                try {
                    const response = await firstValueFrom(
                        this.usersService.obtenerUltimoExpediente(paciente.idusuario)
                    );

                    if (response && response.success && response.data) {
                        const data = response.data;
                        return {
                            folio_expediente_db: data.folio || 0,
                            fecha_analisis: data.fecha_consulta || new Date().toISOString(),
                            nivel_riesgo_clinico: data.nivel_riesgo || 'No disponible',
                            sistolica_usada: data.presion_pdf_sistolica || data.sistolica || 0,
                            diastolica_usada: data.presion_pdf_diastolica || data.diastolica || 0,
                            probabilidad_porcentual: data.probabilidad_porcentual || 0,
                            prediccion_crisis: data.prediccion_crisis || 0,
                            motor_inferencia_usado: data.motor_utilizado || 'No disponible',
                            nombre_paciente: `${paciente.nombre || ''} ${paciente.apPaterno || ''} ${paciente.apMaterno || ''}`.trim() || 'Paciente',
                            id_paciente: paciente.idusuario
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`[Analisis] Error cargando expediente del paciente ${paciente.idusuario}:`, error);
                    return null;
                }
            });

            const resultados = await Promise.all(analisisPromises);

            // ✅ Filtrar los que tienen análisis (no null)
            this.analisis = resultados.filter(item => item !== null) as AnalisisItem[];

            console.log('[Analisis] Análisis cargados:', this.analisis.length);

            this.calcularEstadisticas();
            this.aplicarFiltro('todos');

        } catch (error) {
            console.error('Error cargando todos los análisis:', error);
            this.analisis = [];
            this.calcularEstadisticas();
            this.aplicarFiltro('todos');
        }
    }

    // ============================================================
    // ESTADÍSTICAS Y FILTROS
    // ============================================================
    calcularEstadisticas() {
        this.estadisticas.total = this.analisis.length;
        this.estadisticas.criticos = this.analisis.filter(
            a => a.nivel_riesgo_clinico && a.nivel_riesgo_clinico.includes('CRITICO')
        ).length;
        this.estadisticas.moderados = this.analisis.filter(
            a => a.nivel_riesgo_clinico && a.nivel_riesgo_clinico.includes('MODERADO')
        ).length;
        this.estadisticas.estables = this.analisis.filter(
            a => a.nivel_riesgo_clinico && a.nivel_riesgo_clinico.includes('ESTABLE')
        ).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        this.filtrarAnalisis();
    }

    buscarAnalisis() {
        this.filtrarAnalisis();
    }

    private filtrarAnalisis() {
        const term = this.searchTerm.toLowerCase().trim();

        this.analisisFiltrados = this.analisis.filter(item => {
            let matchEstado = true;
            if (this.filterEstado === 'critico') {
                matchEstado = item.nivel_riesgo_clinico?.includes('CRITICO') || false;
            } else if (this.filterEstado === 'moderado') {
                matchEstado = item.nivel_riesgo_clinico?.includes('MODERADO') || false;
            } else if (this.filterEstado === 'estable') {
                matchEstado = item.nivel_riesgo_clinico?.includes('ESTABLE') || false;
            }

            let matchSearch = true;
            if (term) {
                matchSearch =
                    String(item.folio_expediente_db).includes(term) ||
                    (item.nivel_riesgo_clinico || '').toLowerCase().includes(term) ||
                    String(item.probabilidad_porcentual).includes(term) ||
                    (item.nombre_paciente || '').toLowerCase().includes(term);
            }

            return matchEstado && matchSearch;
        });
    }

    // ============================================================
    // NAVEGACIÓN
    // ============================================================
    verDetalle(item: any) {
        const folio = item.folio_expediente_db;
        const idPaciente = item.id_paciente;

        console.log('[Analisis] Navegando a detalle:');
        console.log('  - ID del paciente:', idPaciente);
        console.log('  - Folio:', folio);

        if (folio && idPaciente) {
            this.router.navigate(['/doctor/analisis/detalle', idPaciente, folio]);
        } else if (folio) {
            this.router.navigate(['/doctor/analisis/detalle', folio]);
        } else {
            this.showError('Error', 'No se pudo identificar el análisis.');
        }
    }

    volverAPacientes() {
        this.router.navigate(['/doctor/pacientes']);
    }

    // ============================================================
    // ELIMINAR
    // ============================================================
    mostrarConfirmacionEliminar(item: any) {
        this.analisisParaEliminar = item;
        this.modalConfirmacion = {
            titulo: 'Eliminar Análisis',
            mensaje: '¿Está seguro de que desea eliminar este análisis? Esta acción no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        this.analisisParaEliminar = null;
        document.body.style.overflow = '';
        this.cdr.detectChanges();
    }

    async ejecutarEliminarAnalisis() {
        if (!this.analisisParaEliminar) {
            this.cerrarModalConfirmacion();
            return;
        }

        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const folio = this.analisisParaEliminar.folio_expediente_db;

            // Aquí iría la llamada al servicio para eliminar
            // Como no tenemos el método, mostramos un mensaje
            this.showWarning('Función no disponible', 'La eliminación de análisis está en desarrollo.');
            this.cerrarModalConfirmacion();

        } catch (error: any) {
            let mensajeError = 'Ocurrió un error al eliminar el análisis.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Eliminar', mensajeError);
            this.cerrarModalConfirmacion();
        } finally {
            this.cargandoEliminar = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // UTILIDADES
    // ============================================================
    formatearFechaAnalisis(fechaISO: string): string {
        if (!fechaISO) return 'Fecha no disponible';
        try {
            const fechaObj = new Date(fechaISO);
            if (isNaN(fechaObj.getTime())) return fechaISO;
            return fechaObj.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return fechaISO;
        }
    }

    getRiesgoClase(nivel: string): string {
        if (!nivel) return '';
        if (nivel.includes('CRITICO')) return 'riesgo-critico';
        if (nivel.includes('MODERADO')) return 'riesgo-moderado';
        if (nivel.includes('ESTABLE')) return 'riesgo-estable';
        return '';
    }

    getRiesgoIcono(nivel: string): string {
        if (!nivel) return 'bi-circle';
        if (nivel.includes('CRITICO')) return 'bi-exclamation-octagon-fill';
        if (nivel.includes('MODERADO')) return 'bi-exclamation-triangle-fill';
        if (nivel.includes('ESTABLE')) return 'bi-check-circle-fill';
        return 'bi-circle';
    }
}