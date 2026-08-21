import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DoctorMenu } from "../../template/menu/menu";
import { Users, UltimoExpedienteResponse } from '../../../../../core/services/users.service';
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
    cedula_medico?: string;
    pdf_diagnostico_base64?: string | null;
    tiene_pdf_diagnostico?: boolean;
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

    isLoading = true;
    sistemaActivo = false;

    doctorName: string = '';
    doctorFullName: string = '';
    doctorId: number | null = null;

    pacientesAsignados: any[] = [];
    pacientesIds: number[] = [];

    analisis: AnalisisItem[] = [];
    analisisFiltrados: AnalisisItem[] = [];
    filterEstado: string = 'todos';
    searchTerm: string = '';

    estadisticas = {
        total: 0,
        criticos: 0,
        moderados: 0,
        estables: 0,
        conPdf: 0,
        sinPdf: 0
    };

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    mostrarModalConfirmacion = false;
    analisisParaEliminar: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    paginaActual = 1;
    itemsPorPagina = 10;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
    }

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

    async cargarDatos() {
        this.isLoading = true;
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.doctorName = userData.nombre || 'Doctor';
                this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            if (!this.doctorId) {
                this.showError('Error', 'No se pudo identificar al doctor.');
                this.isLoading = false;
                return;
            }

            console.log('[Analisis] Doctor ID:', this.doctorId);
            console.log('[Analisis] Doctor:', this.doctorFullName);

            await this.verificarEstadoSistema();
            await this.cargarPacientesAsignados();
            await this.cargarAnalisisDePacientesAsignados();

        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los análisis.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // CARGAR PACIENTES ASIGNADOS - CORREGIDO
    // ============================================================
    async cargarPacientesAsignados() {
        if (!this.doctorId) return;

        try {
            console.log('[Analisis] Cargando pacientes asignados al doctor:', this.doctorId);

            let pacientesData: any[] = [];
            let response: any = null;

            // PRIMER INTENTO: getPacientesDeDoctor
            try {
                response = await firstValueFrom(
                    this.usersService.getPacientesDeDoctor(this.doctorId)
                );
                console.log('[Analisis] Respuesta getPacientesDeDoctor (raw):', JSON.stringify(response));
            } catch (err) {
                console.warn('[Analisis] getPacientesDeDoctor falló:', err);
            }

            // Extraer datos de la respuesta
            if (response) {
                // Si es un objeto con success y data
                if (response.success !== undefined && response.data !== undefined) {
                    pacientesData = response.data || [];
                }
                // Si es un objeto con data
                else if (response.data !== undefined) {
                    pacientesData = response.data || [];
                }
                // Si es un array
                else if (Array.isArray(response)) {
                    pacientesData = response;
                }
                // Si es un objeto con propiedades
                else if (typeof response === 'object') {
                    for (const key in response) {
                        if (Array.isArray(response[key]) && response[key].length > 0) {
                            pacientesData = response[key];
                            console.log(`[Analisis] Encontrado array en propiedad: ${key}`);
                            break;
                        }
                    }
                }
            }

            console.log('[Analisis] PacientesData extraído:', pacientesData);
            console.log('[Analisis] Cantidad de pacientes:', pacientesData.length);

            // SI NO HAY PACIENTES, USAR FALLBACK CON getTodosLosPacientes
            if (!pacientesData || pacientesData.length === 0) {
                console.log('[Analisis] No se encontraron pacientes, usando fallback...');
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

                    console.log('[Analisis] Todos los pacientes obtenidos:', allPacientes.length);

                    const doctorIdNum = Number(this.doctorId);

                    pacientesData = allPacientes.filter((p: any) => {
                        const posiblesPropiedades = [
                            'DoctorAsignado', 'doctorasignado', 'IdDoctorAsignado', 'iddoctorasignado',
                            'IdDoctor', 'iddoctor', 'DoctorId', 'doctorId', 'doctor_id', 'IdDoctorAsignado'
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

                    console.log('[Analisis] Pacientes filtrados por asignación:', pacientesData.length);

                } catch (err) {
                    console.warn('[Analisis] Falló la carga alternativa:', err);
                }
            }

            // SI AÚN NO HAY PACIENTES, USAR getPacientesAsignadosDetalle
            if (!pacientesData || pacientesData.length === 0) {
                try {
                    const detalleResponse = await firstValueFrom(
                        this.usersService.getPacientesAsignadosDetalle(this.doctorId)
                    );
                    console.log('[Analisis] Respuesta getPacientesAsignadosDetalle:', detalleResponse);

                    if (detalleResponse) {
                        if (detalleResponse.data !== undefined) {
                            pacientesData = detalleResponse.data || [];
                        } else if (Array.isArray(detalleResponse)) {
                            pacientesData = detalleResponse;
                        } else if (typeof detalleResponse === 'object') {
                            for (const key in detalleResponse) {
                                if (Array.isArray(detalleResponse[key])) {
                                    pacientesData = detalleResponse[key];
                                    break;
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[Analisis] getPacientesAsignadosDetalle falló:', err);
                }
            }

            // ============================================================
            // EXTRACCIÓN DE IDs - CORREGIDO: Ahora busca 'id_usuario'
            // ============================================================
            this.pacientesAsignados = pacientesData;
            this.pacientesIds = pacientesData
                .map((p: any) => {
                    // Buscar en todas las posibles propiedades de ID
                    const id = p.id_usuario ||    // ← NUEVO: formato con guión bajo
                        p.IdUsuario ||
                        p.idusuario ||
                        p.id ||
                        p.IdPaciente ||
                        p.idpaciente ||
                        p.pacienteId;
                    return typeof id === 'string' ? parseInt(id, 10) : id;
                })
                .filter((id: number) => id > 0);

            console.log('[Analisis] Pacientes asignados encontrados FINAL:', this.pacientesIds.length);
            console.log('[Analisis] IDs:', this.pacientesIds);

            if (this.pacientesIds.length === 0) {
                this.showInfo('Sin pacientes', 'No tienes pacientes asignados aún.');
            } else {
                this.showSuccess('Pacientes cargados', `Tienes ${this.pacientesIds.length} paciente(s) asignado(s).`);
            }

        } catch (error: any) {
            console.error('[Analisis] Error cargando pacientes asignados:', error);
            this.pacientesIds = [];
            this.pacientesAsignados = [];
            this.showWarning('Advertencia', 'No se pudieron cargar los pacientes asignados.');
        }
    }

    // ============================================================
    // CARGAR ANÁLISIS SOLO DE PACIENTES ASIGNADOS
    // ============================================================
    async cargarAnalisisDePacientesAsignados() {
        if (this.pacientesIds.length === 0) {
            this.analisis = [];
            this.calcularEstadisticas();
            this.aplicarFiltro('todos');
            this.cdr.detectChanges();
            return;
        }

        try {
            console.log('[Analisis] Cargando análisis de pacientes asignados...');

            const resultados: AnalisisItem[] = [];

            for (const pacienteId of this.pacientesIds) {
                try {
                    const response = await firstValueFrom(
                        this.usersService.obtenerUltimoExpediente(pacienteId)
                    ) as UltimoExpedienteResponse;

                    console.log(`[Analisis] Respuesta para paciente ${pacienteId}:`, response);

                    if (response && response.success && response.data) {
                        const data = response.data;

                        if (data.folio && data.folio > 0) {
                            const paciente = this.pacientesAsignados.find(
                                (p: any) => {
                                    const pId = p.id_usuario ||    // ← NUEVO
                                        p.IdUsuario ||
                                        p.idusuario ||
                                        p.id ||
                                        p.IdPaciente ||
                                        p.idpaciente ||
                                        p.pacienteId;
                                    return pId === pacienteId;
                                }
                            );

                            const nombreCompleto = paciente
                                ? [
                                    paciente.nombre || paciente.Nombre || '',
                                    paciente.apellido_paterno || paciente.apPaterno || paciente.ApPaterno || '',
                                    paciente.apellido_materno || paciente.apMaterno || paciente.ApMaterno || ''
                                ].filter(Boolean).join(' ').trim() || 'Paciente'
                                : `Paciente #${pacienteId}`;

                            const analisisItem: AnalisisItem = {
                                folio_expediente_db: data.folio,
                                fecha_analisis: data.fecha_consulta || new Date().toISOString(),
                                nivel_riesgo_clinico: data.nivel_riesgo || 'No disponible',
                                sistolica_usada: data.presion_pdf_sistolica || data.sistolica || 0,
                                diastolica_usada: data.presion_pdf_diastolica || data.diastolica || 0,
                                probabilidad_porcentual: data.probabilidad_porcentual || 0,
                                prediccion_crisis: data.prediccion_crisis || 0,
                                motor_inferencia_usado: data.motor_utilizado || 'No disponible',
                                nombre_paciente: nombreCompleto,
                                id_paciente: pacienteId,
                                cedula_medico: (data as any).cedula_medico || (data as any).cedula_medico_fk || '',
                                tiene_pdf_diagnostico: data.tiene_pdf_diagnostico || false,
                                pdf_diagnostico_base64: data.pdf_diagnostico_base64 || null
                            };

                            console.log(`[Analisis] Paciente ${pacienteId} - ${nombreCompleto} tiene análisis: Folio #${data.folio}`);
                            resultados.push(analisisItem);
                        } else {
                            console.log(`[Analisis] Paciente ${pacienteId} - NO tiene análisis (folio inválido o 0)`);
                        }
                    } else {
                        console.log(`[Analisis] Paciente ${pacienteId} - NO tiene análisis (respuesta sin datos)`);
                    }
                } catch (error) {
                    console.error(`[Analisis] Error cargando expediente del paciente ${pacienteId}:`, error);
                }
            }

            this.analisis = resultados;

            this.analisis.sort((a, b) => {
                return new Date(b.fecha_analisis).getTime() - new Date(a.fecha_analisis).getTime();
            });

            console.log('[Analisis] Análisis cargados de pacientes asignados:', this.analisis.length);

            this.analisis.forEach(item => {
                console.log(`  - Folio #${item.folio_expediente_db}: ${item.nombre_paciente} (${item.nivel_riesgo_clinico})`);
            });

            if (this.analisis.length === 0) {
                this.showInfo('Sin análisis', 'No hay análisis registrados para tus pacientes asignados.');
            } else {
                this.showSuccess('Éxito', `Se cargaron ${this.analisis.length} análisis de tus pacientes.`);
            }

            this.calcularEstadisticas();
            this.aplicarFiltro('todos');
            this.cdr.detectChanges();

        } catch (error) {
            console.error('Error cargando análisis de pacientes asignados:', error);
            this.analisis = [];
            this.calcularEstadisticas();
            this.aplicarFiltro('todos');
            this.showError('Error', 'No se pudieron cargar los análisis.');
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

    calcularEstadisticas() {
        this.estadisticas.total = this.analisis.length;
        this.estadisticas.criticos = this.analisis.filter(
            a => a.nivel_riesgo_clinico && a.nivel_riesgo_clinico.toUpperCase().includes('CRITICO')
        ).length;
        this.estadisticas.moderados = this.analisis.filter(
            a => a.nivel_riesgo_clinico && a.nivel_riesgo_clinico.toUpperCase().includes('MODERADO')
        ).length;
        this.estadisticas.estables = this.analisis.filter(
            a => a.nivel_riesgo_clinico && a.nivel_riesgo_clinico.toUpperCase().includes('ESTABLE')
        ).length;
        this.estadisticas.conPdf = this.analisis.filter(
            a => a.tiene_pdf_diagnostico === true
        ).length;
        this.estadisticas.sinPdf = this.estadisticas.total - this.estadisticas.conPdf;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        this.paginaActual = 1;
        this.filtrarAnalisis();
    }

    buscarAnalisis() {
        this.paginaActual = 1;
        this.filtrarAnalisis();
    }

    private filtrarAnalisis() {
        const term = this.searchTerm.toLowerCase().trim();

        this.analisisFiltrados = this.analisis.filter(item => {
            let matchEstado = true;
            if (this.filterEstado === 'critico') {
                matchEstado = item.nivel_riesgo_clinico?.toUpperCase().includes('CRITICO') || false;
            } else if (this.filterEstado === 'moderado') {
                matchEstado = item.nivel_riesgo_clinico?.toUpperCase().includes('MODERADO') || false;
            } else if (this.filterEstado === 'estable') {
                matchEstado = item.nivel_riesgo_clinico?.toUpperCase().includes('ESTABLE') || false;
            } else if (this.filterEstado === 'conPdf') {
                matchEstado = item.tiene_pdf_diagnostico === true;
            } else if (this.filterEstado === 'sinPdf') {
                matchEstado = item.tiene_pdf_diagnostico === false;
            }

            let matchSearch = true;
            if (term) {
                matchSearch =
                    String(item.folio_expediente_db).includes(term) ||
                    (item.nivel_riesgo_clinico || '').toLowerCase().includes(term) ||
                    String(item.probabilidad_porcentual).includes(term) ||
                    (item.nombre_paciente || '').toLowerCase().includes(term) ||
                    String(item.id_paciente).includes(term) ||
                    (item.cedula_medico || '').toLowerCase().includes(term);
            }

            return matchEstado && matchSearch;
        });
    }

    getItemsPaginados(): AnalisisItem[] {
        const start = (this.paginaActual - 1) * this.itemsPorPagina;
        const end = start + this.itemsPorPagina;
        return this.analisisFiltrados.slice(start, end);
    }

    get totalPaginas(): number {
        return Math.ceil(this.analisisFiltrados.length / this.itemsPorPagina);
    }

    cambiarPagina(pagina: number) {
        if (pagina >= 1 && pagina <= this.totalPaginas) {
            this.paginaActual = pagina;
            this.cdr.detectChanges();
        }
    }

    verDetalle(item: AnalisisItem) {
        const folio = item.folio_expediente_db;
        const idPaciente = item.id_paciente;

        console.log('[Analisis] Navegando a detalle:');
        console.log('  - ID del paciente:', idPaciente);
        console.log('  - Folio:', folio);
        console.log('  - Paciente:', item.nombre_paciente);

        if (idPaciente && folio) {
            this.router.navigate(['/doctor/analisis/detalle', idPaciente, folio]);
        } else if (idPaciente) {
            this.router.navigate(['/doctor/analisis/detalle', idPaciente]);
        } else {
            this.showError('Error', 'No se pudo identificar el análisis.');
        }
    }

    verPDF(item: AnalisisItem) {
        const folio = item.folio_expediente_db;
        const pdfBase64 = item.pdf_diagnostico_base64;

        if (pdfBase64) {
            const blob = this.base64ToBlob(pdfBase64, 'application/pdf');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } else if (folio) {
            this.descargarPDFDesdeServidor(folio);
        } else {
            this.showWarning('Sin PDF', 'Este análisis no tiene un PDF asociado.');
        }
    }

    private base64ToBlob(base64: string, contentType: string = 'application/pdf'): Blob {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    }

    private descargarPDFDesdeServidor(folio: number) {
        this.showInfo('Descargando', 'Cargando PDF desde el servidor...');

        this.usersService.obtenerPDFExpediente(folio).subscribe({
            next: (blob: Blob) => {
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60000);
                this.showSuccess('PDF cargado', 'El PDF se ha cargado correctamente.');
            },
            error: (error) => {
                console.error('[Analisis] Error descargando PDF:', error);
                let mensajeError = 'Error al cargar el PDF desde el servidor.';
                if (error.status === 404) {
                    mensajeError = 'El PDF no se encontró en el servidor.';
                } else if (error.status === 500) {
                    mensajeError = 'Error interno del servidor al cargar el PDF.';
                }
                this.showError('Error al cargar PDF', mensajeError);
            }
        });
    }

    volverAPacientes() {
        this.router.navigate(['/doctor/pacientes']);
    }

    recargarDatos() {
        this.cargarDatos();
    }

    mostrarConfirmacionEliminar(item: AnalisisItem) {
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
        const nivelUpper = nivel.toUpperCase();
        if (nivelUpper.includes('CRITICO')) return 'riesgo-critico';
        if (nivelUpper.includes('MODERADO')) return 'riesgo-moderado';
        if (nivelUpper.includes('ESTABLE')) return 'riesgo-estable';
        return '';
    }

    getRiesgoIcono(nivel: string): string {
        if (!nivel) return 'bi-circle';
        const nivelUpper = nivel.toUpperCase();
        if (nivelUpper.includes('CRITICO')) return 'bi-exclamation-octagon-fill';
        if (nivelUpper.includes('MODERADO')) return 'bi-exclamation-triangle-fill';
        if (nivelUpper.includes('ESTABLE')) return 'bi-check-circle-fill';
        return 'bi-circle';
    }

    getRiesgoColor(nivel: string): string {
        if (!nivel) return '#6c757d';
        const nivelUpper = nivel.toUpperCase();
        if (nivelUpper.includes('CRITICO')) return '#dc3545';
        if (nivelUpper.includes('MODERADO')) return '#fd7e14';
        if (nivelUpper.includes('ESTABLE')) return '#28a745';
        return '#6c757d';
    }
}