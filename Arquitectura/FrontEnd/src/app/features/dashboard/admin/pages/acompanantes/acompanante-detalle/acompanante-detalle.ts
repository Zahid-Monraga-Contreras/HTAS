import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GoogleService } from '../../../../../../core/services/google.service';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import jsPDF from 'jspdf';

interface HistorialAcompanante {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

type TabAcompanante = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-acompanante-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './acompanante-detalle.html',
  styleUrls: ['./acompanante-detalle.css']
})
export class AcompananteDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private titleService = inject(Title);

  usuarioSeleccionado: any = null;
  isSaving = false;

  activeTab: TabAcompanante = 'info';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  private fpNacimientoInstance: any = null;
  private fpAsignacionInstance: any = null;

  historialCambios: HistorialAcompanante[] = [];
  visitasAcompanante: any[] = [];

  estadisticas: {
    totalVisitas: number;
    visitasCompletadas: number;
    visitasPendientes: number;
    visitasCanceladas: number;
    ultimaVisita: string | null;
    proximaVisita: string | null;
  } | null = null;

  acompananteId: number | null = null;
  fechaGeneracion = '';

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
      this.acompananteId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();

      this.cargarDatosCompletosAcompanante();
      this.cargarDatosReales();

      setTimeout(() => {
        this.inicializarCalendarios();
      }, 500);

    } else {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/acompanantes']);
      }
    }
  }

  ngOnDestroy() {
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.fpAsignacionInstance) {
      try { this.fpAsignacionInstance.destroy(); } catch (e) { }
      this.fpAsignacionInstance = null;
    }
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  // --- CONTROL DE PESTAÑAS ---
  cambiarTab(tab: TabAcompanante) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();

    if (tab === 'info') {
      setTimeout(() => this.inicializarCalendarios(), 100);
    }
  }

  // --- INICIALIZAR CALENDARIOS ---
  inicializarCalendarios() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.fpAsignacionInstance) {
      try { this.fpAsignacionInstance.destroy(); } catch (e) { }
      this.fpAsignacionInstance = null;
    }

    const nacimientoEl = document.querySelector('#fechaNacimientoInput') as HTMLInputElement;
    if (nacimientoEl) {
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
      this.fpNacimientoInstance = flatpickr('#fechaNacimientoInput', configNacimiento);
    }

    const asignacionEl = document.querySelector('#fechaInput') as HTMLInputElement;
    if (asignacionEl) {
      const hoy = new Date();
      const fechaMaximaAsignacion = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

      const configAsignacion: any = {
        locale: Spanish,
        dateFormat: "Y-m-d",
        defaultDate: this.usuarioSeleccionado?.fechaAsignacion || "today",
        minDate: "today",
        maxDate: fechaMaximaAsignacion,
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.usuarioSeleccionado) {
            this.usuarioSeleccionado.fechaAsignacion = dateStr;
            this.cdr.detectChanges();
          }
        }
      };
      this.fpAsignacionInstance = flatpickr('#fechaInput', configAsignacion);
    }
  }

  // --- CARGAR DATOS ---
  async cargarDatosCompletosAcompanante() {
    if (!this.acompananteId) return;

    try {
      const usuarioActualizado = await firstValueFrom(
        this.usersService.getUsuarioById(this.acompananteId)
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
      console.warn('Usando datos del state para el acompañante');
    }
  }

  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    const u = this.usuarioSeleccionado;
    u.nombre = u.nombre || '';
    u.apPaterno = u.apPaterno || '';
    u.apMaterno = u.apMaterno || '';
    u.correo = u.correo || '';
    u.telefono = u.telefono || '';
    u.genero = u.genero || 'No especificado';
    u.fechaNacimiento = u.fechaNacimiento || '';
    u.fechaAsignacion = u.fechaAsignacion || '';
    u.curp = u.curp || '';
    u.domicilio = u.domicilio || '';
    u.codigoPostal = u.codigoPostal || '';
    u.localidad = u.localidad || '';
    u.municipio = u.municipio || '';
    u.estado = u.estado || '';
    u.activo = u.activo !== undefined ? u.activo : true;

    this.cdr.detectChanges();
  }

  async cargarDatosReales() {
    if (!this.usuarioSeleccionado?.correo) return;

    try {
      this.visitasAcompanante = [
        {
          id: 1,
          fechavisita: '2026-07-10',
          horavisita: '10:30',
          motivo: 'Visita de seguimiento',
          estado: 'Completada'
        },
        {
          id: 2,
          fechavisita: '2026-07-20',
          horavisita: '15:00',
          motivo: 'Revisión de documentación',
          estado: 'Programada'
        }
      ];

      this.calcularEstadisticas(this.visitasAcompanante);
      this.generarHistorialDesdeVisitas(this.visitasAcompanante);

    } catch (error) {
      console.error('Error al cargar visitas del acompañante:', error);
      this.visitasAcompanante = [];
      this.estadisticas = {
        totalVisitas: 0,
        visitasCompletadas: 0,
        visitasPendientes: 0,
        visitasCanceladas: 0,
        ultimaVisita: null,
        proximaVisita: null
      };
    } finally {
      this.cdr.detectChanges();
    }
  }

  calcularEstadisticas(visitas: any[]) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const completadas = visitas.filter(v => v.estado === 'Completada');
    const pendientes = visitas.filter(v => v.estado === 'Programada' || v.estado === 'Confirmada');
    const canceladas = visitas.filter(v => v.estado === 'Cancelada' || v.estado === 'No Asistió');

    const visitasOrdenadas = [...visitas].sort((a, b) => {
      const fechaA = new Date(`${a.fechavisita}T${a.horavisita || '00:00'}`);
      const fechaB = new Date(`${b.fechavisita}T${b.horavisita || '00:00'}`);
      return fechaB.getTime() - fechaA.getTime();
    });

    const ultimaVisita = visitasOrdenadas.length > 0 ? visitasOrdenadas[0] : null;

    const visitasFuturas = visitas.filter(v => {
      const fechaVisita = new Date(v.fechavisita);
      return fechaVisita >= hoy && (v.estado === 'Programada' || v.estado === 'Confirmada');
    }).sort((a, b) => {
      return new Date(a.fechavisita).getTime() - new Date(b.fechavisita).getTime();
    });

    const proximaVisita = visitasFuturas.length > 0 ? visitasFuturas[0] : null;

    this.estadisticas = {
      totalVisitas: visitas.length,
      visitasCompletadas: completadas.length,
      visitasPendientes: pendientes.length,
      visitasCanceladas: canceladas.length,
      ultimaVisita: ultimaVisita ? ultimaVisita.fechavisita : null,
      proximaVisita: proximaVisita ? proximaVisita.fechavisita : null
    };
  }

  generarHistorialDesdeVisitas(visitas: any[]) {
    const historial: HistorialAcompanante[] = [];

    const visitasOrdenadas = [...visitas].sort((a, b) => {
      return new Date(b.fechavisita).getTime() - new Date(a.fechavisita).getTime();
    });

    visitasOrdenadas.forEach(visita => {
      const fechaFormateada = this.formatearFechaYHora(visita.fechavisita, visita.horavisita);
      let accion = '';
      let detalle = '';

      switch (visita.estado) {
        case 'Completada':
          accion = 'Visita completada';
          detalle = `Visita del ${fechaFormateada} - ${visita.motivo || 'Sin motivo'}`;
          break;
        case 'Programada':
          accion = 'Visita programada';
          detalle = `Visita para ${fechaFormateada} - ${visita.motivo || 'Sin motivo'}`;
          break;
        case 'Confirmada':
          accion = 'Visita confirmada';
          detalle = `Visita confirmada para ${fechaFormateada}`;
          break;
        case 'Cancelada':
          accion = 'Visita cancelada';
          detalle = `Visita del ${fechaFormateada} - Cancelada`;
          break;
        case 'No Asistió':
          accion = 'No asistió';
          detalle = `No asistió a visita del ${fechaFormateada}`;
          break;
        default:
          accion = 'Visita registrada';
          detalle = `Visita del ${fechaFormateada}`;
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
        accion: 'Acompañante registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      });
    }

    this.historialCambios = historial;
  }

  // --- MÉTODOS DE UTILIDAD ---
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

  limpiarFecha(fecha: any): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') {
      return fecha.includes('T') ? fecha.split('T')[0] : fecha;
    }
    return new Date(fecha).toISOString().split('T')[0];
  }

  // --- ESTADO DEL ACOMPAÑANTE ---
  getEstadoAcompanante(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.visitasPendientes > 0) {
      return { texto: `${this.estadisticas.visitasPendientes} visitas pendientes`, clase: 'estado-pendiente', icono: 'bi-clock-fill' };
    }

    if (this.estadisticas && this.estadisticas.totalVisitas > 0) {
      return { texto: 'Activo con historial', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
    }

    return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  // --- UBICACIÓN ---
  tieneUbicacionCompleta(): boolean {
    const u = this.usuarioSeleccionado;
    if (!u) return false;
    return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
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

  // --- FORMATEO DE CAMPOS ---
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

  // --- EXPEDIENTE ---
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

  /**
   * DESCARGAR EXPEDIENTE EN PDF
   * Genera un PDF profesional con los datos del acompañante usando jsPDF
   */
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

  // --- GUARDAR CAMBIOS ---
  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.apPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.apMaterno || '').trim();
    const correo = (this.usuarioSeleccionado.correo || '').trim();
    const telefono = (this.usuarioSeleccionado.telefono || '').trim();

    if (!nombre || !apPaterno || !apMaterno || !correo || !telefono) {
      this.lanzarNotificacion("Todos los campos personales básicos son obligatorios.", "warning");
      return;
    }

    if (!this.usuarioSeleccionado.fechaNacimiento || !this.usuarioSeleccionado.fechaAsignacion) {
      this.lanzarNotificacion("La fecha de nacimiento y asignación son obligatorias.", "warning");
      return;
    }

    this.isSaving = true;
    const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

    try {
      const payload = {
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        correo: correo,
        telefono: telefono,
        genero: this.usuarioSeleccionado.genero,
        activo: this.usuarioSeleccionado.activo ?? true,
        rol: 'Acompañante',
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento,
        fechaAsignacion: this.usuarioSeleccionado.fechaAsignacion,
        curp: (this.usuarioSeleccionado.curp || '').trim().toUpperCase(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      if (payload.curp && payload.curp.length > 0) {
        const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
        if (!curpRegex.test(payload.curp)) {
          this.lanzarNotificacion("El formato de CURP no es válido. Debe tener 18 caracteres alfanuméricos.", "warning");
          this.isSaving = false;
          return;
        }
      }

      if (payload.codigoPostal && payload.codigoPostal.length > 0) {
        const cpRegex = /^[0-9]{5}$/;
        if (!cpRegex.test(payload.codigoPostal)) {
          this.lanzarNotificacion("El código postal debe tener 5 dígitos numéricos.", "warning");
          this.isSaving = false;
          return;
        }
      }

      await firstValueFrom(this.usersService.updateUsuario(id, payload));

      this.lanzarNotificacion("¡Éxito! La información del acompañante ha sido actualizada.", "success");

      this.agregarHistorial('Datos actualizados', 'Información del acompañante actualizada');

      setTimeout(() => {
        this.router.navigate(['/acompanantes']);
      }, 2000);

    } catch (error: any) {
      console.error("Error al guardar cambios:", error);
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo guardar: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
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

  // --- TOAST ---
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

  volver() {
    this.location.back();
  }
}