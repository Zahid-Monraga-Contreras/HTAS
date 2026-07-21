// src/app/components/medico-detalle/medico-detalle.ts

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleService } from '../../../../../../core/services/google.service';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import jsPDF from 'jspdf';

interface HistorialMedico {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

type TabMedico = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-medico-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './medico-detalle.html',
  styleUrls: ['./medico-detalle.css']
})
export class MedicoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  usuarioSeleccionado: any = null;
  isSaving = false;

  activeTab: TabMedico = 'info';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  private fpNacimientoInstance: any = null;

  historialCambios: HistorialMedico[] = [];
  pacientesAtendidos: any[] = [];

  estadisticas: {
    totalPacientes: number;
    citasCompletadas: number;
    citasPendientes: number;
    promedioConsultas: number;
  } | null = null;

  medicoId: number | null = null;
  fechaGeneracion = '';

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const state = history.state;

    this.fechaGeneracion = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    if (state && state.usuario) {
      this.medicoId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();
      this.cargarDatosAdicionales();

      setTimeout(() => {
        this.inicializarCalendarioNacimiento();
      }, 500);

    } else {
      this.router.navigate(['/medicos']);
    }
  }

  ngOnDestroy() {
    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  cambiarTab(tab: TabMedico) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();

    if (tab === 'info') {
      setTimeout(() => this.inicializarCalendarioNacimiento(), 100);
    }
  }

  inicializarCalendarioNacimiento() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.fpNacimientoInstance) {
      try { this.fpNacimientoInstance.destroy(); } catch (e) { }
      this.fpNacimientoInstance = null;
    }

    const elemento = document.querySelector('#fechaNacimientoMedicoInput') as HTMLInputElement;
    if (!elemento) return;

    const config: any = {
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
      this.fpNacimientoInstance = flatpickr('#fechaNacimientoMedicoInput', config);
    } catch (error) {
      console.error('Error al inicializar Flatpickr:', error);
    }
  }

  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    if (!this.usuarioSeleccionado.fechaNacimiento) {
      this.usuarioSeleccionado.fechaNacimiento = '';
    }
    if (!this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = '';
    }
    if (!this.usuarioSeleccionado.domicilio) {
      this.usuarioSeleccionado.domicilio = '';
    }
    if (!this.usuarioSeleccionado.codigoPostal) {
      this.usuarioSeleccionado.codigoPostal = '';
    }
    if (!this.usuarioSeleccionado.localidad) {
      this.usuarioSeleccionado.localidad = '';
    }
    if (!this.usuarioSeleccionado.municipio) {
      this.usuarioSeleccionado.municipio = '';
    }
    if (!this.usuarioSeleccionado.estado) {
      this.usuarioSeleccionado.estado = '';
    }
    if (!this.usuarioSeleccionado.direccionClinica) {
      this.usuarioSeleccionado.direccionClinica = '';
    }

    if (!this.usuarioSeleccionado.tempNombre) {
      this.usuarioSeleccionado.tempNombre = this.usuarioSeleccionado.nombre || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoPaterno) {
      this.usuarioSeleccionado.tempApellidoPaterno = this.usuarioSeleccionado.apPaterno || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoMaterno) {
      this.usuarioSeleccionado.tempApellidoMaterno = this.usuarioSeleccionado.apMaterno || '';
    }

    this.cdr.detectChanges();
  }

  async cargarDatosAdicionales() {
    if (!this.usuarioSeleccionado) return;

    this.cargarHistorialMedico();

    this.estadisticas = {
      totalPacientes: Math.floor(Math.random() * 50) + 10,
      citasCompletadas: Math.floor(Math.random() * 30) + 5,
      citasPendientes: Math.floor(Math.random() * 10) + 2,
      promedioConsultas: Math.floor(Math.random() * 15) + 5
    };

    this.pacientesAtendidos = [
      { id: 1, nombre: 'Maria Lopez Gonzalez', fechaUltimaCita: '2026-07-01', motivo: 'Consulta general' },
      { id: 2, nombre: 'Juan Perez Garcia', fechaUltimaCita: '2026-06-28', motivo: 'Control de rutina' },
      { id: 3, nombre: 'Ana Martinez Ruiz', fechaUltimaCita: '2026-06-25', motivo: 'Dolor de cabeza' }
    ];

    if (this.usuarioSeleccionado.especialidad) {
      this.agregarHistorial(
        'Especialidad asignada',
        `Especialidad: ${this.usuarioSeleccionado.especialidad}`
      );
    }

    this.cdr.detectChanges();
  }

  cargarHistorialMedico() {
    const ahora = new Date();
    const fechaStr = ahora.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    this.historialCambios = [
      {
        fecha: fechaStr,
        accion: 'Medico registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      }
    ];
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

  getEstadoMedico(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.citasPendientes > 0) {
      return { texto: 'Con citas pendientes', clase: 'estado-ocupado', icono: 'bi-clock-fill' };
    }

    return { texto: 'Activo disponible', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
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

    return String(fecha) || 'No disponible';
  }

  formatearFechaNacimiento(fecha: string): string {
    if (!fecha) return 'No registrada';
    return this.formatearFechaSegura(fecha);
  }

  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.tempNombre || u.tempNombre.trim().length < 2) {
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

    return { valido: true, mensaje: '' };
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

  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.tempNombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();
    const correoFinal = this.usuarioSeleccionado.correo || this.usuarioSeleccionado.Correo;

    if (!nombre || !apPaterno || !correoFinal) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo electronico son requeridos.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
      return;
    }

    const nombreAnterior = this.usuarioSeleccionado.nombre || '';
    const apPaternoAnterior = this.usuarioSeleccionado.apPaterno || '';

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const idFinal = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

      const datosActualizados = {
        nombre: nombre,
        apPaterno: apPaterno,
        appaterno: apPaterno,
        apMaterno: apMaterno,
        apmaterno: apMaterno,
        correo: correoFinal,
        telefono: this.usuarioSeleccionado.telefono || 'Sin telefono',
        genero: this.usuarioSeleccionado.genero || 'No especificado',
        especialidad: this.usuarioSeleccionado.especialidad || 'General',
        direccionClinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        direccionclinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        rol: this.usuarioSeleccionado.rol || 'Medico',
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento || null,
        curp: (this.usuarioSeleccionado.curp || '').toUpperCase().trim(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      if (this.usuarioSeleccionado.fuente === 'Firebase') {
        await this.googleService.updateUsuario(idFinal, datosActualizados);
      } else {
        await firstValueFrom(this.usersService.updateUsuario(idFinal, datosActualizados));
      }

      if (nombreAnterior !== nombre || apPaternoAnterior !== apPaterno) {
        this.agregarHistorial(
          'Datos personales actualizados',
          `De: "${nombreAnterior} ${apPaternoAnterior}" a "${nombre} ${apPaterno}"`
        );
      } else {
        this.agregarHistorial(
          'Informacion actualizada',
          'Datos del medico actualizados'
        );
      }

      this.lanzarNotificacion("Los datos del medico se actualizaron correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/medicos']);
      }, 2000);

    } catch (error) {
      console.error('Error detallado al guardar:', error);
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
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
      ['Edad', this.calcularEdad() !== null ? this.calcularEdad() + ' anos' : 'No disponible'],
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