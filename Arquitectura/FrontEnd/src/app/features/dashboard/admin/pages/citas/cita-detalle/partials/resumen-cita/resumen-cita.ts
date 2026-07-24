import { Component, Input, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';

@Component({
    selector: 'app-resumen-cita',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './resumen-cita.html',
    styleUrls: ['./resumen-cita.css']
})
export class ResumenCita {
    @Input() citaSeleccionada: any = null;
    @Input() citaId: number | null = null;
    @Input() historialCambios: any[] = [];
    @Input() fechaGeneracion: string = '';

    private platformId = inject(PLATFORM_ID);

    estadosConColor = [
        { value: 'Programada', color: '#FFA726' },
        { value: 'Confirmada', color: '#66BB6A' },
        { value: 'Completada', color: '#42A5F5' },
        { value: 'Cancelada', color: '#EF5350' },
        { value: 'No Asistió', color: '#AB47BC' }
    ];

    getEstadoColor(estado: string): string {
        const found = this.estadosConColor.find(e => e.value === estado);
        return found ? found.color : '#78909C';
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'No registrada';
        try {
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return fecha;
            const dia = String(d.getUTCDate()).padStart(2, '0');
            const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
            const anio = d.getUTCFullYear();
            return `${dia}/${mes}/${anio}`;
        } catch {
            return fecha;
        }
    }

    formatearFechaYHora(fecha: string, hora: string): string {
        if (!fecha) return 'Fecha no disponible';
        try {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) return fecha;
            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anio = fechaObj.getFullYear();
            const fechaFormateada = `${dia}/${mes}/${anio}`;
            let horaFormateada = hora || '--:--';
            if (horaFormateada.length > 5) {
                horaFormateada = horaFormateada.substring(0, 5);
            }
            return `${fechaFormateada} ${horaFormateada}`;
        } catch {
            return fecha;
        }
    }

    getNombreCompletoPaciente(): string {
        const c = this.citaSeleccionada;
        if (!c) return 'Paciente no especificado';
        return [
            c.nombrepaciente || '',
            c.appaternopaciente || '',
            c.apmaternopaciente || ''
        ].filter(Boolean).join(' ').trim() || 'Paciente no especificado';
    }

    descargarResumenPDF() {
        if (!isPlatformBrowser(this.platformId) || !this.citaSeleccionada) return;

        const c = this.citaSeleccionada;
        const nombrePaciente = this.getNombreCompletoPaciente();
        const colorPrimary: [number, number, number] = [176, 0, 30];
        const colorDark: [number, number, number] = [10, 22, 40];
        const colorGray: [number, number, number] = [122, 138, 158];
        const colorTextMuted: [number, number, number] = [74, 90, 110];
        const colorLight: [number, number, number] = [248, 249, 250];
        const colorBorder: [number, number, number] = [230, 233, 237];
        const colorWhite: [number, number, number] = [255, 255, 255];

        const doc = new jsPDF({ unit: 'mm', format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 20;
        const marginY = 20;
        let y = marginY;

        // BANDA SUPERIOR ROJA
        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.rect(0, 0, pageWidth, 4, 'F');

        // TÍTULO Y FOLIO
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text('Resumen de Cita Médica', marginX, y + 10);

        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, y + 14, marginX + 80, y + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text(`Folio #${this.citaId || '---'}`, pageWidth - marginX, y + 10, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Generado: ${this.fechaGeneracion}`, pageWidth - marginX, y + 16, { align: 'right' });

        y += 28;

        // LÍNEA SEPARADORA
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 8;

        // ENCABEZADO
        doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 20, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(80, 80, 95);
        doc.text('CITA MÉDICA', marginX + 10, y + 8);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text(nombrePaciente, marginX + 10, y + 17);

        // Badge de estado
        const estado = c.estado || 'Sin estado';
        const estadoColor = this.getEstadoColor(estado);
        const badgeWidth = 32;
        const badgeHeight = 7;
        const badgeX = pageWidth - marginX - badgeWidth - 6;
        const badgeY = y + 6.5;

        doc.setFillColor(
            parseInt(estadoColor.slice(1, 3), 16),
            parseInt(estadoColor.slice(3, 5), 16),
            parseInt(estadoColor.slice(5, 7), 16)
        );
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        const badgeText = estado.toUpperCase();
        const badgeTextWidth = doc.getStringUnitWidth(badgeText) * 5.5 / doc.internal.scaleFactor;
        const badgeTextX = badgeX + (badgeWidth / 2) - (badgeTextWidth / 2);
        doc.text(badgeText, badgeTextX, badgeY + 4.5);

        y += 28;

        // SECCIÓN: DATOS DEL PACIENTE
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Datos del Paciente', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 55, y);
        y += 6;

        const datosPaciente = [
            ['Nombre Completo', this.getNombreCompletoPaciente()],
            ['Correo', c.correopaciente || 'No registrado'],
            ['Teléfono', c.telefonopaciente || 'No registrado']
        ];

        doc.setFontSize(9.5);
        datosPaciente.forEach(([label, value], index) => {
            const x = marginX + (index % 2) * ((pageWidth - marginX * 2) / 2);
            const yPos = y + Math.floor(index / 2) * 7.5;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(label + ':', x, yPos);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
            doc.text(String(value), x + 45, yPos);
        });
        y += datosPaciente.length > 2 ? 20 : 14;

        // SECCIÓN: DETALLES DE LA CITA
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Detalles de la Cita', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 48, y);
        y += 6;

        const detallesCita = [
            ['Fecha', this.formatearFecha(c.fechacita)],
            ['Hora', c.horacita || 'No registrada'],
            ['Modalidad', c.modalidad || 'No especificada'],
            ['Estado', c.estado || 'Sin estado'],
            ['Motivo', c.motivo || 'No especificado']
        ];

        doc.setFontSize(9.5);
        detallesCita.forEach(([label, value], index) => {
            const x = marginX + (index % 2) * ((pageWidth - marginX * 2) / 2);
            const yPos = y + Math.floor(index / 2) * 7.5;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(label + ':', x, yPos);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
            const textValue = String(value);
            if (label === 'Motivo' && textValue.length > 30) {
                const lines = doc.splitTextToSize(textValue, (pageWidth - marginX * 2) / 2 - 45);
                doc.text(lines, x + 45, yPos);
            } else {
                doc.text(textValue, x + 45, yPos);
            }
        });
        y += detallesCita.length > 4 ? 30 : 20;

        // SECCIÓN: SÍNTOMAS Y NOTAS
        if (c.sintomas || c.notasdoctor) {
            if (y > pageHeight - 60) {
                doc.addPage();
                y = marginY;
                doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.rect(0, 0, pageWidth, 4, 'F');
            }

            if (c.sintomas) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.text('Síntomas del Paciente', marginX, y);
                y += 4;
                doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.setLineWidth(0.5);
                doc.line(marginX, y, marginX + 55, y);
                y += 6;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
                const sintomasLines = doc.splitTextToSize(c.sintomas, pageWidth - marginX * 2 - 8);
                doc.text(sintomasLines, marginX + 4, y);
                y += sintomasLines.length * 5 + 8;
            }

            if (c.notasdoctor) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.text('Notas del Doctor', marginX, y);
                y += 4;
                doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.setLineWidth(0.5);
                doc.line(marginX, y, marginX + 48, y);
                y += 6;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
                const notasLines = doc.splitTextToSize(c.notasdoctor, pageWidth - marginX * 2 - 8);
                doc.text(notasLines, marginX + 4, y);
                y += notasLines.length * 5 + 8;
            }
        }

        // SECCIÓN: HISTORIAL DE CAMBIOS
        if (this.historialCambios && this.historialCambios.length > 0) {
            if (y > pageHeight - 60) {
                doc.addPage();
                y = marginY;
                doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.rect(0, 0, pageWidth, 4, 'F');
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.text('Historial de Cambios', marginX, y);
            y += 4;
            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.5);
            doc.line(marginX, y, marginX + 50, y);
            y += 8;

            const tableCols = [50, 60, 40];
            const tableWidth = tableCols.reduce((a, b) => a + b, 0);
            const startX = (pageWidth - tableWidth) / 2;

            doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.roundedRect(startX, y - 2, tableWidth, 8, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text('Fecha', startX + 4, y + 3);
            doc.text('Acción', startX + 4 + tableCols[0], y + 3);
            doc.text('Usuario', startX + tableCols[0] + tableCols[1] + 4, y + 3);
            y += 10;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);

            const historialMostrar = this.historialCambios.slice(0, 10);
            historialMostrar.forEach((h, index) => {
                if (index % 2 === 0) {
                    doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
                    doc.rect(startX, y - 2, tableWidth, 7, 'F');
                }

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(h.fecha || '', startX + 4, y + 3.5);
                const accionText = (h.accion || '').length > 25 ? (h.accion || '').slice(0, 23) + '...' : (h.accion || '');
                doc.text(accionText, startX + 4 + tableCols[0], y + 3.5);
                doc.text(h.usuario || 'Sistema', startX + tableCols[0] + tableCols[1] + 4, y + 3.5);

                y += 8;
                if (y > pageHeight - 30) {
                    doc.addPage();
                    y = marginY;
                    doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                    doc.rect(0, 0, pageWidth, 4, 'F');
                }
            });

            if (this.historialCambios.length > 10) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(6.5);
                doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                doc.text('... y ' + (this.historialCambios.length - 10) + ' cambios más', startX + 4, y + 3.5);
                y += 8;
            }
            y += 4;
        }

        // PIE DE PÁGINA
        y = Math.max(y, pageHeight - 30);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);

        const footerY = y + 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('Documento generado electrónicamente', marginX, footerY, { baseline: 'middle' });

        const selloX = marginX + 64;
        doc.setFillColor(16, 185, 129);
        doc.circle(selloX, footerY, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        doc.text('OK', selloX, footerY, { align: 'center', baseline: 'middle' });

        const firmaLineWidth = 48;
        const firmaLineX1 = pageWidth - marginX - firmaLineWidth;
        const firmaLineX2 = pageWidth - marginX;
        const firmaLineY = footerY - 3;

        doc.setDrawColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.setLineWidth(0.3);
        doc.line(firmaLineX1, firmaLineY, firmaLineX2, firmaLineY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('Firma del Responsable', firmaLineX1 + (firmaLineWidth / 2), firmaLineY + 4, { align: 'center' });

        // GUARDAR PDF
        doc.save(`Resumen_Cita_${nombrePaciente.replace(/\s+/g, '_')}_${this.citaId || 'sin_folio'}.pdf`);
    }
}