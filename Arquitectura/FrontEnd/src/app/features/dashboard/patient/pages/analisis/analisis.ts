import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PatientMenu } from "../../template/menu/menu";
import { Users, UltimoExpedienteResponse, AnalisisResponse } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';

interface AnalisisHistorial {
    folio_expediente_db: number;
    fecha_analisis: string;
    nivel_riesgo_clinico: string;
    sistolica_usada: number;
    diastolica_usada: number;
    probabilidad_porcentual: number;
    prediccion_crisis: number;
    motor_inferencia_usado: string;
}

interface ToastMessage {
    id: number;
    mensaje: string;
    tipo: 'success' | 'error' | 'warning' | 'info';
}

@Component({
    selector: 'app-patient-analisis',
    standalone: true,
    imports: [CommonModule, FormsModule, PatientMenu],
    templateUrl: './analisis.html',
    styleUrls: ['./analisis.css']
})
export class PatientAnalisis implements OnInit {
    private usersService = inject(Users);
    private sanitizer = inject(DomSanitizer);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private auth = inject(Auth);

    sistemaActivo = false;
    isAnalizando = false;
    isCargandoArchivos = false;
    isLoading = true;

    patientId: number | null = null;
    patientName: string = '';
    patientFullName: string = '';
    patientEmail: string = '';
    patientFechaNacimiento: string | null = null;
    pacienteEdad: number | null = null;

    analisisArchivo: File | null = null;
    analisisArchivoNombre: string = '';

    resultadoAnalisis: any = null;
    historialAnalisis: AnalisisHistorial[] = [];

    tieneArchivosExistentes = false;
    pdfExistenteBase64: string | null = null;
    archivoExistenteNombre: string = '';
    expedienteExistente: any = null;
    folioExpediente: number | null = null;

    toastMessages: ToastMessage[] = [];
    toastCounter = 0;

    modalVisible = false;
    modalTitulo = '';
    modalContenido = '';
    modalTipo: 'info' | 'success' | 'error' | 'warning' | 'confirm' = 'info';
    modalBotonConfirmar = 'Aceptar';
    modalBotonCancelar = 'Cancelar';
    modalOnConfirm: (() => void) | null = null;
    modalOnCancel: (() => void) | null = null;

    mostrarVistaPrevia = false;
    vistaPreviaUrl: SafeResourceUrl | null = null;
    vistaPreviaTitulo = '';
    vistaPreviaCargando = false;

    metrics = {
        totalAnalisis: 0,
        ultimoRiesgo: '',
        ultimaFecha: ''
    };

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.patientId = userData.idusuario || userData.uid || null;
                    this.patientName = userData.nombre || 'Paciente';
                    this.patientFullName = userData.nombreCompleto || userData.nombre || 'Paciente';
                    this.patientEmail = userData.correo || '';
                    this.patientFechaNacimiento = userData.fechaNacimiento || null;
                    this.pacienteEdad = userData.edad || userData.Edad || null;
                } catch (e) {
                    // Error parseando localStorage
                }
            }

            if (!this.patientId) {
                const user = this.auth.currentUser;
                if (user) {
                    this.patientEmail = user.email || '';
                    this.patientName = user.displayName || 'Paciente';
                }
            }

            if (this.patientId && !this.pacienteEdad && !this.patientFechaNacimiento) {
                await this.obtenerEdadDesdeBackend();
            }

            await this.verificarEstadoSistema();

            if (this.patientId) {
                await this.cargarExpedienteExistente();
            }

        } catch (error) {
            // Error inicializando
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    async obtenerEdadDesdeBackend() {
        try {
            if (!this.patientId) return;

            const usuario = await firstValueFrom(this.usersService.getUsuarioById(this.patientId));
            if (usuario && usuario.fechaNacimiento) {
                this.patientFechaNacimiento = usuario.fechaNacimiento;
                const storedUser = localStorage.getItem('user_htas');
                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    userData.fechaNacimiento = usuario.fechaNacimiento;
                    localStorage.setItem('user_htas', JSON.stringify(userData));
                }
            }
        } catch (error) {
            // Error obteniendo edad del backend
        }
    }

    private mostrarToast(mensaje: string, tipo: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 4000) {
        const id = ++this.toastCounter;
        const toast: ToastMessage = { id, mensaje, tipo };
        this.toastMessages.push(toast);
        this.cdr.detectChanges();

        setTimeout(() => {
            this.cerrarToast(id);
        }, duration);
    }

    cerrarToast(id: number) {
        this.toastMessages = this.toastMessages.filter(t => t.id !== id);
        this.cdr.detectChanges();
    }

    getToastIcon(tipo: string): string {
        switch (tipo) {
            case 'success': return 'bi-check-circle-fill';
            case 'error': return 'bi-x-circle-fill';
            case 'warning': return 'bi-exclamation-triangle-fill';
            default: return 'bi-info-circle-fill';
        }
    }

    getToastTitle(tipo: string): string {
        switch (tipo) {
            case 'success': return 'Exito';
            case 'error': return 'Error';
            case 'warning': return 'Advertencia';
            default: return 'Informacion';
        }
    }

    getToastClass(tipo: string): string {
        switch (tipo) {
            case 'success': return 'toast-success';
            case 'error': return 'toast-error';
            case 'warning': return 'toast-warning';
            default: return 'toast-info';
        }
    }

    abrirModal(config: {
        titulo: string;
        contenido: string;
        tipo?: 'info' | 'success' | 'error' | 'warning' | 'confirm';
        botonConfirmar?: string;
        botonCancelar?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    }) {
        this.modalTitulo = config.titulo;
        this.modalContenido = config.contenido;
        this.modalTipo = config.tipo || 'info';
        this.modalBotonConfirmar = config.botonConfirmar || 'Aceptar';
        this.modalBotonCancelar = config.botonCancelar || 'Cancelar';
        this.modalOnConfirm = config.onConfirm || null;
        this.modalOnCancel = config.onCancel || null;
        this.modalVisible = true;
        this.cdr.detectChanges();
    }

    cerrarModal() {
        this.modalVisible = false;
        this.modalOnConfirm = null;
        this.modalOnCancel = null;
        this.cdr.detectChanges();
    }

    confirmarModal() {
        if (this.modalOnConfirm) {
            this.modalOnConfirm();
        }
        this.cerrarModal();
    }

    cancelarModal() {
        if (this.modalOnCancel) {
            this.modalOnCancel();
        }
        this.cerrarModal();
    }

    abrirVistaPrevia(pdfBase64: string, titulo: string) {
        if (!pdfBase64) {
            this.mostrarToast('No hay documento para mostrar.', 'warning', 3000);
            return;
        }

        this.vistaPreviaCargando = true;
        this.vistaPreviaTitulo = titulo || 'Vista previa del documento';
        this.vistaPreviaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`data:application/pdf;base64,${pdfBase64}`);
        this.mostrarVistaPrevia = true;
        this.cdr.detectChanges();

        setTimeout(() => {
            this.vistaPreviaCargando = false;
            this.cdr.detectChanges();
        }, 1500);
    }

    cerrarVistaPrevia() {
        this.mostrarVistaPrevia = false;
        this.vistaPreviaUrl = null;
        this.vistaPreviaTitulo = '';
        this.vistaPreviaCargando = false;
        this.cdr.detectChanges();
    }

    descargarDesdeVistaPrevia() {
        this.descargarPdfExistente();
    }

    async verificarEstadoSistema() {
        try {
            const response = await firstValueFrom(this.usersService.verificarEstadoAlgoritmo());
            this.sistemaActivo = true;
            this.mostrarToast('Sistema de analisis activo', 'success', 3000);
        } catch (error) {
            this.sistemaActivo = false;
            this.mostrarToast('El sistema de analisis no esta disponible', 'warning', 5000);
        }
    }

    async cargarExpedienteExistente() {
        if (!this.patientId) {
            this.tieneArchivosExistentes = false;
            return;
        }

        this.isCargandoArchivos = true;
        try {
            const response = await firstValueFrom(
                this.usersService.obtenerUltimoExpediente(this.patientId)
            );

            if (response && response.success && response.data) {
                const data = response.data;

                if (data.folio && data.folio > 0) {
                    this.expedienteExistente = data;
                    this.tieneArchivosExistentes = true;
                    this.folioExpediente = data.folio;

                    if (data.pdf_diagnostico_base64) {
                        this.pdfExistenteBase64 = data.pdf_diagnostico_base64;
                        this.archivoExistenteNombre = `Expediente Folio #${data.folio}`;
                    } else {
                        this.pdfExistenteBase64 = null;
                        this.archivoExistenteNombre = `Expediente Folio #${data.folio}`;
                    }

                    if (data.nivel_riesgo) {
                        this.resultadoAnalisis = {
                            folio_expediente_db: data.folio,
                            cedula_pdf_valida: data.tiene_pdf_cedula || false,
                            diagnostico_pdf_valido: data.tiene_pdf_diagnostico || false,
                            prediccion_crisis: data.prediccion_crisis || 0,
                            probabilidad_porcentual: data.probabilidad_porcentual || 0,
                            nivel_riesgo_clinico: data.nivel_riesgo || 'No disponible',
                            protocolo_sugerido: this.obtenerProtocoloPorNivel(data.nivel_riesgo),
                            motor_inferencia_usado: data.motor_utilizado || 'No disponible',
                            sistolica_usada: data.presion_pdf_sistolica || data.sistolica || 0,
                            diastolica_usada: data.presion_pdf_diastolica || data.diastolica || 0,
                            valores_usados: data.presion_pdf_sistolica ? 'pdf' : 'payload',
                            fecha_consulta: data.fecha_consulta || new Date().toISOString()
                        };

                        this.metrics.ultimoRiesgo = data.nivel_riesgo;
                        this.metrics.ultimaFecha = data.fecha_consulta || new Date().toISOString();

                        const historialItem: AnalisisHistorial = {
                            folio_expediente_db: data.folio,
                            fecha_analisis: data.fecha_consulta || new Date().toISOString(),
                            nivel_riesgo_clinico: data.nivel_riesgo || 'No disponible',
                            sistolica_usada: data.presion_pdf_sistolica || data.sistolica || 0,
                            diastolica_usada: data.presion_pdf_diastolica || data.diastolica || 0,
                            probabilidad_porcentual: data.probabilidad_porcentual || 0,
                            prediccion_crisis: data.prediccion_crisis || 0,
                            motor_inferencia_usado: data.motor_utilizado || 'No disponible'
                        };
                        this.historialAnalisis = [historialItem];
                        this.metrics.totalAnalisis = this.historialAnalisis.length;
                    }

                    this.mostrarToast(`Expediente encontrado (Folio #${data.folio})`, 'success', 3000);
                } else {
                    this.limpiarExpediente();
                }
            } else {
                this.limpiarExpediente();
            }

            this.cdr.detectChanges();

        } catch (error) {
            this.limpiarExpediente();
        } finally {
            this.isCargandoArchivos = false;
            this.cdr.detectChanges();
        }
    }

    private limpiarExpediente() {
        this.tieneArchivosExistentes = false;
        this.expedienteExistente = null;
        this.folioExpediente = null;
        this.pdfExistenteBase64 = null;
        this.resultadoAnalisis = null;
        this.historialAnalisis = [];
        this.metrics.totalAnalisis = 0;
    }

    obtenerProtocoloPorNivel(nivel: string): string {
        if (!nivel) return 'Protocolo no disponible';
        if (nivel.includes('CRITICO')) {
            return 'Riesgo severo inminente. El paciente requiere traslado urgente a una clinica medica o administracion inmediata de farmacos de rescate.';
        }
        if (nivel.includes('MODERADO')) {
            return 'Estadio clinico elevado. Se aconseja reposar 15 minutos, re-evaluar la presion y concertar una cita medica en menos de 24 horas.';
        }
        return 'Presion arterial dentro de los limites esperados o bajo adecuado control farmacologico. Continuar con monitoreo preventivo.';
    }

    calcularEdad(): number | null {
        if (this.pacienteEdad !== null && this.pacienteEdad > 0) {
            return this.pacienteEdad;
        }

        let fechaNacimiento = this.patientFechaNacimiento;

        if (!fechaNacimiento) {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    fechaNacimiento = userData.fechaNacimiento || null;
                } catch (e) {
                    // Error obteniendo fecha de nacimiento
                }
            }
        }

        if (!fechaNacimiento) {
            return null;
        }

        const nacimiento = new Date(fechaNacimiento);
        if (isNaN(nacimiento.getTime())) {
            return null;
        }

        const hoy = new Date();
        let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
        const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
        if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) {
            edad--;
        }
        this.pacienteEdad = edad >= 0 ? edad : null;
        return this.pacienteEdad;
    }

    abrirSelectorArchivo() {
        const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
    }

    onAnalisisFileSelected(event: any) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            if (file.size > 10 * 1024 * 1024) {
                this.mostrarToast('El archivo es demasiado grande. Maximo 10MB.', 'error', 4000);
                return;
            }
            this.analisisArchivo = file;
            this.analisisArchivoNombre = file.name;
            this.mostrarToast('PDF cargado correctamente.', 'success', 3000);
            this.cdr.detectChanges();
        } else {
            this.mostrarToast('Solo se permiten archivos PDF.', 'error', 3000);
            this.analisisArchivo = null;
            this.analisisArchivoNombre = '';
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget as HTMLElement;
        target.classList.add('dragover');
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget as HTMLElement;
        target.classList.remove('dragover');
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget as HTMLElement;
        target.classList.remove('dragover');

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                if (file.size > 10 * 1024 * 1024) {
                    this.mostrarToast('El archivo es demasiado grande. Maximo 10MB.', 'error', 4000);
                    return;
                }
                this.analisisArchivo = file;
                this.analisisArchivoNombre = file.name;
                this.mostrarToast('PDF cargado correctamente.', 'success', 3000);
                this.cdr.detectChanges();
            } else {
                this.mostrarToast('Solo se permiten archivos PDF.', 'error', 3000);
            }
        }
    }

    descargarPdfExistente() {
        if (this.pdfExistenteBase64) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${this.pdfExistenteBase64}`;
            link.download = this.archivoExistenteNombre || 'expediente.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.mostrarToast('Descargando PDF...', 'success', 2000);
        } else if (this.folioExpediente) {
            this.mostrarToast('Cargando PDF desde el servidor...', 'info', 2000);
            this.descargarPDFDesdeServidor(this.folioExpediente);
        } else {
            this.mostrarToast('No hay PDF para descargar.', 'warning', 3000);
        }
    }

    verPdfExistente() {
        if (this.pdfExistenteBase64) {
            this.abrirVistaPrevia(
                this.pdfExistenteBase64,
                this.archivoExistenteNombre || 'Expediente'
            );
        } else if (this.folioExpediente) {
            this.descargarPDFDesdeServidor(this.folioExpediente);
        } else {
            this.mostrarToast('No hay PDF para ver. Sube un archivo primero.', 'warning', 3000);
        }
    }

    descargarPDFDesdeServidor(folio: number) {
        this.mostrarToast('Cargando PDF desde el servidor...', 'info', 2000);
        this.vistaPreviaCargando = true;
        this.mostrarVistaPrevia = true;
        this.vistaPreviaTitulo = 'Cargando documento...';
        this.cdr.detectChanges();

        this.usersService.obtenerPDFExpediente(folio).subscribe({
            next: (blob: Blob) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64 = (e.target?.result as string).split(',')[1];
                    this.pdfExistenteBase64 = base64;
                    this.archivoExistenteNombre = `Expediente Folio #${folio}`;
                    this.vistaPreviaCargando = false;
                    this.vistaPreviaTitulo = `Expediente Folio #${folio}`;
                    this.vistaPreviaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`data:application/pdf;base64,${base64}`);
                    this.cdr.detectChanges();
                    this.mostrarToast('PDF cargado correctamente.', 'success', 2000);
                };
                reader.readAsDataURL(blob);
            },
            error: (error) => {
                this.vistaPreviaCargando = false;
                this.mostrarVistaPrevia = false;
                let mensajeError = 'Error al cargar el PDF desde el servidor.';
                if (error.status === 404) {
                    mensajeError = 'El PDF no se encontró en el servidor.';
                } else if (error.status === 500) {
                    mensajeError = 'Error interno del servidor al cargar el PDF.';
                }
                this.mostrarToast(mensajeError, 'error', 4000);
                this.cdr.detectChanges();
            }
        });
    }

    ejecutarAnalisis() {
        if (!this.analisisArchivo) {
            this.mostrarToast('Por favor, seleccione un archivo PDF.', 'warning', 3000);
            return;
        }

        if (!this.sistemaActivo) {
            this.mostrarToast('El sistema de analisis no esta disponible.', 'error', 4000);
            return;
        }

        if (!this.patientId) {
            this.mostrarToast('No se ha identificado al paciente.', 'error', 3000);
            return;
        }

        if (this.tieneArchivosExistentes) {
            this.abrirModal({
                titulo: 'Actualizar Expediente',
                contenido: 'Ya existe un expediente para este paciente. ¿Desea actualizarlo con el nuevo archivo?',
                tipo: 'confirm',
                botonConfirmar: 'Si, actualizar',
                botonCancelar: 'Cancelar',
                onConfirm: () => {
                    this.procesarAnalisis();
                },
                onCancel: () => {
                    this.mostrarToast('Analisis cancelado.', 'info', 2000);
                }
            });
            return;
        }

        this.procesarAnalisis();
    }

    private procesarAnalisis() {
        this.isAnalizando = true;
        this.resultadoAnalisis = null;

        const edad = this.calcularEdad();
        let edadFinal = edad;

        if (edadFinal === null) {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    if (userData.edad) {
                        edadFinal = userData.edad;
                    }
                } catch (e) {
                    // Error obteniendo edad
                }
            }
        }

        if (edadFinal === null) {
            edadFinal = 30;
            this.mostrarToast('No se encontró fecha de nacimiento. Usando edad predeterminada (30 años) para el análisis. Por favor, actualiza tu perfil.', 'warning', 5000);
        }

        if (!this.analisisArchivo) {
            this.mostrarToast('No hay archivo para analizar.', 'error', 3000);
            this.isAnalizando = false;
            return;
        }

        if (!this.patientId) {
            this.mostrarToast('No se ha identificado al paciente.', 'error', 3000);
            this.isAnalizando = false;
            return;
        }

        const archivoActual = this.analisisArchivo;

        const request = {
            idPaciente: this.patientId,
            idDoctor: undefined,
            edad: edadFinal,
            sistolica: 120,
            diastolica: 80,
            tomaMedicamento: 0,
            cedulaMedico: '',
            pdf: archivoActual
        };

        this.usersService.analizarConPDF(request).subscribe({
            next: (response: AnalisisResponse) => {
                this.isAnalizando = false;

                if (response.success && response.data) {
                    const data = response.data;
                    this.resultadoAnalisis = data;
                    this.tieneArchivosExistentes = true;
                    this.folioExpediente = data.folio_expediente_db || null;

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64 = (e.target?.result as string).split(',')[1];
                        this.pdfExistenteBase64 = base64;
                        this.archivoExistenteNombre = `Expediente ${archivoActual.name}`;
                        this.cdr.detectChanges();

                        setTimeout(() => {
                            this.abrirVistaPrevia(base64, `Resultado Analisis - Folio #${this.folioExpediente || 'sin folio'}`);
                        }, 1000);
                    };
                    reader.readAsDataURL(archivoActual);

                    const historialItem: AnalisisHistorial = {
                        folio_expediente_db: data.folio_expediente_db || 0,
                        fecha_analisis: new Date().toISOString(),
                        nivel_riesgo_clinico: data.nivel_riesgo_clinico,
                        sistolica_usada: data.sistolica_usada || 0,
                        diastolica_usada: data.diastolica_usada || 0,
                        probabilidad_porcentual: data.probabilidad_porcentual,
                        prediccion_crisis: data.prediccion_crisis,
                        motor_inferencia_usado: data.motor_inferencia_usado
                    };
                    this.historialAnalisis.unshift(historialItem);
                    this.metrics.totalAnalisis = this.historialAnalisis.length;
                    this.metrics.ultimoRiesgo = data.nivel_riesgo_clinico;
                    this.metrics.ultimaFecha = new Date().toISOString();

                    this.mostrarToast(`Analisis completado exitosamente. Folio #${this.folioExpediente || 'sin folio'}`, 'success', 5000);
                    this.cdr.detectChanges();

                    if (this.patientId) {
                        this.cargarExpedienteExistente();
                    }
                } else {
                    this.mostrarToast(response?.mensaje || 'Error en el analisis.', 'error', 4000);
                }
            },
            error: (error) => {
                this.isAnalizando = false;
                let mensajeError = 'Error al analizar el paciente.';
                if (error.error?.error) {
                    mensajeError = error.error.error;
                } else if (error.message) {
                    mensajeError = error.message;
                }
                this.mostrarToast(mensajeError, 'error', 5000);
                this.cdr.detectChanges();
            }
        });
    }

    limpiarAnalisis() {
        this.resultadoAnalisis = null;
        this.analisisArchivo = null;
        this.analisisArchivoNombre = '';
        const fileInput = document.getElementById('pdfFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        this.mostrarToast('Analisis limpiado.', 'info', 2000);
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

    formatearFechaAnalisis(fechaISO: string): string {
        if (!fechaISO) return 'Fecha no disponible';

        try {
            const fechaObj = new Date(fechaISO);
            if (isNaN(fechaObj.getTime())) {
                return fechaISO;
            }
            return fechaObj.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return fechaISO;
        }
    }

    descargarResultadosPDF() {
        if (!isPlatformBrowser(this.platformId) || !this.resultadoAnalisis) return;

        const r = this.resultadoAnalisis;

        const nombreCompleto = this.patientFullName || this.patientName || 'Paciente';

        const colorPrimary: [number, number, number] = [176, 0, 30];
        const colorDark: [number, number, number] = [10, 22, 40];
        const colorGray: [number, number, number] = [122, 138, 158];
        const colorTextMuted: [number, number, number] = [74, 90, 110];
        const colorLight: [number, number, number] = [248, 249, 250];
        const colorBorder: [number, number, number] = [230, 233, 237];
        const colorWhite: [number, number, number] = [255, 255, 255];

        let riesgoColor: [number, number, number] = [217, 119, 6];
        const nivelRiesgo: string = r.nivel_riesgo_clinico || 'No disponible';
        if (nivelRiesgo.includes('CRITICO')) riesgoColor = [220, 38, 38];
        else if (nivelRiesgo.includes('ESTABLE')) riesgoColor = [5, 150, 105];
        else if (nivelRiesgo.includes('MODERADO')) riesgoColor = [217, 119, 6];

        const doc = new jsPDF({ unit: 'mm', format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 20;
        const marginY = 20;
        let y = marginY;

        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.rect(0, 0, pageWidth, 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text('Resultados del Analisis HTAS', marginX, y + 10);

        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, y + 14, marginX + 62, y + 14);

        const fechaGen = new Date().toLocaleString('es-MX', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text(`Folio #${r.folio_expediente_db ?? '---'}`, pageWidth - marginX, y + 10, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Generado: ${fechaGen}`, pageWidth - marginX, y + 16, { align: 'right' });

        y += 28;

        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 8;

        doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 18, 3, 3, 'FD');

        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        const circleX = marginX + 11;
        const circleY = y + 9;
        const circleRadius = 6.5;
        doc.circle(circleX, circleY, circleRadius, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        const primeraLetra = nombreCompleto.charAt(0).toUpperCase() || 'P';
        doc.text(primeraLetra, circleX, circleY, { align: 'center', baseline: 'middle' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text(nombreCompleto, marginX + 24, y + 8);

        if (this.patientEmail) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(this.patientEmail, marginX + 24, y + 15);
        }

        doc.setFillColor(59, 130, 246);
        const badgeX = pageWidth - marginX - 32;
        const badgeY = y + 2;
        doc.roundedRect(badgeX, badgeY, 26, 7, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        const badgeText = 'HTAS';
        const badgeTextWidth = doc.getStringUnitWidth(badgeText) * 5.5 / doc.internal.scaleFactor;
        const badgeTextX = badgeX + (26 / 2) - (badgeTextWidth / 2);
        const badgeTextY = badgeY + 4.5;
        doc.text(badgeText, badgeTextX, badgeTextY);

        y += 26;

        const iconAreaWidth = 32;
        const presionBlockWidth = 55;
        const nivelMaxWidth = pageWidth - marginX * 2 - iconAreaWidth - presionBlockWidth;

        let nivelFontSize = 16;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(nivelFontSize);
        let nivelLineas = doc.splitTextToSize(nivelRiesgo, nivelMaxWidth);

        while (nivelLineas.length > 1 && nivelFontSize > 10) {
            nivelFontSize -= 0.5;
            doc.setFontSize(nivelFontSize);
            nivelLineas = doc.splitTextToSize(nivelRiesgo, nivelMaxWidth);
        }

        const bannerH = nivelLineas.length > 1 ? 36 : 30;
        const bannerCircleY = y + bannerH / 2;

        doc.setFillColor(riesgoColor[0], riesgoColor[1], riesgoColor[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, bannerH, 5, 5, 'F');

        doc.setFillColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        doc.circle(marginX + 16, bannerCircleY, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(riesgoColor[0], riesgoColor[1], riesgoColor[2]);

        let icono = '!';
        if (nivelRiesgo.includes('CRITICO')) icono = 'X';
        else if (nivelRiesgo.includes('ESTABLE')) icono = 'OK';
        else if (nivelRiesgo.includes('MODERADO')) icono = '!';
        doc.text(icono, marginX + 16, bannerCircleY, { align: 'center', baseline: 'middle' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        doc.text('NIVEL DE RIESGO CLINICO', marginX + 32, y + 8);
        doc.setFontSize(nivelFontSize);
        doc.text(nivelLineas, marginX + 32, y + 17);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('PRESION ARTERIAL', pageWidth - marginX - 6, y + 8, { align: 'right' });
        doc.setFontSize(16);
        doc.text(`${r.sistolica_usada}/${r.diastolica_usada} mmHg`, pageWidth - marginX - 6, y + bannerH - 7, { align: 'right' });
        doc.setFontSize(7.5);
        doc.text('Sistolica / Diastolica', pageWidth - marginX - 6, y + bannerH - 3, { align: 'right' });

        y += bannerH + 12;

        const gap = 6;
        const colWidth = (pageWidth - marginX * 2 - gap * 2) / 3;
        const boxH = 26;

        const drawInfoBox = (x: number, label: string, value: string, icon: string, bgColor: [number, number, number]) => {
            doc.setFillColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
            doc.roundedRect(x, y, colWidth, boxH, 4, 4, 'FD');

            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            const innerCircleX = x + 11;
            const innerCircleY = y + 13;
            const innerCircleR = 9;
            doc.circle(innerCircleX, innerCircleY, innerCircleR, 'F');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text(icon, innerCircleX, innerCircleY, { align: 'center', baseline: 'middle' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(label.toUpperCase(), x + 26, y + 7);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
            const valorLineas = doc.splitTextToSize(value, colWidth - 30);
            doc.text(valorLineas, x + 26, y + 18);
        };

        drawInfoBox(marginX, 'Prediccion de Crisis', r.prediccion_crisis ? 'Positiva' : 'Negativa', r.prediccion_crisis ? '!' : 'OK', r.prediccion_crisis ? [239, 68, 68] : [16, 185, 129]);
        drawInfoBox(marginX + colWidth + gap, 'Probabilidad', `${r.probabilidad_porcentual}%`, '%', [59, 130, 246]);
        drawInfoBox(marginX + (colWidth + gap) * 2, 'Motor IA', r.motor_inferencia_usado || 'No disponible', 'G', [100, 100, 120]);

        y += boxH + 12;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Protocolo Sugerido', marginX, y);
        y += 3;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 42, y);
        y += 6;

        doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 18, 4, 4, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
        const protocoloLineas = doc.splitTextToSize(r.protocolo_sugerido || 'No disponible', pageWidth - marginX * 2 - 8);
        doc.text(protocoloLineas, marginX + 4, y + 5);
        y += 26;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Detalles del Analisis', marginX, y);
        y += 3;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 47, y);
        y += 6;

        const detalles: Array<[string, string]> = [
            ['Fuente de valores', r.valores_usados || 'No disponible'],
            ['PDF Cedula', r.cedula_pdf_valida ? 'Valida' : 'Invalida'],
            ['PDF Diagnostico', r.diagnostico_pdf_valido ? 'Valido' : 'Invalido']
        ];
        if (r.doctorId) {
            detalles.push(['Doctor', `ID: ${r.doctorId}${r.doctorNombre ? ' - ' + r.doctorNombre : ''}`]);
        }

        const detColWidth = (pageWidth - marginX * 2) / 2;
        doc.setFontSize(9);
        detalles.forEach(([label, value], index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = marginX + col * detColWidth;
            const yPos = y + row * 7.5;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(label + ':', x, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
            doc.text(String(value), x + 33, yPos);
        });
        y += 20;

        y = Math.max(y, pageHeight - 30);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('Documento generado electronicamente', marginX, y + 5);

        doc.setFillColor(16, 185, 129);
        const selloX = pageWidth - marginX - 6;
        const selloY = y + 5;
        doc.circle(selloX, selloY, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        doc.text('OK', selloX, selloY, { align: 'center', baseline: 'middle' });

        doc.text('Firma del Medico Responsable', pageWidth - marginX - 52, y + 5);
        doc.setDrawColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.setLineWidth(0.3);
        doc.line(pageWidth - marginX - 48, y + 7, pageWidth - marginX - 10, y + 7);

        doc.save(`Analisis_HTAS_Folio_${r.folio_expediente_db ?? 'sin_folio'}.pdf`);
        this.mostrarToast('PDF de resultados descargado.', 'success', 2000);
    }
}