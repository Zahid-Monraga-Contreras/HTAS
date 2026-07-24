import { Component, Input, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';

@Component({
    selector: 'app-expediente-acompanante',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './expediente-acompanante.html',
    styleUrls: ['./expediente-acompanante.css']
})
export class ExpedienteAcompanante {
    @Input() usuarioSeleccionado: any = null;
    @Input() acompananteId: number | null = null;
    @Input() visitasAcompanante: any[] = [];
    @Input() fechaGeneracion: string = '';

    private platformId = inject(PLATFORM_ID);

    formatearFechaYHora(fecha: string, hora: string): string {
        if (!fecha) return 'Fecha no disponible';

        try {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) return fecha;

            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const anio = fechaObj.getFullYear();
            const fechaFormateada = `${dia}/${mes}/${anio}`;

            let horaFormateada = '--:--';
            if (hora) {
                let horaLimpia = hora;
                if (horaLimpia.includes('T')) {
                    horaLimpia = horaLimpia.split('T')[1] || '00:00';
                }
                if (horaLimpia.length > 5) {
                    horaLimpia = horaLimpia.substring(0, 5);
                }
                if (horaLimpia.includes(':')) {
                    const partes = horaLimpia.split(':');
                    if (partes.length >= 2) {
                        horaFormateada = `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
                    }
                } else {
                    horaFormateada = horaLimpia;
                }
            }

            return `${fechaFormateada} ${horaFormateada}`;
        } catch (error) {
            return fecha;
        }
    }

    formatearFechaNacimiento(fecha: string): string {
        if (!fecha) return 'No registrada';

        try {
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return fecha;

            const dia = String(d.getUTCDate()).padStart(2, '0');
            const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
            const anio = d.getUTCFullYear();

            return `${dia}/${mes}/${anio}`;
        } catch (error) {
            return fecha;
        }
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
        return partes.length ? partes.join(', ') : 'Sin ubicación registrada';
    }

    descargarExpedientePDF() {
        if (!isPlatformBrowser(this.platformId) || !this.usuarioSeleccionado) return;

        const u = this.usuarioSeleccionado;
        const nombreCompleto = [
            u.nombre || '',
            u.apPaterno || '',
            u.apMaterno || ''
        ].filter(Boolean).join(' ').trim() || 'Acompañante no especificado';

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
        doc.text('Expediente de Acompañante', marginX, y + 10);

        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, y + 14, marginX + 75, y + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text(`Folio #${this.acompananteId || '---'}`, pageWidth - marginX, y + 10, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Generado: ${this.fechaGeneracion}`, pageWidth - marginX, y + 16, { align: 'right' });

        y += 28;

        // LÍNEA SEPARADORA
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 8;

        // ENCABEZADO DEL ACOMPAÑANTE
        doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 20, 3, 3, 'FD');

        // Círculo gris con inicial
        doc.setFillColor(200, 200, 210);
        const circleX = marginX + 11;
        const circleY = y + 10;
        const circleRadius = 7;
        doc.circle(circleX, circleY, circleRadius, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(80, 80, 95);
        const primeraLetra = nombreCompleto.charAt(0).toUpperCase() || 'A';
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

        // Badge de estado
        if (u.activo !== false) {
            const badgeWidth = 30;
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

        // SECCIÓN: DATOS GENERALES
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Datos Generales', marginX, y);
        y += 4;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + 42, y);
        y += 6;

        const fechaNacimientoFormateada = this.formatearFechaNacimiento(u.fechaNacimiento);
        const fechaAsignacionFormateada = this.formatearFechaNacimiento(u.fechaAsignacion);

        const datosGenerales = [
            ['Género', u.genero || 'No especificado'],
            ['Fecha de Nacimiento', fechaNacimientoFormateada],
            ['Edad', this.calcularEdad() !== null ? this.calcularEdad() + ' años' : 'No disponible'],
            ['Teléfono', u.telefono || 'No registrado'],
            ['CURP', u.curp || 'No registrado'],
            ['Fecha de Asignación', fechaAsignacionFormateada]
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
            doc.text(String(value), x + 40, yPos);
        });
        y += datosGenerales.length > 2 ? 24 : 16;

        // SECCIÓN: DOMICILIO
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
        const direccion = this.getUbicacionFormateada() || 'Sin ubicación registrada';
        const direccionLineas = doc.splitTextToSize(direccion, pageWidth - marginX * 2 - 8);
        doc.text(direccionLineas, marginX + 4, y);
        y += direccionLineas.length * 5 + 12;

        // SECCIÓN: RESUMEN DE VISITAS
        if (this.visitasAcompanante.length > 0) {
            if (y > pageHeight - 60) {
                doc.addPage();
                y = marginY;
                doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                doc.rect(0, 0, pageWidth, 4, 'F');
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.text('Resumen de Visitas', marginX, y);
            y += 4;
            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.5);
            doc.line(marginX, y, marginX + 47, y);
            y += 8;

            const tableCols = [50, 65, 40];
            const tableWidth = tableCols.reduce((a, b) => a + b, 0);
            const startX = (pageWidth - tableWidth) / 2;

            doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.roundedRect(startX, y - 2, tableWidth, 8, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text('Fecha', startX + 6, y + 3);
            doc.text('Motivo', startX + 6 + tableCols[0], y + 3);
            doc.text('Estado', startX + tableCols[0] + tableCols[1] + (tableCols[2] / 2), y + 3, { align: 'center' });
            y += 10;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);

            const visitasMostrar = this.visitasAcompanante.slice(0, 8);
            visitasMostrar.forEach((v, index) => {
                const fecha = this.formatearFechaYHora(v.fechavisita, v.horavisita);
                const motivo = (v.motivo || 'Sin motivo').length > 20 ? (v.motivo || 'Sin motivo').slice(0, 18) + '...' : (v.motivo || 'Sin motivo');
                const estado = v.estado || 'Programada';

                if (index % 2 === 0) {
                    doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
                    doc.rect(startX, y - 2, tableWidth, 6.5, 'F');
                }

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(fecha, startX + 6, y + 3.5);
                doc.text(motivo, startX + 6 + tableCols[0], y + 3.5);

                let estadoColor: [number, number, number] = [100, 100, 100];
                let estadoBg: [number, number, number] = [240, 240, 245];
                if (estado === 'Completada') { estadoColor = [16, 185, 129]; estadoBg = [209, 250, 229]; }
                else if (estado === 'Cancelada' || estado === 'No Asistió') { estadoColor = [239, 68, 68]; estadoBg = [254, 226, 226]; }
                else if (estado === 'Programada' || estado === 'Confirmada') { estadoColor = [59, 130, 246]; estadoBg = [219, 234, 254]; }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                const estadoColX = startX + tableCols[0] + tableCols[1];
                const estadoColCenterX = estadoColX + (tableCols[2] / 2);
                const estadoTextWidth = doc.getStringUnitWidth(estado) * 7 / doc.internal.scaleFactor;
                const pillWidth = Math.min(estadoTextWidth + 6, tableCols[2] - 4);
                const pillX = estadoColCenterX - (pillWidth / 2);

                doc.setFillColor(estadoBg[0], estadoBg[1], estadoBg[2]);
                doc.roundedRect(pillX, y - 1.5, pillWidth, 5.5, 3, 3, 'F');
                doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2]);
                doc.text(estado, estadoColCenterX, y + 1.3, { align: 'center', baseline: 'middle' });

                y += 7.5;
                if (y > pageHeight - 25) {
                    doc.addPage();
                    y = marginY;
                    doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
                    doc.rect(0, 0, pageWidth, 4, 'F');
                }
            });

            if (this.visitasAcompanante.length > 8) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7.5);
                doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                doc.text('... y ' + (this.visitasAcompanante.length - 8) + ' visitas más', startX + 6, y + 3.5);
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
        doc.save(`Expediente_Acompanante_${nombreCompleto.replace(/\s+/g, '_')}_${this.acompananteId || 'sin_folio'}.pdf`);
    }
}