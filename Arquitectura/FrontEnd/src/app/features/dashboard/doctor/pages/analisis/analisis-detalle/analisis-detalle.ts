import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DoctorMenu } from "../../../template/menu/menu";
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import jsPDF from 'jspdf';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

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

@Component({
    selector: 'app-doctor-analisis-detalle',
    standalone: true,
    imports: [CommonModule, FormsModule, DoctorMenu],
    templateUrl: './analisis-detalle.html',
    styleUrls: ['./analisis-detalle.css']
})
export class DoctorAnalisisDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private sanitizer = inject(DomSanitizer);

    // Estado
    isLoading = true;
    pacienteId: number | null = null;
    folio: number | null = null;

    // Datos del PACIENTE
    patientName: string = '';
    patientFullName: string = '';
    patientEmail: string = '';
    pacienteEdad: number | null = null;

    // Datos del analisis actual
    resultadoAnalisis: any = null;
    pdfExistenteBase64: string | null = null;
    archivoExistenteNombre: string = '';

    // Historial de analisis
    historialAnalisis: AnalisisHistorial[] = [];
    cargandoHistorial = false;

    // Subir expediente
    expedienteArchivo: File | null = null;
    expedienteNombre: string = '';
    subiendoExpediente = false;

    // Notificaciones
    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    // Modal
    mostrarModalConfirmacion = false;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoAccion = false;

    // Vista previa PDF
    mostrarVistaPrevia = false;
    vistaPreviaUrl: SafeResourceUrl | null = null;
    vistaPreviaTitulo = '';
    vistaPreviaCargando = false;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.route.params.subscribe(params => {
            console.log('[AnalisisDetalle] Parametros de la URL:', params);

            // ✅ CORREGIDO: Asegurar que se obtiene el ID correcto
            const idParam = params['id'];
            this.pacienteId = idParam ? parseInt(idParam) : null;
            this.folio = params['folio'] ? parseInt(params['folio']) : null;

            console.log('[AnalisisDetalle] ID del paciente extraído:', this.pacienteId);
            console.log('[AnalisisDetalle] Folio extraído:', this.folio);

            if (this.pacienteId) {
                this.cargarDatos();
            } else {
                console.error('[AnalisisDetalle] No se encontró ID de paciente en la URL');
                this.isLoading = false;
            }
        });
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
    // CARGA DE DATOS
    // ============================================================
    async cargarDatos() {
        this.isLoading = true;
        try {
            console.log('[AnalisisDetalle] Iniciando carga de datos...');
            console.log('[AnalisisDetalle] ID del paciente a usar:', this.pacienteId);

            await this.cargarDatosPaciente();
            await this.cargarExpedienteActual();
            await this.cargarHistorialAnalisis();

            console.log('[AnalisisDetalle] Datos cargados correctamente');
        } catch (error) {
            console.error('[AnalisisDetalle] Error cargando datos:', error);
            this.showError('Error', 'No se pudieron cargar los datos del analisis.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // CARGAR DATOS DEL PACIENTE - CORREGIDO
    // ============================================================
    async cargarDatosPaciente() {
        try {
            if (!this.pacienteId) {
                console.warn('[AnalisisDetalle] No hay ID de paciente para cargar');
                return;
            }

            console.log('[AnalisisDetalle] Cargando datos del paciente con ID:', this.pacienteId);

            // ✅ USAR getUsuarioById con el ID del paciente
            const usuario = await firstValueFrom(this.usersService.getUsuarioById(this.pacienteId));

            console.log('[AnalisisDetalle] Respuesta del servidor:', usuario);

            if (usuario) {
                // ✅ Asignar los datos del PACIENTE
                this.patientName = usuario.nombre || 'Paciente';
                this.patientFullName = `${usuario.nombre || ''} ${usuario.apPaterno || ''} ${usuario.apMaterno || ''}`.trim() || 'Paciente';
                this.patientEmail = usuario.correo || '';

                if (usuario.fechaNacimiento) {
                    this.pacienteEdad = this.calcularEdad(usuario.fechaNacimiento);
                }

                console.log('[AnalisisDetalle] DATOS DEL PACIENTE ASIGNADOS:');
                console.log('  - ID:', usuario.idusuario);
                console.log('  - Nombre:', this.patientName);
                console.log('  - Nombre Completo:', this.patientFullName);
                console.log('  - Email:', this.patientEmail);
                console.log('  - Edad:', this.pacienteEdad);
                console.log('  - Rol:', usuario.rol);
            } else {
                console.warn('[AnalisisDetalle] No se encontró el usuario con ID:', this.pacienteId);
            }
        } catch (error) {
            console.error('[AnalisisDetalle] Error cargando paciente:', error);
            this.showError('Error', 'No se pudieron cargar los datos del paciente.');
        }
    }

    // ============================================================
    // EXPEDIENTE ACTUAL
    // ============================================================
    async cargarExpedienteActual() {
        try {
            if (!this.pacienteId) return;

            const response = await firstValueFrom(
                this.usersService.obtenerUltimoExpediente(this.pacienteId)
            );

            console.log('[AnalisisDetalle] Expediente:', response);

            if (response && response.success && response.data) {
                const data = response.data;

                this.resultadoAnalisis = {
                    folio_expediente_db: data.folio || this.folio || 0,
                    cedula_pdf_valida: data.tiene_pdf_cedula || false,
                    diagnostico_pdf_valido: data.tiene_pdf_diagnostico || false,
                    prediccion_crisis: data.prediccion_crisis || 0,
                    probabilidad_porcentual: data.probabilidad_porcentual || 0,
                    nivel_riesgo_clinico: data.nivel_riesgo || 'No disponible',
                    protocolo_sugerido: this.obtenerProtocoloPorNivel(data.nivel_riesgo),
                    motor_inferencia_usado: data.motor_utilizado || 'No disponible',
                    sistolica_usada: data.presion_pdf_sistolica || data.sistolica || 0,
                    diastolica_usada: data.presion_pdf_diastolica || data.diastolica || 0,
                    valores_usados: 'pdf',
                    fecha_consulta: data.fecha_consulta || new Date().toISOString()
                };

                this.pdfExistenteBase64 = data.pdf_diagnostico_base64 || null;
                if (this.pdfExistenteBase64) {
                    this.archivoExistenteNombre = `Expediente Folio #${this.folio || data.folio || 'sin folio'}`;
                }
            }
        } catch (error) {
            console.error('[AnalisisDetalle] Error cargando expediente:', error);
        }
    }

    // ============================================================
    // HISTORIAL DE ANALISIS
    // ============================================================
    async cargarHistorialAnalisis() {
        this.cargandoHistorial = true;
        try {
            if (!this.pacienteId) return;

            const response = await firstValueFrom(
                this.usersService.obtenerUltimoExpediente(this.pacienteId)
            );

            if (response && response.success && response.data) {
                const data = response.data;

                const historialItem: AnalisisHistorial = {
                    folio_expediente_db: data.folio || 0,
                    fecha_analisis: data.fecha_consulta || new Date().toISOString(),
                    nivel_riesgo_clinico: data.nivel_riesgo || 'No disponible',
                    sistolica_usada: data.presion_pdf_sistolica || data.sistolica || 0,
                    diastolica_usada: data.presion_pdf_diastolica || data.diastolica || 0,
                    probabilidad_porcentual: data.probabilidad_porcentual || 0,
                    prediccion_crisis: data.prediccion_crisis || 0,
                    motor_inferencia_usado: data.motor_utilizado || 'No disponible'
                };

                this.historialAnalisis = [historialItem];
                console.log('[AnalisisDetalle] Historial cargado:', this.historialAnalisis.length);
            }
        } catch (error) {
            console.error('[AnalisisDetalle] Error cargando historial:', error);
        } finally {
            this.cargandoHistorial = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // SUBIR/ACTUALIZAR EXPEDIENTE
    // ============================================================
    onExpedienteSelected(event: any) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            if (file.size > 10 * 1024 * 1024) {
                this.showError('Error', 'El archivo es demasiado grande. Maximo 10MB.');
                return;
            }
            this.expedienteArchivo = file;
            this.expedienteNombre = file.name;
            this.showSuccess('Archivo cargado', `"${file.name}" listo para subir`);
        } else {
            this.showError('Error', 'Solo se permiten archivos PDF.');
            this.expedienteArchivo = null;
            this.expedienteNombre = '';
        }
    }

    async subirExpediente() {
        if (!this.expedienteArchivo) {
            this.showWarning('Sin archivo', 'Por favor selecciona un archivo PDF.');
            return;
        }

        if (!this.pacienteId) {
            this.showError('Error', 'No se ha identificado al paciente.');
            return;
        }

        this.subiendoExpediente = true;
        try {
            const edad = this.pacienteEdad || 30;

            const request = {
                idPaciente: this.pacienteId,
                edad: edad,
                sistolica: 120,
                diastolica: 80,
                tomaMedicamento: 0,
                cedulaMedico: '',
                pdf: this.expedienteArchivo
            };

            console.log('[AnalisisDetalle] Subiendo expediente...');

            const response = await firstValueFrom(
                this.usersService.analizarConPDF(request)
            );

            console.log('[AnalisisDetalle] Respuesta:', response);

            if (response && response.success) {
                this.showSuccess('Exito', 'Expediente actualizado correctamente.');
                this.expedienteArchivo = null;
                this.expedienteNombre = '';
                await this.cargarExpedienteActual();
                await this.cargarHistorialAnalisis();
                const fileInput = document.getElementById('fileExpediente') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                this.showError('Error', response?.mensaje || 'Error al subir el expediente.');
            }
        } catch (error: any) {
            console.error('[AnalisisDetalle] Error subiendo expediente:', error);
            this.showError('Error', error.error?.error || error.message || 'Error al subir el expediente.');
        } finally {
            this.subiendoExpediente = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // PROTOCOLOS
    // ============================================================
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

    // ============================================================
    // VISTA PREVIA PDF
    // ============================================================
    verPdfExistente() {
        if (this.pdfExistenteBase64) {
            this.abrirVistaPrevia(
                this.pdfExistenteBase64,
                this.archivoExistenteNombre || 'Expediente'
            );
        } else if (this.folio) {
            this.descargarPDFDesdeServidor(this.folio);
        } else {
            this.showWarning('Sin PDF', 'No hay PDF disponible para este analisis.');
        }
    }

    abrirVistaPrevia(pdfBase64: string, titulo: string) {
        if (!pdfBase64) {
            this.showWarning('Sin documento', 'No hay documento para mostrar.');
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

    descargarPdfExistente() {
        if (this.pdfExistenteBase64) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${this.pdfExistenteBase64}`;
            link.download = this.archivoExistenteNombre || 'expediente.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showSuccess('Descargando', 'El PDF se esta descargando...');
        } else if (this.folio) {
            this.descargarPDFDesdeServidor(this.folio);
        } else {
            this.showWarning('Sin PDF', 'No hay PDF para descargar.');
        }
    }

    descargarPDFDesdeServidor(folio: number) {
        this.showInfo('Cargando', 'Obteniendo PDF del servidor...');
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
                    this.vistaPreviaCargando = false;
                    this.vistaPreviaTitulo = `Expediente Folio #${folio}`;
                    this.vistaPreviaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`data:application/pdf;base64,${base64}`);
                    this.cdr.detectChanges();
                    this.showSuccess('PDF cargado', 'Documento cargado correctamente.');
                };
                reader.readAsDataURL(blob);
            },
            error: (error) => {
                this.vistaPreviaCargando = false;
                this.mostrarVistaPrevia = false;
                console.error('[AnalisisDetalle] Error descargando PDF:', error);
                this.showError('Error', 'No se pudo cargar el PDF desde el servidor.');
                this.cdr.detectChanges();
            }
        });
    }

    // ============================================================
    // NAVEGACION
    // ============================================================
    volver() {
        this.router.navigate(['/doctor/analisis']);
    }

    volverAPacientes() {
        this.router.navigate(['/doctor/pacientes']);
    }

    // ============================================================
    // MODAL DE CONFIRMACION
    // ============================================================
    mostrarConfirmacionEliminar() {
        this.modalConfirmacion = {
            titulo: 'Eliminar Analisis',
            mensaje: 'Esta seguro de que desea eliminar este analisis? Esta accion no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        document.body.style.overflow = '';
        this.cdr.detectChanges();
    }

    async ejecutarEliminarAnalisis() {
        this.cargandoAccion = true;
        this.cdr.detectChanges();

        try {
            this.showWarning('Funcion no disponible', 'La eliminacion de analisis esta en desarrollo.');
            this.cerrarModalConfirmacion();
        } catch (error: any) {
            this.showError('Error', error.message || 'Error al eliminar el analisis.');
            this.cerrarModalConfirmacion();
        } finally {
            this.cargandoAccion = false;
            this.cdr.detectChanges();
        }
    }

    // ============================================================
    // DESCARGA DE RESULTADOS PDF
    // ============================================================
    descargarResultadosPDF() {
        if (!isPlatformBrowser(this.platformId) || !this.resultadoAnalisis) {
            this.showError('Error', 'No hay datos para generar el PDF.');
            return;
        }

        try {
            const r = this.resultadoAnalisis;
            const nombreCompleto = this.patientFullName || this.patientName || 'Paciente';

            const doc = new jsPDF({ unit: 'mm', format: 'letter' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const marginX = 20;
            let y = 20;

            const colorPrimary: [number, number, number] = [176, 0, 30];
            const colorDark: [number, number, number] = [10, 22, 40];
            const colorGray: [number, number, number] = [122, 138, 158];
            const colorLight: [number, number, number] = [248, 249, 250];
            const colorBorder: [number, number, number] = [230, 233, 237];
            const colorWhite: [number, number, number] = [255, 255, 255];
            const colorSuccess: [number, number, number] = [16, 185, 129];
            const colorDanger: [number, number, number] = [239, 68, 68];

            let riesgoColor: [number, number, number] = [217, 119, 6];
            const nivelRiesgo: string = r.nivel_riesgo_clinico || 'No disponible';
            if (nivelRiesgo.includes('CRITICO')) riesgoColor = [220, 38, 38];
            else if (nivelRiesgo.includes('ESTABLE')) riesgoColor = [5, 150, 105];
            else if (nivelRiesgo.includes('MODERADO')) riesgoColor = [217, 119, 6];

            doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.rect(0, 0, pageWidth, 4, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
            doc.text('Resultados del Analisis HTAS', marginX, y + 10);

            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.8);
            doc.line(marginX, y + 14, marginX + 70, y + 14);

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

            // Informacion del PACIENTE
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

            y += 26;

            const bannerH = 30;
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
            else if (nivelRiesgo.includes('ESTABLE')) icono = 'V';
            else if (nivelRiesgo.includes('MODERADO')) icono = '!';
            doc.text(icono, marginX + 16, bannerCircleY, { align: 'center', baseline: 'middle' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text('NIVEL DE RIESGO CLINICO', marginX + 32, y + 8);
            doc.setFontSize(14);
            doc.text(nivelRiesgo, marginX + 32, y + 20);

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
                doc.text(value, x + 26, y + 18);
            };

            drawInfoBox(marginX, 'Prediccion de Crisis', r.prediccion_crisis ? 'Positiva' : 'Negativa', r.prediccion_crisis ? '!' : 'V', r.prediccion_crisis ? colorDanger : colorSuccess);
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
            doc.line(marginX, y, marginX + 50, y);
            y += 6;

            doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
            doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
            doc.roundedRect(marginX, y, pageWidth - marginX * 2, 18, 4, 4, 'FD');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
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
            doc.line(marginX, y, marginX + 50, y);
            y += 6;

            const detalles = [
                ['Fuente de valores', r.valores_usados || 'No disponible'],
                ['PDF Cedula', r.cedula_pdf_valida ? 'Valida' : 'Invalida'],
                ['PDF Diagnostico', r.diagnostico_pdf_valido ? 'Valido' : 'Invalido']
            ];

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
                doc.text(String(value), x + 40, yPos);
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

            doc.setFillColor(colorSuccess[0], colorSuccess[1], colorSuccess[2]);
            const selloX = pageWidth - marginX - 6;
            const selloY = y + 5;
            doc.circle(selloX, selloY, 4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text('OK', selloX, selloY, { align: 'center', baseline: 'middle' });

            doc.text('Firma del Medico Responsable', pageWidth - marginX - 55, y + 5);
            doc.setDrawColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.setLineWidth(0.3);
            doc.line(pageWidth - marginX - 50, y + 7, pageWidth - marginX - 10, y + 7);

            doc.save(`Analisis_HTAS_Folio_${r.folio_expediente_db ?? 'sin_folio'}.pdf`);
            this.showSuccess('PDF descargado', 'Los resultados se han descargado correctamente.');

        } catch (error) {
            console.error('[AnalisisDetalle] Error generando PDF:', error);
            this.showError('Error', 'No se pudo generar el PDF de resultados.');
        }
    }

    // ============================================================
    // UTILIDADES
    // ============================================================
    calcularEdad(fechaNacimiento: string): number | null {
        const nacimiento = new Date(fechaNacimiento);
        if (isNaN(nacimiento.getTime())) return null;
        const hoy = new Date();
        let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
        const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
        if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) {
            edad--;
        }
        return edad >= 0 ? edad : null;
    }

    formatearFecha(fecha: string | undefined | null): string {
        if (!fecha) return 'Sin fecha';
        try {
            const fechaObj = new Date(fecha);
            if (!isNaN(fechaObj.getTime())) {
                const dia = String(fechaObj.getDate()).padStart(2, '0');
                const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
                const anio = fechaObj.getFullYear();
                return `${dia}/${mes}/${anio}`;
            }
            return String(fecha);
        } catch {
            return String(fecha);
        }
    }

    formatearHora(fecha: string | undefined | null): string {
        if (!fecha) return '';
        try {
            const fechaObj = new Date(fecha);
            if (!isNaN(fechaObj.getTime())) {
                const horas = String(fechaObj.getHours()).padStart(2, '0');
                const minutos = String(fechaObj.getMinutes()).padStart(2, '0');
                return `${horas}:${minutos}`;
            }
            return '';
        } catch {
            return '';
        }
    }

    formatearFechaCompleta(fecha: string | undefined | null): string {
        if (!fecha) return 'Sin fecha';
        try {
            const fechaObj = new Date(fecha);
            if (!isNaN(fechaObj.getTime())) {
                const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const dia = fechaObj.getDate();
                const mes = meses[fechaObj.getMonth()];
                const anio = fechaObj.getFullYear();
                const horas = String(fechaObj.getHours()).padStart(2, '0');
                const minutos = String(fechaObj.getMinutes()).padStart(2, '0');
                return `${dia} de ${mes} ${anio} ${horas}:${minutos}`;
            }
            return String(fecha);
        } catch {
            return String(fecha);
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