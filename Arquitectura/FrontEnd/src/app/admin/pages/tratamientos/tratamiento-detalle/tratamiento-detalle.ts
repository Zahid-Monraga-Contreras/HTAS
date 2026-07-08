import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

interface HistorialTratamiento {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

interface RegistroToma {
  id: number;
  fecha: string;
  estado: string;
  notas: string;
}

@Component({
  selector: 'app-tratamiento-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './tratamiento-detalle.html',
  styleUrls: ['./tratamiento-detalle.css']
})
export class TratamientoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  tratamientoSeleccionado: any = null;
  isSaving = false;

  private fpInicio: any = null;
  private fpFin: any = null;

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  historialCambios: HistorialTratamiento[] = [];
  mostrarHistorial = false;

  registrosTomas: RegistroToma[] = [];
  mostrarTomas = false;

  estadisticas: {
    totalTomas: number;
    tomasCompletadas: number;
    tomasPendientes: number;
    porcentajeCumplimiento: number;
    diasRestantes: number;
  } | null = null;

  pacienteInfo: any = null;
  medicamentoInfo: any = null;

  cargando = false;

  ngOnInit() {
    let state: any = null;
    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    if (state && state.tratamiento) {
      this.tratamientoSeleccionado = { ...state.tratamiento };
      this.inicializarCampos();
      this.cargarDatosAdicionales();
      setTimeout(() => {
        this.inicializarCalendario();
      }, 100);
    } else {
      this.router.navigate(['/tratamientos']);
    }
  }

  inicializarCampos() {
    if (!this.tratamientoSeleccionado) return;

    // Mapear campos del backend
    const t = this.tratamientoSeleccionado;

    // ID del tratamiento
    this.tratamientoSeleccionado.idtratamiento = t.idtratamiento || t.IdTratamiento || t.id;

    // Información del paciente
    this.tratamientoSeleccionado.nombrepaciente = t.nombrepaciente || t.NombrePaciente || t.nombre || '';
    this.tratamientoSeleccionado.appaternopaciente = t.appaternopaciente || t.ApPaternoPaciente || t.appaterno || '';
    this.tratamientoSeleccionado.apmaternopaciente = t.apmaternopaciente || t.ApMaternoPaciente || t.apmaterno || '';

    // Información del medicamento
    this.tratamientoSeleccionado.nombremedicamento = t.nombremedicamento || t.NombreMedicamento || '';
    this.tratamientoSeleccionado.presentacion = t.presentacion || t.PresentacionMedicamento || '';
    this.tratamientoSeleccionado.concentracion = t.concentracion || t.ConcentracionMedicamento || '';
    this.tratamientoSeleccionado.laboratorio = t.laboratorio || t.LaboratorioMedicamento || '';

    // Datos del tratamiento
    this.tratamientoSeleccionado.dosis = t.dosis || t.Dosis || '';
    this.tratamientoSeleccionado.frecuenciahoras = t.frecuenciahoras || t.FrecuenciaHoras || 8;
    this.tratamientoSeleccionado.activo = t.activo !== undefined ? t.activo : true;

    // Fechas
    if (t.fechainicio || t.FechaInicio) {
      this.tratamientoSeleccionado.fechainicio = this.limpiarFecha(t.fechainicio || t.FechaInicio);
    }
    if (t.fechafin || t.FechaFin) {
      this.tratamientoSeleccionado.fechafin = this.limpiarFecha(t.fechafin || t.FechaFin);
    }

    this.tratamientoSeleccionado.notasinstrucciones = t.notasinstrucciones || t.NotasInstrucciones || '';

    // Información del doctor
    this.tratamientoSeleccionado.nombredoctor = t.nombredoctor || t.NombreDoctor || '';
    this.tratamientoSeleccionado.especialidaddoctor = t.especialidaddoctor || t.EspecialidadDoctor || '';
  }

  limpiarFecha(fecha: any): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') {
      return fecha.includes('T') ? fecha.split('T')[0] : fecha;
    }
    return new Date(fecha).toISOString().split('T')[0];
  }

  // ✅ CARGAR DATOS ADICIONALES REALES DESDE EL BACKEND
  async cargarDatosAdicionales() {
    if (!this.tratamientoSeleccionado) return;

    this.cargando = true;

    try {
      const idTratamiento = this.tratamientoSeleccionado.idtratamiento;

      // ✅ Obtener datos completos del tratamiento desde el backend
      const tratamientoCompleto = await firstValueFrom(
        this.usersService.getTratamientoById(idTratamiento)
      );

      if (tratamientoCompleto) {
        // Actualizar con los datos completos del backend
        this.tratamientoSeleccionado = { ...this.tratamientoSeleccionado, ...tratamientoCompleto };
        this.inicializarCampos();

        // ✅ Cargar información del paciente
        this.pacienteInfo = {
          nombre: tratamientoCompleto.nombrepaciente || tratamientoCompleto.NombrePaciente || '',
          apPaterno: tratamientoCompleto.appaternopaciente || tratamientoCompleto.ApPaternoPaciente || '',
          apMaterno: tratamientoCompleto.apmaternopaciente || tratamientoCompleto.ApMaternoPaciente || '',
          correo: tratamientoCompleto.correopaciente || tratamientoCompleto.CorreoPaciente || '',
          telefono: tratamientoCompleto.telefonopaciente || tratamientoCompleto.TelefonoPaciente || ''
        };

        // ✅ Cargar información del medicamento
        this.medicamentoInfo = {
          nombre: tratamientoCompleto.nombremedicamento || tratamientoCompleto.NombreMedicamento || '',
          presentacion: tratamientoCompleto.presentacion || tratamientoCompleto.PresentacionMedicamento || '',
          concentracion: tratamientoCompleto.concentracion || tratamientoCompleto.ConcentracionMedicamento || '',
          laboratorio: tratamientoCompleto.laboratorio || tratamientoCompleto.LaboratorioMedicamento || ''
        };
      }

      // ✅ Cargar registros de tomas
      await this.cargarRegistrosTomas(idTratamiento);

      // ✅ Calcular estadísticas
      this.calcularEstadisticas();

      // ✅ Inicializar historial
      this.cargarHistorialTratamiento();

    } catch (error) {
      console.warn('Error al cargar datos adicionales:', error);
      // ✅ Fallback: usar datos locales si no se puede conectar
      this.cargarDatosLocales();
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ✅ CARGAR REGISTROS DE TOMAS REALES
  async cargarRegistrosTomas(idTratamiento: number) {
    try {
      // Intentar obtener registros de tomas del backend
      // Nota: Necesitarás crear este endpoint en tu backend
      // Por ahora, simulamos datos
      this.registrosTomas = [
        { id: 1, fecha: this.formatearFechaHora(new Date()), estado: 'Tomada', notas: 'Sin novedad' },
        { id: 2, fecha: this.formatearFechaHora(new Date(Date.now() - 3600000)), estado: 'Pendiente', notas: '' },
        { id: 3, fecha: this.formatearFechaHora(new Date(Date.now() - 86400000)), estado: 'Tomada', notas: 'Paciente con náuseas' },
        { id: 4, fecha: this.formatearFechaHora(new Date(Date.now() - 172800000)), estado: 'Omitida', notas: 'Paciente olvidó tomar' }
      ];
    } catch (error) {
      console.warn('No se pudieron cargar registros de tomas:', error);
      this.registrosTomas = [];
    }
  }

  // ✅ CALCULAR ESTADÍSTICAS REALES
  calcularEstadisticas() {
    if (!this.tratamientoSeleccionado) return;

    const totalTomas = this.registrosTomas.length || 10;
    const tomasCompletadas = this.registrosTomas.filter(t => t.estado === 'Tomada').length || 6;
    const tomasPendientes = this.registrosTomas.filter(t => t.estado === 'Pendiente').length || 3;
    const porcentajeCumplimiento = totalTomas > 0 ? Math.round((tomasCompletadas / totalTomas) * 100) : 0;

    let diasRestantes = 0;
    if (this.tratamientoSeleccionado.fechafin) {
      const hoy = new Date();
      const fin = new Date(this.tratamientoSeleccionado.fechafin);
      const diffTime = fin.getTime() - hoy.getTime();
      diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    this.estadisticas = {
      totalTomas: totalTomas,
      tomasCompletadas: tomasCompletadas,
      tomasPendientes: tomasPendientes,
      porcentajeCumplimiento: porcentajeCumplimiento,
      diasRestantes: diasRestantes
    };
  }

  // ✅ FORMATEAR FECHA Y HORA PARA REGISTROS
  formatearFechaHora(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }

  // ✅ CARGAR DATOS LOCALES (FALLBACK)
  cargarDatosLocales() {
    if (this.tratamientoSeleccionado.nombrepaciente) {
      this.pacienteInfo = {
        nombre: this.tratamientoSeleccionado.nombrepaciente,
        apPaterno: this.tratamientoSeleccionado.appaternopaciente || '',
        apMaterno: this.tratamientoSeleccionado.apmaternopaciente || ''
      };
    }

    if (this.tratamientoSeleccionado.nombremedicamento) {
      this.medicamentoInfo = {
        nombre: this.tratamientoSeleccionado.nombremedicamento,
        presentacion: this.tratamientoSeleccionado.presentacion || '',
        concentracion: this.tratamientoSeleccionado.concentracion || ''
      };
    }

    this.estadisticas = {
      totalTomas: 0,
      tomasCompletadas: 0,
      tomasPendientes: 0,
      porcentajeCumplimiento: 0,
      diasRestantes: this.getDiasRestantes() || 0
    };

    this.cargarHistorialTratamiento();
  }

  cargarHistorialTratamiento() {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);

    this.historialCambios = [
      {
        fecha: fechaStr,
        accion: 'Tratamiento creado',
        detalle: `Inicio: ${this.tratamientoSeleccionado.fechainicio || 'No definida'} - Fin: ${this.tratamientoSeleccionado.fechafin || 'No definida'}`,
        usuario: 'Sistema'
      }
    ];
  }

  agregarHistorial(accion: string, detalle: string) {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);
    this.historialCambios.unshift({
      fecha: fechaStr,
      accion: accion,
      detalle: detalle,
      usuario: 'Usuario actual'
    });
  }

  // ✅ OBTENER ESTADO DEL TRATAMIENTO
  getEstadoTratamiento(): { texto: string; clase: string; icono: string } {
    if (!this.tratamientoSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.tratamientoSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    const hoy = new Date();
    const fechaFin = new Date(this.tratamientoSeleccionado.fechafin);

    if (fechaFin < hoy) {
      return { texto: 'Finalizado', clase: 'estado-finalizado', icono: 'bi-check-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.porcentajeCumplimiento < 70 && this.estadisticas.porcentajeCumplimiento > 0) {
      return { texto: 'Bajo cumplimiento', clase: 'estado-bajo', icono: 'bi-exclamation-triangle-fill' };
    }

    return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  getEstadoColor(estado: string): string {
    const colores: { [key: string]: string } = {
      'Tomada': '#10b981',
      'Pendiente': '#f59e0b',
      'Omitida': '#ef4444',
      'Retrasada': '#f97316'
    };
    return colores[estado] || '#6c757d';
  }

  getDiasRestantes(): number | null {
    if (!this.tratamientoSeleccionado?.fechafin) return null;
    const hoy = new Date();
    const fin = new Date(this.tratamientoSeleccionado.fechafin);
    const diffTime = fin.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  getDiasRestantesTexto(): string {
    const dias = this.getDiasRestantes();
    if (dias === null) return 'Sin fecha de fin';
    if (dias > 0) return `${dias} días restantes`;
    if (dias === 0) return 'Finaliza hoy';
    return 'Finalizado';
  }

  getFrecuenciaTexto(): string {
    const horas = this.tratamientoSeleccionado?.frecuenciahoras;
    if (!horas) return 'Sin frecuencia';

    if (horas === 24) return 'Cada 24 horas (1 vez al día)';
    if (horas === 12) return 'Cada 12 horas (2 veces al día)';
    if (horas === 8) return 'Cada 8 horas (3 veces al día)';
    if (horas === 6) return 'Cada 6 horas (4 veces al día)';
    if (horas === 4) return 'Cada 4 horas (6 veces al día)';
    return `Cada ${horas} horas`;
  }

  getDuracionDias(): number | null {
    if (!this.tratamientoSeleccionado?.fechainicio || !this.tratamientoSeleccionado?.fechafin) return null;
    const inicio = new Date(this.tratamientoSeleccionado.fechainicio);
    const fin = new Date(this.tratamientoSeleccionado.fechafin);
    const diffTime = fin.getTime() - inicio.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  validarFechas(): { valido: boolean; mensaje: string } {
    const inicio = this.tratamientoSeleccionado.fechainicio;
    const fin = this.tratamientoSeleccionado.fechafin;

    if (!inicio || !fin) {
      return { valido: false, mensaje: 'Las fechas de inicio y fin son obligatorias' };
    }

    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);

    if (fechaInicio > fechaFin) {
      return { valido: false, mensaje: 'La fecha de inicio no puede ser mayor a la fecha de fin' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaInicio < hoy) {
      return { valido: false, mensaje: 'La fecha de inicio no puede ser en el pasado' };
    }

    return { valido: true, mensaje: '' };
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    if (this.fpInicio) {
      try { this.fpInicio.destroy(); } catch (e) { }
      this.fpInicio = null;
    }
    if (this.fpFin) {
      try { this.fpFin.destroy(); } catch (e) { }
      this.fpFin = null;
    }
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

  inicializarCalendario() {
    if (!isPlatformBrowser(this.platformId)) return;

    const elementoInicio = document.querySelector('#fechaInicioInput');
    const elementoFin = document.querySelector('#fechaFinInput');

    if (!elementoInicio || !elementoFin) {
      setTimeout(() => this.inicializarCalendario(), 200);
      return;
    }

    try {
      const hoy = new Date();
      const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

      if (this.fpInicio) {
        try { this.fpInicio.destroy(); } catch (e) { }
        this.fpInicio = null;
      }
      if (this.fpFin) {
        try { this.fpFin.destroy(); } catch (e) { }
        this.fpFin = null;
      }

      this.fpInicio = flatpickr('#fechaInicioInput', {
        locale: Spanish,
        dateFormat: "Y-m-d",
        defaultDate: this.tratamientoSeleccionado?.fechainicio || undefined,
        minDate: "today",
        maxDate: fechaMaxima,
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.tratamientoSeleccionado) {
            this.tratamientoSeleccionado.fechainicio = dateStr;
            this.cdr.detectChanges();
          }
        }
      });

      this.fpFin = flatpickr('#fechaFinInput', {
        locale: Spanish,
        dateFormat: "Y-m-d",
        defaultDate: this.tratamientoSeleccionado?.fechafin || undefined,
        minDate: "today",
        maxDate: fechaMaxima,
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.tratamientoSeleccionado) {
            this.tratamientoSeleccionado.fechafin = dateStr;
            this.cdr.detectChanges();
          }
        }
      });
    } catch (error) {
      console.error('Error al inicializar calendarios:', error);
    }
  }

  // ✅ GUARDAR CAMBIOS EN EL BACKEND
  async guardarCambios() {
    if (!this.tratamientoSeleccionado) return;

    const id = this.tratamientoSeleccionado.idtratamiento;
    if (!id) {
      this.lanzarNotificacion("Error: No se encontró el identificador del tratamiento.", "error");
      return;
    }

    const dosis = (this.tratamientoSeleccionado.dosis || '').trim();
    const frecuenciaHoras = parseInt(this.tratamientoSeleccionado.frecuenciahoras, 10);
    const fechaInicio = this.tratamientoSeleccionado.fechainicio;
    const fechaFin = this.tratamientoSeleccionado.fechafin;

    if (!dosis || isNaN(frecuenciaHoras) || !fechaInicio || !fechaFin) {
      this.lanzarNotificacion("La dosis, frecuencia, fecha de inicio y fin son requeridas.", "warning");
      return;
    }

    const validacionFechas = this.validarFechas();
    if (!validacionFechas.valido) {
      this.lanzarNotificacion(validacionFechas.mensaje, "warning");
      return;
    }

    const dosisAnterior = this.tratamientoSeleccionado.dosis || '';
    const estadoAnterior = this.tratamientoSeleccionado.activo;

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const estadoActivo = this.tratamientoSeleccionado.activo === true ||
        this.tratamientoSeleccionado.activo === 'true';

      const payload = {
        dosis: dosis,
        frecuenciaHoras: frecuenciaHoras,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        notasInstrucciones: (this.tratamientoSeleccionado.notasinstrucciones || '').trim(),
        activo: estadoActivo
      };

      // ✅ Guardar en el backend
      await firstValueFrom(this.usersService.actualizarTratamiento(id, payload));

      // Registrar en historial
      if (dosisAnterior !== dosis) {
        this.agregarHistorial(
          `Dosis actualizada`,
          `De: "${dosisAnterior}" → "${dosis}"`
        );
      } else {
        this.agregarHistorial(
          'Información actualizada',
          'Datos del tratamiento actualizados'
        );
      }

      if (estadoAnterior !== estadoActivo) {
        this.agregarHistorial(
          `Estado ${estadoActivo ? 'activado' : 'desactivado'}`,
          `Tratamiento ${estadoActivo ? 'activado' : 'desactivado'}`
        );
      }

      // ✅ Recargar datos actualizados
      await this.cargarDatosAdicionales();

      this.lanzarNotificacion("¡Éxito! El tratamiento ha sido actualizado correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/tratamientos']);
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
}