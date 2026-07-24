import { Component, Input, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import jsPDF from 'jspdf';

@Component({
    selector: 'app-expediente-medico',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './expediente-medico.html',
    styleUrls: ['./expediente-medico.css']
})
export class ExpedienteMedicoComponent {
    @Input() usuarioSeleccionado: any = null;
    @Input() estadisticas: any = null;
    @Input() pacientesAtendidos: any[] = [];
    @Input() medicoId: number | null = null;

    private platformId = inject(PLATFORM_ID);

    fechaGeneracion = new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    getUbicacionFormateada(): string {
        const u = this.usuarioSeleccionado;
        if (!u) return '';
        const partes = [
            u.domicilio,
            u.localidad,
            u.municipio,
            u.estado,
            u.codigoPostal ? `CP ${u.codigoPostal}` : ''
        ].filter(Boolean);
        return partes.length ? partes.join(', ') : 'Sin ubicacion registrada';
    }

    formatearFechaSegura(fecha: any): string {
        if (!fecha) return 'No disponible';

        if (typeof fecha === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(fecha)) {
            return fecha;
        }

        if (typeof fecha === 'string') {
            try {
                const date = new Date(fecha);
                if (!isNaN(date.getTime())) {
                    const dia = String(date.getDate()).padStart(2, '0');
                    const mes = String(date.getMonth() + 1).padStart(2, '0');
                    const anio = date.getFullYear();
                    return `${dia}/${mes}/${anio}`;
                }
            } catch (e) { }
        }

        return String(fecha) || 'No disponible';
    }

    formatearFechaNacimiento(fecha: string): string {
        if (!fecha) return 'No registrada';
        return this.formatearFechaSegura(fecha);
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

    descargarExpedientePDF() {
        if (!isPlatformBrowser(this.platformId) || !this.usuarioSeleccionado) return;

        const u = this.usuarioSeleccionado;
        const nombreCompleto = [
            u.tempNombre || u.nombre || '',
            u.tempApellidoPaterno || u.apPaterno || '',
            u.tempApellidoMaterno || u.apMaterno || ''
        ].filter(Boolean).join(' ').trim() || 'Medico no especificado';

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

        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.rect(0, 0, pageWidth, 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text('Expediente Medico', marginX, y + 10);

        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, y + 14, marginX + 50, y + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text(`Folio #${this.medicoId || '---'}`, pageWidth - marginX, y + 10, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Generado: ${this.fechaGeneracion}`, pageWidth - marginX, y + 16, { align: 'right' });

        y += 28;

        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 8;

        doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 20, 3, 3, 'FD');

        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        const circleX = marginX + 11;
        const circleY = y + 10;
        const circleRadius = 7;
        doc.circle(circleX, circleY, circleRadius, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        const primeraLetra = nombreCompleto.charAt(0).toUpperCase() || 'M';
        doc.text(primeraLetra, circleX, circleY, { align: 'center', baseline: 'middle' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text(nombreCompleto, marginX + 25, y + 9);

        if (u.correo) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(u.correo, marginX + 25, y + 17);
        }

        if (u.activo !== false) {
            const badgeWidth = 26;
            const badgeHeight = 7;
            const badgeX = pageWidth - marginX - badgeWidth - 6;
            const badgeY = y + 6.5;

            doc.setFillColor(16, 185, 129);
            doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            const badgeText = 'ACTIVO';
            const badgeTextWidth = doc.getStringUnitWidth(badgeText) * 6 / doc.internal.scaleFactor;
            const badgeTextX = badgeX + (badgeWidth / 2) - (badgeTextWidth / 2);
            const badgeTextY = badgeY + 4.5;
            doc.text(badgeText, badgeTextX, badgeTextY);
        }

        y += 28;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Datos Generales', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 42, y);
        y += 6;

        const fechaNacimientoFormateada = this.formatearFechaSegura(u.fechaNacimiento);

        const datosGenerales = [
            ['Especialidad', u.especialidad || 'No especificada'],
            ['Genero', u.genero || 'No especificado'],
            ['Fecha de Nacimiento', fechaNacimientoFormateada],
            ['Edad', this.calcularEdad() !== null ? this.calcularEdad() + ' años' : 'No disponible'],
            ['Telefono', u.telefono || 'No registrado'],
            ['CURP', u.curp || 'No registrado']
        ];

        const colWidth = (pageWidth - marginX * 2) / 2;
        doc.setFontSize(9.5);
        datosGenerales.forEach(([label, value], index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = marginX + col * colWidth;
            const yPos = y + row * 7.5;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(label + ':', x, yPos);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
            doc.text(String(value), x + 38, yPos);
        });
        y += 24;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Direccion Clinica', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 45, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
        const direccionClinicaLineas = doc.splitTextToSize(u.direccionClinica || 'No registrada', pageWidth - marginX * 2 - 8);
        doc.text(direccionClinicaLineas, marginX + 4, y);
        y += direccionClinicaLineas.length * 5 + 10;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Domicilio', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 26, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
        const direccion = this.getUbicacionFormateada() || 'Sin ubicacion registrada';
        const direccionLineas = doc.splitTextToSize(direccion, pageWidth - marginX * 2 - 8);
        doc.text(direccionLineas, marginX + 4, y);
        y += direccionLineas.length * 5 + 10;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Actividad del Medico', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 48, y);
        y += 6;

        if (this.estadisticas) {
            const e = this.estadisticas;

            doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
            doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
            doc.roundedRect(marginX, y, pageWidth - marginX * 2, 20, 4, 4, 'FD');

            const estItems = [
                ['Total Pacientes', String(e.totalPacientes)],
                ['Completadas', String(e.citasCompletadas)],
                ['Pendientes', String(e.citasPendientes)],
                ['Promedio /mes', String(e.promedioConsultas)]
            ];

            const estColWidth = (pageWidth - marginX * 2) / 4;
            estItems.forEach(([label, value], index) => {
                const x = marginX + index * estColWidth;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                doc.text(label.toUpperCase(), x + 4, y + 5);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(value, x + 4, y + 15);
            });

            y += 28;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9.5);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text('No hay estadisticas registradas para este medico.', marginX + 4, y + 6);
            y += 14;
        }

        if (this.pacientesAtendidos.length > 0) {
            if (y > pageHeight - 60) {
                doc.addPage();
                y = marginY;
                doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.rect(0, 0, pageWidth, 4, 'F');
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.text('Pacientes Atendidos Recientemente', marginX, y);
            y += 4;
            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.5);
            doc.line(marginX, y, marginX + 70, y);
            y += 8;

            const tableCols = [35, 70, 50];
            const tableWidth = tableCols.reduce((a, b) => a + b, 0);
            const startX = (pageWidth - tableWidth) / 2;

            doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.roundedRect(startX, y - 2, tableWidth, 8, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text('Fecha', startX + 6, y + 3);
            doc.text('Paciente', startX + 6 + tableCols[0], y + 3);
            doc.text('Motivo', startX + 6 + tableCols[0] + tableCols[1], y + 3);
            y += 10;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);

            this.pacientesAtendidos.forEach((p, index) => {
                const motivo = (p.motivo || 'Sin motivo').length > 22 ? (p.motivo || 'Sin motivo').slice(0, 20) + '...' : (p.motivo || 'Sin motivo');

                if (index % 2 === 0) {
                    doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
                    doc.rect(startX, y - 2, tableWidth, 6.5, 'F');
                }

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(String(p.fechaUltimaCita || ''), startX + 6, y + 3.5);
                doc.text(String(p.nombre || ''), startX + 6 + tableCols[0], y + 3.5);
                doc.text(motivo, startX + 6 + tableCols[0] + tableCols[1], y + 3.5);

                y += 7.5;
                if (y > pageHeight - 25) {
                    doc.addPage();
                    y = marginY;
                    doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                    doc.rect(0, 0, pageWidth, 4, 'F');
                }
            });

            y += 6;
        }

        y = Math.max(y, pageHeight - 30);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);

        const footerY = y + 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('Documento generado electronicamente', marginX, footerY, { baseline: 'middle' });

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
        doc.text('Firma del Medico', firmaLineX1 + (firmaLineWidth / 2), firmaLineY + 4, { align: 'center' });

        doc.save(`Expediente_${nombreCompleto.replace(/\s+/g, '_')}_${this.medicoId || 'sin_folio'}.pdf`);
    }
}