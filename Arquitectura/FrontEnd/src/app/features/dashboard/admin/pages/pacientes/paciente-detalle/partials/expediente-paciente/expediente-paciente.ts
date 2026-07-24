import { Component, Input, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser, DatePipe } from '@angular/common';
import jsPDF from 'jspdf';

@Component({
    selector: 'app-expediente-paciente',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './expediente-paciente.html',
    styleUrls: ['./expediente-paciente.css']
})
export class ExpedientePacienteComponent {
    @Input() usuarioSeleccionado: any = null;
    @Input() estadisticas: any = null;
    @Input() citasPaciente: any[] = [];
    @Input() pacienteId: number | null = null;
    @Input() ultimaMedicion: any = null;

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

    private formatearFechaSegura(fecha: any): string {
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

        if (fecha instanceof Date && !isNaN(fecha.getTime())) {
            const dia = String(fecha.getDate()).padStart(2, '0');
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const anio = fecha.getFullYear();
            return `${dia}/${mes}/${anio}`;
        }

        return String(fecha) || 'No disponible';
    }

    private extraerSoloFecha(fechaStr: string): string {
        if (!fechaStr) return 'Fecha no disponible';

        if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaStr)) {
            return fechaStr;
        }

        try {
            const date = new Date(fechaStr);
            if (!isNaN(date.getTime())) {
                const dia = String(date.getDate()).padStart(2, '0');
                const mes = String(date.getMonth() + 1).padStart(2, '0');
                const anio = date.getFullYear();
                return `${dia}/${mes}/${anio}`;
            }
        } catch (e) { }

        const match = fechaStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
            return `${match[1]}/${match[2]}/${match[3]}`;
        }

        return 'Fecha no disponible';
    }

    formatearFechaNacimiento(fecha: string): string {
        if (!fecha) return 'No registrada';
        return this.formatearFechaSegura(fecha);
    }

    formatearFechaYHora(fecha: string, hora: string): string {
        if (!fecha) return 'Fecha no disponible';

        try {
            const fechaObj = new Date(fecha);

            if (isNaN(fechaObj.getTime())) {
                return fecha;
            }

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

    calcularIMC(): { valor: number | null; categoria: string } {
        const peso = this.usuarioSeleccionado?.peso;
        const altura = this.usuarioSeleccionado?.altura;

        if (!peso || !altura || altura <= 0) {
            return { valor: null, categoria: '' };
        }

        const imc = peso / (altura * altura);
        const valor = Math.round(imc * 10) / 10;

        let categoria = 'Peso normal';
        if (imc < 18.5) categoria = 'Bajo peso';
        else if (imc >= 25 && imc < 30) categoria = 'Sobrepeso';
        else if (imc >= 30) categoria = 'Obesidad';

        return { valor, categoria };
    }

    descargarExpedientePDF() {
        if (!isPlatformBrowser(this.platformId) || !this.usuarioSeleccionado) return;

        const u = this.usuarioSeleccionado;
        const nombreCompleto = [
            u.nombre || '',
            u.tempApellidoPaterno || u.apPaterno || '',
            u.tempApellidoMaterno || u.apMaterno || ''
        ].filter(Boolean).join(' ').trim() || 'Paciente no especificado';

        const colorPrimary: [number, number, number] = [176, 0, 30];
        const colorDark: [number, number, number] = [10, 22, 40];
        const colorGray: [number, number, number] = [122, 138, 158];
        const colorTextMuted: [number, number, number] = [74, 90, 110];
        const colorLight: [number, number, number] = [248, 249, 250];
        const colorBorder: [number, number, number] = [230, 233, 237];
        const colorWhite: [number, number, number] = [255, 255, 255];

        const doc = new jsPDF({ unit: 'mm', format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;
        const marginX = 20;

        // Línea superior simple (sin degradado)
        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.rect(0, 0, pageWidth, 3, 'F');

        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text('Expediente Clinico', marginX, y + 8);

        // Línea simple debajo del título
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.6);
        doc.line(marginX, y + 12, marginX + 50, y + 12);

        // Folio y fecha
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text(`Folio #${this.pacienteId || '---'}`, pageWidth - marginX, y + 8, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Generado: ${this.fechaGeneracion}`, pageWidth - marginX, y + 14, { align: 'right' });

        y += 26;

        // Línea separadora
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 6;

        // Información del paciente - fondo simple
        doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(marginX, y, pageWidth - marginX * 2, 18, 2, 2, 'FD');

        // Círculo con inicial (sin sombra)
        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        const circleX = marginX + 9;
        const circleY = y + 9;
        doc.circle(circleX, circleY, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
        const primeraLetra = nombreCompleto.charAt(0).toUpperCase() || 'P';
        doc.text(primeraLetra, circleX, circleY, { align: 'center', baseline: 'middle' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text(nombreCompleto, marginX + 22, y + 7);

        if (u.correo) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text(u.correo, marginX + 22, y + 15);
        }

        y += 24;

        // SECCIONES - todas sin efectos especiales
        const secciones = [
            {
                titulo: 'Datos Generales', datos: [
                    ['Genero', u.genero || 'No especificado'],
                    ['Fecha de Nacimiento', this.formatearFechaSegura(u.fechaNacimiento)],
                    ['Edad', this.calcularEdad() !== null ? this.calcularEdad() + ' años' : 'No disponible'],
                    ['Telefono', u.telefono || 'No registrado'],
                    ['CURP', u.curp || 'No registrado'],
                    ['NSS', u.nss || 'No registrado']
                ]
            },
            {
                titulo: 'Datos Medicos', datos: [
                    ['Tipo de Sangre', u.tipoSangre || 'No especificado'],
                    ['Peso', u.peso ? u.peso + ' kg' : 'No registrado'],
                    ['Altura', u.altura ? u.altura + ' m' : 'No registrada'],
                    ['IMC', this.calcularIMC().valor !== null ? this.calcularIMC().valor + ' (' + this.calcularIMC().categoria + ')' : 'No disponible']
                ]
            }
        ];

        const colWidth = (pageWidth - marginX * 2) / 2;

        secciones.forEach(seccion => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.text(seccion.titulo, marginX, y);
            y += 3;
            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.4);
            doc.line(marginX, y, marginX + 35, y);
            y += 6;

            doc.setFontSize(9);
            seccion.datos.forEach(([label, value], index) => {
                const col = index % 2;
                const row = Math.floor(index / 2);
                const x = marginX + col * colWidth;
                const yPos = y + row * 7;

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                doc.text(label + ':', x, yPos);

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(String(value), x + 35, yPos);
            });
            y += seccion.datos.length > 2 ? 22 : 14;
        });

        // Antecedentes Familiares
        if (u.antecedentesFamiliares) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text('Antecedentes Familiares:', marginX, y);
            y += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
            const antecedentes = doc.splitTextToSize(u.antecedentesFamiliares, pageWidth - marginX * 2 - 6);
            doc.text(antecedentes, marginX + 3, y);
            y += antecedentes.length * 4.5 + 4;
        }

        // Última Medición
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Ultima Medicion', marginX, y);
        y += 3;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.4);
        doc.line(marginX, y, marginX + 35, y);
        y += 6;

        if (this.ultimaMedicion) {
            const m = this.ultimaMedicion;
            const fechaMedicion = this.extraerSoloFecha(m.fechahoralectura);

            doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
            doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
            doc.roundedRect(marginX, y, pageWidth - marginX * 2, 18, 2, 2, 'FD');

            const medItems = [
                ['Sistolica', m.sistolica + ' mmHg'],
                ['Diastolica', m.diastolica + ' mmHg'],
                ['Pulso', m.pulso + ' bpm']
            ];

            const medColWidth = (pageWidth - marginX * 2) / 3;
            medItems.forEach(([label, value], index) => {
                const x = marginX + index * medColWidth;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                doc.text(label.toUpperCase(), x + 3, y + 4);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(value, x + 3, y + 13);
            });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text('Fecha: ' + fechaMedicion, pageWidth - marginX - 3, y + 15, { align: 'right' });

            y += 24;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            doc.text('No hay mediciones registradas para este paciente.', marginX + 3, y + 5);
            y += 12;
        }

        // Domicilio
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text('Domicilio', marginX, y);
        y += 3;
        doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.setLineWidth(0.4);
        doc.line(marginX, y, marginX + 24, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
        const direccion = this.getUbicacionFormateada() || 'Sin ubicacion registrada';
        const direccionLineas = doc.splitTextToSize(direccion, pageWidth - marginX * 2 - 6);
        doc.text(direccionLineas, marginX + 3, y);
        y += direccionLineas.length * 4.5 + 8;

        // Citas - tabla simple sin efectos
        if (this.citasPaciente.length > 0) {
            if (y > 230) {
                doc.addPage();
                y = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.text('Resumen de Consultas', marginX, y);
            y += 3;
            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.4);
            doc.line(marginX, y, marginX + 43, y);
            y += 8;

            const tableCols = [50, 65, 40];
            const tableWidth = tableCols.reduce((a, b) => a + b, 0);
            const startX = (pageWidth - tableWidth) / 2;

            // Encabezado de tabla
            doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.roundedRect(startX, y - 1, tableWidth, 7, 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
            doc.text('Fecha', startX + 5, y + 3);
            doc.text('Motivo', startX + 5 + tableCols[0], y + 3);
            doc.text('Estado', startX + tableCols[0] + tableCols[1] + (tableCols[2] / 2), y + 3, { align: 'center' });
            y += 9;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);

            const citasMostrar = this.citasPaciente.slice(0, 6);
            citasMostrar.forEach((c, index) => {
                const fecha = this.formatearFechaYHora(c.fechacita, c.horacita);
                const motivo = (c.motivo || 'Sin motivo').length > 20 ? (c.motivo || 'Sin motivo').slice(0, 18) + '...' : (c.motivo || 'Sin motivo');
                const estado = c.estado || 'Programada';

                if (index % 2 === 0) {
                    doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
                    doc.rect(startX, y - 1, tableWidth, 6, 'F');
                }

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                doc.text(fecha, startX + 5, y + 3);
                doc.text(motivo, startX + 5 + tableCols[0], y + 3);

                let estadoColor: [number, number, number] = [100, 100, 100];
                if (estado === 'Completada') estadoColor = [16, 185, 129];
                else if (estado === 'Cancelada' || estado === 'No Asistio') estadoColor = [239, 68, 68];
                else if (estado === 'Programada' || estado === 'Confirmada') estadoColor = [59, 130, 246];

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2]);
                const estadoColX = startX + tableCols[0] + tableCols[1];
                const estadoColCenterX = estadoColX + (tableCols[2] / 2);
                doc.text(estado, estadoColCenterX, y + 1.5, { align: 'center', baseline: 'middle' });

                y += 7;
                if (y > 250) {
                    doc.addPage();
                    y = 20;
                }
            });

            if (this.citasPaciente.length > 6) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7);
                doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                doc.text('... y ' + (this.citasPaciente.length - 6) + ' citas mas', startX + 5, y + 3);
                y += 8;
            }
            y += 4;
        }

        // Footer simple
        y = Math.max(y, 250);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.setLineWidth(0.3);
        doc.line(marginX, y, pageWidth - marginX, y);

        const footerY = y + 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('Documento generado electronicamente', marginX, footerY, { baseline: 'middle' });

        // Firma simple
        const firmaLineWidth = 48;
        const firmaLineX1 = pageWidth - marginX - firmaLineWidth;
        const firmaLineX2 = pageWidth - marginX;
        const firmaLineY = footerY - 2;

        doc.setDrawColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.setLineWidth(0.3);
        doc.line(firmaLineX1, firmaLineY, firmaLineX2, firmaLineY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('Firma del Medico Responsable', firmaLineX1 + (firmaLineWidth / 2), firmaLineY + 4, { align: 'center' });

        doc.save(`Expediente_${nombreCompleto.replace(/\s+/g, '_')}_${this.pacienteId || 'sin_folio'}.pdf`);
    }
}