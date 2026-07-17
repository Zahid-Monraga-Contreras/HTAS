import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GoogleService } from '../../../../../core/services/google.service';
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

import { AlgorithmService, AnalisisResponse } from '../../../../../core/services/algorithm.service';

import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import jsPDF from 'jspdf';

interface HistorialPaciente {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

type TabPaciente = 'info' | 'historial' | 'expediente' | 'analisis';

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
  selector: 'app-paciente-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './paciente-detalle.html',
  styleUrls: ['./paciente-detalle.css']
})
export class PacienteDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private titleService = inject(Title);
  private algorithmService = inject(AlgorithmService);

  usuarioSeleccionado: any = null;
  isSaving = false;

  activeTab: TabPaciente = 'info';

  mostrarModalCita = false;
  isSavingCita = false;

  nuevaCita = {
    fechaCita: '',
    horaCita: '',
    motivo: '',
    sintomas: '',
    modalidad: 'Presencial'
  };

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  private fpFechaInstance: any = null;
  private fpHoraInstance: any = null;
  private fpNacimientoInstance: any = null;

  historialCambios: HistorialPaciente[] = [];
  citasPaciente: any[] = [];

  estadisticas: {
    totalCitas: number;
    citasCompletadas: number;
    citasPendientes: number;
    citasCanceladas: number;
    ultimaCita: string | null;
    proximaCita: string | null;
  } | null = null;

  citasCargadas = false;
  cargandoCitas = false;
  pacienteId: number | null = null;
  fechaGeneracion = '';

  ultimaMedicion: any = null;
  cargandoUltimaMedicion = false;

  sistemaActivo = false;
  isAnalizando = false;
  analisisArchivo: File | null = null;
  analisisArchivoNombre: string = '';
  resultadoAnalisis: any = null;
  historialAnalisis: AnalisisHistorial[] = [];

  ngOnInit() {
    let state: any = null;

    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    this.fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    if (state && state.usuario) {
      this.pacienteId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();

      this.cargarDatosCompletosPaciente();
      this.cargarDatosReales();
      this.cargarUltimaMedicionExpediente();

      setTimeout(() => {
        this.inicializarCalendarioNacimiento();
      }, 500);

      this.verificarEstadoSistema();

    } else {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/pacientes']);
      }
    }
  }

  ngOnDestroy() {
    this.destruirCalendariosCita();
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Formatea una fecha de manera segura - AHORA EL BACKEND YA LA DEVUELVE FORMATEADA
   */
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

  /**
   * Extrae solo la fecha de un string (fallback)
   */
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

  async cargarUltimaMedicionExpediente() {
    if (!this.pacienteId) return;

    this.cargandoUltimaMedicion = true;
    try {
      const medicion = await firstValueFrom(
        this.usersService.getUltimaMedicionPaciente(this.pacienteId)
      );
      if (medicion && Object.keys(medicion).length > 0) {
        const fechaFormateada = medicion.fechahoralectura || medicion.FechaHoraLectura || 'Fecha no disponible';

        this.ultimaMedicion = {
          sistolica: medicion.sistolica || medicion.Sistolica || 0,
          diastolica: medicion.diastolica || medicion.Diastolica || 0,
          pulso: medicion.pulso || medicion.Pulso || 0,
          fechahoralectura: this.extraerSoloFecha(String(fechaFormateada))
        };
      } else {
        this.ultimaMedicion = null;
      }
    } catch (error) {
      console.warn('No se pudo cargar la ultima medicion:', error);
      this.ultimaMedicion = null;
    } finally {
      this.cargandoUltimaMedicion = false;
      this.cdr.detectChanges();
    }
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 20;
    const marginY = 20;
    let y = marginY;

    doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.text('Expediente Clinico', marginX, y + 10);

    doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.setLineWidth(0.8);
    doc.line(marginX, y + 14, marginX + 55, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
    doc.text(`Folio #${this.pacienteId || '---'}`, pageWidth - marginX, y + 10, { align: 'right' });
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

    // CIRCULO ROJO CON INICIAL - CENTRADO CORRECTAMENTE
    doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    const circleX = marginX + 11;
    const circleY = y + 10;
    const circleRadius = 7;
    doc.circle(circleX, circleY, circleRadius, 'F');

    // INICIAL CENTRADA DENTRO DEL CIRCULO
    // DESPUES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colorWhite[0], colorWhite[1], colorWhite[2]);
    const primeraLetra = nombreCompleto.charAt(0).toUpperCase() || 'P';
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

    // BADGE ACTIVO - CENTRADO VERTICALMENTE
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
      ['Genero', u.genero || 'No especificado'],
      ['Fecha de Nacimiento', fechaNacimientoFormateada],
      ['Edad', this.calcularEdad() !== null ? this.calcularEdad() + ' anos' : 'No disponible'],
      ['Telefono', u.telefono || 'No registrado'],
      ['CURP', u.curp || 'No registrado'],
      ['NSS', u.nss || 'No registrado']
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
    y += datosGenerales.length > 2 ? 24 : 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.text('Datos Medicos', marginX, y);
    y += 4;
    doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, marginX + 37, y);
    y += 6;

    const datosMedicos = [
      ['Tipo de Sangre', u.tipoSangre || 'No especificado'],
      ['Peso', u.peso ? u.peso + ' kg' : 'No registrado'],
      ['Altura', u.altura ? u.altura + ' m' : 'No registrada'],
      ['IMC', this.calcularIMC().valor !== null ? this.calcularIMC().valor + ' (' + this.calcularIMC().categoria + ')' : 'No disponible']
    ];

    doc.setFontSize(9.5);
    datosMedicos.forEach(([label, value], index) => {
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
    y += 18;

    if (u.antecedentesFamiliares) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
      doc.text('Antecedentes Familiares:', marginX, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
      const antecedentes = doc.splitTextToSize(u.antecedentesFamiliares, pageWidth - marginX * 2 - 8);
      doc.text(antecedentes, marginX + 4, y);
      y += antecedentes.length * 5 + 6;
    } else {
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.text('Ultima Medicion', marginX, y);
    y += 4;
    doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, marginX + 39, y);
    y += 6;

    if (this.ultimaMedicion) {
      const m = this.ultimaMedicion;
      const fechaMedicion = this.extraerSoloFecha(m.fechahoralectura);

      doc.setFillColor(colorLight[0], colorLight[1], colorLight[2]);
      doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
      doc.roundedRect(marginX, y, pageWidth - marginX * 2, 20, 4, 4, 'FD');

      const medItems = [
        ['Sistolica', m.sistolica + ' mmHg'],
        ['Diastolica', m.diastolica + ' mmHg'],
        ['Pulso', m.pulso + ' bpm']
      ];

      const medColWidth = (pageWidth - marginX * 2) / 3;
      medItems.forEach(([label, value], index) => {
        const x = marginX + index * medColWidth;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text(label.toUpperCase(), x + 4, y + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.text(value, x + 4, y + 15);
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
      doc.text('Fecha: ' + fechaMedicion, pageWidth - marginX - 4, y + 17, { align: 'right' });

      y += 28;
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
      doc.text('No hay mediciones registradas para este paciente.', marginX + 4, y + 6);
      y += 14;
    }

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

    if (this.citasPaciente.length > 0) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = marginY;
        doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.rect(0, 0, pageWidth, 4, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
      doc.text('Resumen de Consultas', marginX, y);
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

      const citasMostrar = this.citasPaciente.slice(0, 6);
      citasMostrar.forEach((c, index) => {
        const fecha = this.formatearFechaYHora(c.fechacita, c.horacita);
        const motivo = (c.motivo || 'Sin motivo').length > 20 ? (c.motivo || 'Sin motivo').slice(0, 18) + '...' : (c.motivo || 'Sin motivo');
        const estado = c.estado || 'Programada';

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
        else if (estado === 'Cancelada' || estado === 'No Asistio') { estadoColor = [239, 68, 68]; estadoBg = [254, 226, 226]; }
        else if (estado === 'Programada' || estado === 'Confirmada') { estadoColor = [59, 130, 246]; estadoBg = [219, 234, 254]; }

        // Badge centrado dentro del ancho real de la columna "Estado"
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

      if (this.citasPaciente.length > 6) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
        doc.text('... y ' + (this.citasPaciente.length - 6) + ' citas mas', startX + 6, y + 3.5);
        y += 8;
      }
      y += 4;
    }

    // DESPUES
    y = Math.max(y, pageHeight - 30);
    doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageWidth - marginX, y);

    const footerY = y + 10;

    // Izquierda: sello "Documento generado electronicamente"
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

    // Derecha: bloque de firma (linea arriba, etiqueta abajo, sin tocar el sello)
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
    doc.text('Firma del Medico Responsable', firmaLineX1 + (firmaLineWidth / 2), firmaLineY + 4, { align: 'center' });

    doc.save(`Expediente_${nombreCompleto.replace(/\s+/g, '_')}_${this.pacienteId || 'sin_folio'}.pdf`);
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

    // Ajuste automatico del texto del nivel de riesgo para que nunca se encime
    // con el bloque de presion arterial, sin importar que tan largo sea el texto.
    const iconAreaWidth = 32;   // espacio reservado para el circulo + icono
    const presionBlockWidth = 55; // espacio reservado para el bloque de presion arterial (derecha)
    const nivelMaxWidth = pageWidth - marginX * 2 - iconAreaWidth - presionBlockWidth;

    let nivelFontSize = 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nivelFontSize);
    let nivelLineas = doc.splitTextToSize(nivelRiesgo, nivelMaxWidth);

    // Si no cabe en una linea, reduce el tamano de letra progresivamente
    while (nivelLineas.length > 1 && nivelFontSize > 10) {
      nivelFontSize -= 0.5;
      doc.setFontSize(nivelFontSize);
      nivelLineas = doc.splitTextToSize(nivelRiesgo, nivelMaxWidth);
    }

    // Si aun con letra chica no entra en una linea, el banner crece para dar espacio a 2 lineas
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

  cambiarTab(tab: TabPaciente) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();

    if (tab === 'info') {
      setTimeout(() => this.inicializarCalendarioNacimiento(), 100);
    }

    if (tab === 'analisis') {
      this.verificarEstadoSistema();
    }
  }

  inicializarCalendarioNacimiento() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }

    const elemento = document.querySelector('#fechaNacimientoInput') as HTMLInputElement;

    if (!elemento) {
      return;
    }

    const configNacimiento: any = {
      locale: Spanish,
      dateFormat: "Y-m-d",
      defaultDate: this.usuarioSeleccionado?.fechaNacimiento || null,
      maxDate: "today",
      appendTo: document.body,
      static: false,
      disableMobile: true,
      onChange: (selectedDates: any, dateStr: string) => {
        if (this.usuarioSeleccionado) {
          this.usuarioSeleccionado.fechaNacimiento = dateStr;
          this.cdr.detectChanges();
        }
      }
    };

    try {
      this.fpNacimientoInstance = flatpickr('#fechaNacimientoInput', configNacimiento);
    } catch (error) {
      console.error('Error al inicializar Flatpickr:', error);
    }
  }

  async cargarDatosCompletosPaciente() {
    if (!this.pacienteId) return;

    try {
      const usuarioActualizado = await firstValueFrom(
        this.usersService.getUsuarioById(this.pacienteId)
      );

      if (usuarioActualizado) {
        this.usuarioSeleccionado = {
          ...this.usuarioSeleccionado,
          ...usuarioActualizado
        };

        this.inicializarCampos();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.warn('Usando datos del state para el paciente');
    }
  }

  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    const usuario = this.usuarioSeleccionado;

    usuario.tempApellidoPaterno = usuario.apPaterno || usuario.appaterno || '';
    usuario.tempApellidoMaterno = usuario.apMaterno || usuario.apmaterno || '';
    usuario.nombre = usuario.nombre || '';
    usuario.correo = usuario.correo || '';
    usuario.telefono = usuario.telefono || '';
    usuario.genero = usuario.genero || 'No especificado';

    usuario.fechaNacimiento = usuario.fechaNacimiento || '';
    usuario.curp = usuario.curp || '';
    usuario.domicilio = usuario.domicilio || '';
    usuario.codigoPostal = usuario.codigoPostal || '';
    usuario.localidad = usuario.localidad || '';
    usuario.municipio = usuario.municipio || '';
    usuario.estado = usuario.estado || '';

    usuario.nss = usuario.nss || null;
    usuario.tipoSangre = usuario.tipoSangre || null;

    usuario.peso = usuario.peso !== undefined && usuario.peso !== null && usuario.peso !== ''
      ? Number(usuario.peso)
      : null;
    usuario.altura = usuario.altura !== undefined && usuario.altura !== null && usuario.altura !== ''
      ? Number(usuario.altura)
      : null;

    usuario.antecedentesFamiliares = usuario.antecedentesFamiliares || '';
    usuario.activo = usuario.activo !== undefined ? usuario.activo : true;

    this.cdr.detectChanges();
  }

  async cargarDatosReales() {
    if (!this.usuarioSeleccionado?.correo) return;

    this.cargandoCitas = true;
    this.citasCargadas = false;

    try {
      const citas = await firstValueFrom(
        this.usersService.getMisCitas(this.usuarioSeleccionado.correo)
      );

      if (citas && citas.length > 0) {
        this.citasPaciente = citas;
        this.calcularEstadisticas(citas);
        this.generarHistorialDesdeCitas(citas);
      } else {
        this.citasPaciente = [];
        this.estadisticas = {
          totalCitas: 0,
          citasCompletadas: 0,
          citasPendientes: 0,
          citasCanceladas: 0,
          ultimaCita: null,
          proximaCita: null
        };
      }

      this.citasCargadas = true;

    } catch (error) {
      console.error('Error al cargar citas del paciente:', error);
      this.citasPaciente = [];
      this.estadisticas = {
        totalCitas: 0,
        citasCompletadas: 0,
        citasPendientes: 0,
        citasCanceladas: 0,
        ultimaCita: null,
        proximaCita: null
      };
    } finally {
      this.cargandoCitas = false;
      this.cdr.detectChanges();
    }
  }

  calcularEstadisticas(citas: any[]) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const completadas = citas.filter(c => c.estado === 'Completada');
    const pendientes = citas.filter(c =>
      c.estado === 'Programada' || c.estado === 'Confirmada'
    );
    const canceladas = citas.filter(c => c.estado === 'Cancelada' || c.estado === 'No Asistio');

    const citasOrdenadas = [...citas].sort((a, b) => {
      const fechaA = new Date(`${a.fechacita}T${a.horacita || '00:00'}`);
      const fechaB = new Date(`${b.fechacita}T${b.horacita || '00:00'}`);
      return fechaB.getTime() - fechaA.getTime();
    });

    const ultimaCita = citasOrdenadas.length > 0 ? citasOrdenadas[0] : null;

    const citasFuturas = citas.filter(c => {
      const fechaCita = new Date(c.fechacita);
      return fechaCita >= hoy && (c.estado === 'Programada' || c.estado === 'Confirmada');
    }).sort((a, b) => {
      return new Date(a.fechacita).getTime() - new Date(b.fechacita).getTime();
    });

    const proximaCita = citasFuturas.length > 0 ? citasFuturas[0] : null;

    this.estadisticas = {
      totalCitas: citas.length,
      citasCompletadas: completadas.length,
      citasPendientes: pendientes.length,
      citasCanceladas: canceladas.length,
      ultimaCita: ultimaCita ? ultimaCita.fechacita : null,
      proximaCita: proximaCita ? proximaCita.fechacita : null
    };
  }

  generarHistorialDesdeCitas(citas: any[]) {
    const historial: HistorialPaciente[] = [];

    const citasOrdenadas = [...citas].sort((a, b) => {
      return new Date(b.fechacita).getTime() - new Date(a.fechacita).getTime();
    });

    citasOrdenadas.forEach(cita => {
      let accion = '';
      let detalle = '';

      const fechaFormateada = this.formatearFechaYHora(cita.fechacita, cita.horacita);

      switch (cita.estado) {
        case 'Completada':
          accion = 'Cita completada';
          detalle = `Cita del ${fechaFormateada} - ${cita.motivo || 'Sin motivo'}`;
          break;
        case 'Programada':
          accion = 'Cita programada';
          detalle = `Cita para ${fechaFormateada} - ${cita.motivo || 'Sin motivo'}`;
          break;
        case 'Confirmada':
          accion = 'Cita confirmada';
          detalle = `Cita confirmada para ${fechaFormateada}`;
          break;
        case 'Cancelada':
          accion = 'Cita cancelada';
          detalle = `Cita del ${fechaFormateada} - Cancelada`;
          break;
        case 'No Asistio':
          accion = 'No asistio';
          detalle = `No asistio a cita del ${fechaFormateada}`;
          break;
        default:
          accion = 'Cita registrada';
          detalle = `Cita del ${fechaFormateada} - ${cita.motivo || ''}`;
      }

      historial.push({
        fecha: fechaFormateada,
        accion: accion,
        detalle: detalle,
        usuario: 'Sistema'
      });
    });

    if (historial.length === 0) {
      const fechaActual = new Date();
      const fechaStr = fechaActual.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      historial.push({
        fecha: fechaStr,
        accion: 'Paciente registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      });
    }

    this.historialCambios = historial;
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

  agregarHistorial(accion: string, detalle: string) {
    const ahora = new Date();
    const fechaStr = ahora.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.historialCambios.unshift({
      fecha: fechaStr,
      accion: accion,
      detalle: detalle,
      usuario: 'Usuario actual'
    });
  }

  getEstadoPaciente(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.citasPendientes > 0) {
      return { texto: `${this.estadisticas.citasPendientes} citas pendientes`, clase: 'estado-pendiente', icono: 'bi-clock-fill' };
    }

    if (this.estadisticas && this.estadisticas.totalCitas > 0) {
      return { texto: 'Activo con historial', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
    }

    return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  formatearCURP() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = this.usuarioSeleccionado.curp.toUpperCase().trim();
      this.cdr.detectChanges();
    }
  }

  formatearCodigoPostal() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.codigoPostal) {
      const cp = this.usuarioSeleccionado.codigoPostal.replace(/\D/g, '').slice(0, 5);
      this.usuarioSeleccionado.codigoPostal = cp;
      this.cdr.detectChanges();
    }
  }

  capitalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.split(' ').map(palabra =>
      palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
  }

  formatearCampoTexto(campo: string) {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado[campo]) {
      this.usuarioSeleccionado[campo] = this.capitalizarTexto(this.usuarioSeleccionado[campo]);
      this.cdr.detectChanges();
    }
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
    return partes.length ? partes.join(', ') : 'Sin ubicacion registrada';
  }

  tieneUbicacionCompleta(): boolean {
    const u = this.usuarioSeleccionado;
    if (!u) return false;
    return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
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

  formatearFechaNacimiento(fecha: string): string {
    if (!fecha) return 'No registrada';
    return this.formatearFechaSegura(fecha);
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

  volver() {
    this.location.back();
  }

  lanzarNotificacion(mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    this.cdr.detectChanges();

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      this.mostrarToast = false;
      this.cdr.detectChanges();
    }, 4000);
  }

  abrirModalCita() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    this.nuevaCita = {
      fechaCita: `${anio}-${mes}-${dia}`,
      horaCita: '10:00',
      motivo: '',
      sintomas: '',
      modalidad: 'Presencial'
    };

    this.mostrarModalCita = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.inicializarCalendariosCita();
    }, 100);
  }

  cerrarModalCita() {
    this.destruirCalendariosCita();
    this.mostrarModalCita = false;
  }

  inicializarCalendariosCita() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.destruirCalendariosCita();

    setTimeout(() => {
      const hoy = new Date();
      const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

      const fechaElement = document.querySelector('#fechaCitaInput');
      const horaElement = document.querySelector('#horaCitaInput');

      if (fechaElement) {
        this.fpFechaInstance = flatpickr('#fechaCitaInput', {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevaCita.fechaCita || "today",
          minDate: "today",
          maxDate: fechaMaximaCita,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.fechaCita = dateStr;
            this.cdr.detectChanges();
          }
        });
      }

      if (horaElement) {
        this.fpHoraInstance = flatpickr('#horaCitaInput', {
          locale: Spanish,
          enableTime: true,
          noCalendar: true,
          dateFormat: "H:i",
          time_24hr: true,
          defaultDate: this.nuevaCita.horaCita || "10:00",
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.horaCita = dateStr;
            this.cdr.detectChanges();
          }
        });
      }
    }, 100);
  }

  destruirCalendariosCita() {
    if (this.fpFechaInstance) {
      try { this.fpFechaInstance.destroy(); } catch (e) { }
      this.fpFechaInstance = null;
    }
    if (this.fpHoraInstance) {
      try { this.fpHoraInstance.destroy(); } catch (e) { }
      this.fpHoraInstance = null;
    }
  }

  async registrarCita() {
    if (!this.nuevaCita.fechaCita || !this.nuevaCita.horaCita || !this.nuevaCita.motivo.trim()) {
      this.lanzarNotificacion("Por favor rellene los campos obligatorios para agendar la cita.", "warning");
      return;
    }

    this.isSavingCita = true;
    try {
      const nombre = (this.usuarioSeleccionado.nombre || '').trim();
      const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || this.usuarioSeleccionado.apPaterno || '').trim();
      const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || this.usuarioSeleccionado.apMaterno || '').trim();

      const payloadCita = {
        nombrePaciente: nombre,
        apPaternoPaciente: apPaterno,
        apMaternoPaciente: apMaterno,
        telefonoPaciente: this.usuarioSeleccionado.telefono ? String(this.usuarioSeleccionado.telefono) : null,
        correoPaciente: this.usuarioSeleccionado.correo,
        fechaCita: this.nuevaCita.fechaCita,
        horaCita: this.nuevaCita.horaCita.length === 5 ? `${this.nuevaCita.horaCita}:00` : this.nuevaCita.horaCita,
        motivo: this.nuevaCita.motivo.trim(),
        sintomas: this.nuevaCita.sintomas.trim() || 'Sin sintomas',
        modalidad: this.nuevaCita.modalidad,
        estado: 'Programada'
      };

      await firstValueFrom(this.usersService.crearCita(payloadCita));
      await this.cargarDatosReales();

      this.cerrarModalCita();
      this.lanzarNotificacion("Cita asignada. Se registro la cita medica correctamente.", "success");

    } catch (error: any) {
      console.error("Error al registrar la cita:", error);
      this.lanzarNotificacion("Hubo un error al registrar la cita medica.", "error");
    } finally {
      this.isSavingCita = false;
      this.cdr.detectChanges();
    }
  }

  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();

    if (!nombre || !apPaterno || !this.usuarioSeleccionado.correo) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo son obligatorios.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(`${validacion.mensaje}`, "warning");
      return;
    }

    this.isSaving = true;
    const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

    try {
      const pesoFinal = this.usuarioSeleccionado.peso !== undefined &&
        this.usuarioSeleccionado.peso !== null &&
        this.usuarioSeleccionado.peso !== ''
        ? Number(this.usuarioSeleccionado.peso)
        : null;

      const alturaFinal = this.usuarioSeleccionado.altura !== undefined &&
        this.usuarioSeleccionado.altura !== null &&
        this.usuarioSeleccionado.altura !== ''
        ? Number(this.usuarioSeleccionado.altura)
        : null;

      const datosPostgres = {
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        appaterno: apPaterno,
        apmaterno: apMaterno,
        correo: this.usuarioSeleccionado.correo,
        telefono: this.usuarioSeleccionado.telefono || null,
        genero: this.usuarioSeleccionado.genero || null,
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento || null,
        curp: (this.usuarioSeleccionado.curp || '').toUpperCase().trim() || null,
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim() || null,
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim() || null,
        localidad: (this.usuarioSeleccionado.localidad || '').trim() || null,
        municipio: (this.usuarioSeleccionado.municipio || '').trim() || null,
        estado: (this.usuarioSeleccionado.estado || '').trim() || null,
        nss: this.usuarioSeleccionado.nss || null,
        tipoSangre: this.usuarioSeleccionado.tipoSangre || null,
        peso: pesoFinal,
        altura: alturaFinal,
        antecedentesFamiliares: this.usuarioSeleccionado.antecedentesFamiliares || null,
        rol: 'Paciente',
        activo: this.usuarioSeleccionado.activo ?? true
      };

      await firstValueFrom(this.usersService.updateUsuario(id, datosPostgres));

      this.usuarioSeleccionado.nombre = nombre;
      this.usuarioSeleccionado.apPaterno = apPaterno;
      this.usuarioSeleccionado.apMaterno = apMaterno;
      this.usuarioSeleccionado.tempApellidoPaterno = apPaterno;
      this.usuarioSeleccionado.tempApellidoMaterno = apMaterno;
      this.usuarioSeleccionado.peso = pesoFinal;
      this.usuarioSeleccionado.altura = alturaFinal;

      this.lanzarNotificacion("Los datos del paciente se actualizaron correctamente.", "success");

      this.agregarHistorial(
        'Datos actualizados',
        'Informacion del paciente actualizada por el usuario'
      );

      setTimeout(() => {
        this.router.navigate(['/pacientes']);
      }, 2000);

    } catch (error: any) {
      console.error('Error al actualizar:', error);
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.nombre || u.nombre.trim().length < 2) {
      return { valido: false, mensaje: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (!u.tempApellidoPaterno || u.tempApellidoPaterno.trim().length < 2) {
      return { valido: false, mensaje: 'El apellido paterno debe tener al menos 2 caracteres' };
    }

    if (!u.correo || !u.correo.includes('@')) {
      return { valido: false, mensaje: 'El correo electronico no es valido' };
    }

    if (u.curp && u.curp.length > 0) {
      const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
      if (!curpRegex.test(u.curp.toUpperCase())) {
        return { valido: false, mensaje: 'El formato de CURP no es valido' };
      }
    }

    if (u.codigoPostal && u.codigoPostal.length > 0) {
      const cpRegex = /^[0-9]{5}$/;
      if (!cpRegex.test(u.codigoPostal)) {
        return { valido: false, mensaje: 'El codigo postal debe tener 5 digitos numericos' };
      }
    }

    if (u.peso && (u.peso < 10 || u.peso > 500)) {
      return { valido: false, mensaje: 'El peso debe estar entre 10 y 500 kg' };
    }

    if (u.altura && (u.altura < 0.5 || u.altura > 3)) {
      return { valido: false, mensaje: 'La altura debe estar entre 0.5 y 3 metros' };
    }

    return { valido: true, mensaje: '' };
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
        this.lanzarNotificacion('El sistema de analisis no esta disponible. Asegurate de que el backend este corriendo.', 'warning');
      }
    });
  }

  onAnalisisFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) {
        this.lanzarNotificacion('El archivo es demasiado grande. Maximo 10MB.', 'error');
        return;
      }
      this.analisisArchivo = file;
      this.analisisArchivoNombre = file.name;
      this.lanzarNotificacion('PDF cargado correctamente.', 'success');
    } else {
      this.lanzarNotificacion('Solo se permiten archivos PDF.', 'error');
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
          this.lanzarNotificacion('El archivo es demasiado grande. Maximo 10MB.', 'error');
          return;
        }
        this.analisisArchivo = file;
        this.analisisArchivoNombre = file.name;
        this.lanzarNotificacion('PDF cargado correctamente.', 'success');
      } else {
        this.lanzarNotificacion('Solo se permiten archivos PDF.', 'error');
      }
    }
  }

  ejecutarAnalisis() {
    if (!this.analisisArchivo) {
      this.lanzarNotificacion('Por favor, seleccione un archivo PDF.', 'warning');
      return;
    }

    if (!this.sistemaActivo) {
      this.lanzarNotificacion('El sistema de analisis no esta disponible. Contacte al administrador.', 'error');
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

          this.lanzarNotificacion('Analisis completado exitosamente.', 'success');
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.isAnalizando = false;
        console.error('[HTAS] Error en analisis:', error);
        this.lanzarNotificacion(error.error?.error || 'Error al analizar el paciente.', 'error');
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
}