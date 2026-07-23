import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlgorithmService, AnalisisResponse } from '../../../../../../../../core/services/algorithm.service';
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

@Component({
    selector: 'app-analisis-paciente',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './analisis-paciente.html',
    styleUrls: ['./analisis-paciente.css']
})
export class AnalisisPacienteComponent implements OnInit, OnDestroy {
    @Input() usuarioSeleccionado: any = null;
    @Input() pacienteId: number | null = null;
    @Output() lanzarNotificacion = new EventEmitter<{ mensaje: string; tipo: 'success' | 'error' | 'warning' }>();

    private algorithmService = inject(AlgorithmService);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    sistemaActivo = false;
    isAnalizando = false;
    analisisArchivo: File | null = null;
    analisisArchivoNombre: string = '';
    resultadoAnalisis: any = null;
    historialAnalisis: AnalisisHistorial[] = [];

    ngOnInit() {
        this.verificarEstadoSistema();
    }

    ngOnDestroy() {
        // Cleanup if needed
    }

    verificarEstadoSistema() {
        this.algorithmService.verificarEstado().subscribe({
            next: (response) => {
                this.sistemaActivo = true;
                console.log('[HTAS] Sistema activo:', response);
            },
            error: (error) => {
                this.sistemaActivo = false;
                console.warn('[HTAS] Sistema no disponible:', error);
                this.emitirNotificacion('El sistema de analisis no esta disponible. Asegurate de que el backend este corriendo.', 'warning');
            }
        });
    }

    private emitirNotificacion(mensaje: string, tipo: 'success' | 'error' | 'warning') {
        this.lanzarNotificacion.emit({ mensaje, tipo });
    }

    calcularEdad(): number | null {
        const fechaNacimiento = this.usuarioSeleccionado?.fechaNacimiento;
        if (!fechaNacimiento) return null;

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

    onAnalisisFileSelected(event: any) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            if (file.size > 10 * 1024 * 1024) {
                this.emitirNotificacion('El archivo es demasiado grande. Maximo 10MB.', 'error');
                return;
            }
            this.analisisArchivo = file;
            this.analisisArchivoNombre = file.name;
            this.emitirNotificacion('PDF cargado correctamente.', 'success');
        } else {
            this.emitirNotificacion('Solo se permiten archivos PDF.', 'error');
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
                    this.emitirNotificacion('El archivo es demasiado grande. Maximo 10MB.', 'error');
                    return;
                }
                this.analisisArchivo = file;
                this.analisisArchivoNombre = file.name;
                this.emitirNotificacion('PDF cargado correctamente.', 'success');
            } else {
                this.emitirNotificacion('Solo se permiten archivos PDF.', 'error');
            }
        }
    }

    ejecutarAnalisis() {
        if (!this.analisisArchivo) {
            this.emitirNotificacion('Por favor, seleccione un archivo PDF.', 'warning');
            return;
        }

        if (!this.sistemaActivo) {
            this.emitirNotificacion('El sistema de analisis no esta disponible. Contacte al administrador.', 'error');
            return;
        }

        this.isAnalizando = true;
        this.resultadoAnalisis = null;

        const request = {
            edad: this.calcularEdad() || 50,
            sistolica: 120,
            diastolica: 80,
            tomaMedicamento: 0,
            cedulaMedico: this.usuarioSeleccionado?.cedulaMedico || '1234567',
            pdf: this.analisisArchivo
        };

        this.algorithmService.analizarConPDF(request).subscribe({
            next: (response) => {
                this.isAnalizando = false;
                if (response.success && response.data) {
                    this.resultadoAnalisis = response.data;

                    const historialItem: AnalisisHistorial = {
                        folio_expediente_db: response.data.folio_expediente_db,
                        fecha_analisis: new Date().toISOString(),
                        nivel_riesgo_clinico: response.data.nivel_riesgo_clinico,
                        sistolica_usada: response.data.sistolica_usada || 0,
                        diastolica_usada: response.data.diastolica_usada || 0,
                        probabilidad_porcentual: response.data.probabilidad_porcentual,
                        prediccion_crisis: response.data.prediccion_crisis,
                        motor_inferencia_usado: response.data.motor_inferencia_usado
                    };
                    this.historialAnalisis.unshift(historialItem);

                    this.emitirNotificacion('Analisis completado exitosamente.', 'success');
                    this.cdr.detectChanges();
                }
            },
            error: (error) => {
                this.isAnalizando = false;
                console.error('[HTAS] Error en analisis:', error);
                this.emitirNotificacion(error.error?.error || 'Error al analizar el paciente.', 'error');
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

        const nombreCompleto = [
            this.usuarioSeleccionado?.nombre || '',
            this.usuarioSeleccionado?.tempApellidoPaterno || this.usuarioSeleccionado?.apPaterno || '',
            this.usuarioSeleccionado?.tempApellidoMaterno || this.usuarioSeleccionado?.apMaterno || ''
        ].filter(Boolean).join(' ').trim() || 'Paciente no especificado';

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

        if (this.usuarioSeleccionado?.correo) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(this.usuarioSeleccionado.correo, marginX + 24, y + 15);
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
    }
}