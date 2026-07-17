// TRATAMIENTO-DETALLE.COMPONENT.TS
import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../../core/services/users.service';
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
  idTratamiento: number;
  fechaProgramada: string;
  fechaRealizada?: string;
  estado: 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada';
  notas?: string;
  idAcompanante?: number;
  nombreAcompanante?: string;
  fechaFormateada?: string;
  horaFormateada?: string;
}

type TabTratamiento = 'detalle' | 'historial' | 'registro-tomas';

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

  // Pestaña activa
  activeTab: TabTratamiento = 'detalle';

  private fpInicio: any = null;
  private fpFin: any = null;

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // Modal de confirmación
  mostrarModalConfirmacion = false;
  modalConfirmacionMensaje = '';
  modalConfirmacionAccion: (() => void) | null = null;

  // Historial de cambios
  historialCambios: HistorialTratamiento[] = [];
  mostrarHistorial = false;

  // Registros de tomas
  registrosTomas: RegistroToma[] = [];
  mostrarTomas = false;

  // Estadísticas
  estadisticas: {
    totalTomas: number;
    tomasCompletadas: number;
    tomasPendientes: number;
    porcentajeCumplimiento: number;
    diasRestantes: number;
    tomasOmitidas: number;
    tomasRetrasadas: number;
  } | null = null;

  // Información relacionada
  pacienteInfo: any = null;
  medicamentoInfo: any = null;

  cargando = false;
  generandoTomas = false;
  tomasYaGeneradas = false;

  // Frecuencia texto cache
  private frecuenciaTextoCache: string = '';

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

  // --- CONTROL DE PESTAÑAS ---
  cambiarTab(tab: TabTratamiento) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    // Si cambiamos a la pestaña de registro de tomas, recargar datos
    if (tab === 'registro-tomas') {
      this.cargarRegistrosTomas(this.tratamientoSeleccionado?.idtratamiento);
    }

    this.cdr.detectChanges();
  }

  // --- INICIALIZAR CAMPOS ---
  inicializarCampos() {
    if (!this.tratamientoSeleccionado) return;

    const t = this.tratamientoSeleccionado;

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

  // --- CARGAR DATOS ADICIONALES ---
  async cargarDatosAdicionales() {
    if (!this.tratamientoSeleccionado) return;

    this.cargando = true;

    try {
      const idTratamiento = this.tratamientoSeleccionado.idtratamiento;

      // ✅ Obtener tratamiento completo
      const tratamientoCompleto = await firstValueFrom(
        this.usersService.getTratamientoById(idTratamiento)
      );

      if (tratamientoCompleto) {
        this.tratamientoSeleccionado = { ...this.tratamientoSeleccionado, ...tratamientoCompleto };
        this.inicializarCampos();

        // ✅ Información del paciente
        this.pacienteInfo = {
          nombre: tratamientoCompleto.nombrepaciente || tratamientoCompleto.NombrePaciente || '',
          apPaterno: tratamientoCompleto.appaternopaciente || tratamientoCompleto.ApPaternoPaciente || '',
          apMaterno: tratamientoCompleto.apmaternopaciente || tratamientoCompleto.ApMaternoPaciente || '',
          correo: tratamientoCompleto.correopaciente || tratamientoCompleto.CorreoPaciente || '',
          telefono: tratamientoCompleto.telefonopaciente || tratamientoCompleto.TelefonoPaciente || ''
        };

        // ✅ Información del medicamento
        this.medicamentoInfo = {
          nombre: tratamientoCompleto.nombremedicamento || tratamientoCompleto.NombreMedicamento || '',
          presentacion: tratamientoCompleto.presentacion || tratamientoCompleto.PresentacionMedicamento || '',
          concentracion: tratamientoCompleto.concentracion || tratamientoCompleto.ConcentracionMedicamento || '',
          laboratorio: tratamientoCompleto.laboratorio || tratamientoCompleto.LaboratorioMedicamento || ''
        };
      }

      // ✅ Cargar registros de tomas desde el backend
      await this.cargarRegistrosTomas(idTratamiento);

      // ✅ Calcular estadísticas
      this.calcularEstadisticas();

      // ✅ Cargar historial
      this.cargarHistorialTratamiento();

    } catch (error) {
      console.warn('Error al cargar datos adicionales:', error);
      this.cargarDatosLocales();
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // --- CARGAR REGISTROS DE TOMAS DESDE EL BACKEND ---
  async cargarRegistrosTomas(idTratamiento: number) {
    try {
      // ✅ Obtener tomas del backend
      const tomas = await firstValueFrom(
        this.usersService.getTomasByTratamiento(idTratamiento)
      );

      if (tomas && tomas.length > 0) {
        // Mapear datos del backend al formato del frontend
        this.registrosTomas = tomas.map((t: any) => {
          const fechaProgramada = t.fechaProgramada || t.FechaHoraProgramada;
          const fechaRealizada = t.fechaRealizada || t.FechaHoraRealizada;

          // Formatear fecha y hora separadamente
          const { fecha, hora } = this.formatearFechaYHora(fechaProgramada);

          return {
            id: t.id || t.IdTomar,
            idTratamiento: t.idTratamiento || t.IdTratamiento,
            fechaProgramada: fechaProgramada,
            fechaRealizada: fechaRealizada,
            estado: t.estado || t.EstadoTomar || 'Pendiente',
            notas: t.notas || t.NotasTomas || '',
            idAcompanante: t.idAcompanante || t.IdAcompananteQueRegistro,
            nombreAcompanante: t.nombreAcompanante || '',
            fechaFormateada: fecha,
            horaFormateada: hora
          };
        });

        // Ordenar por fecha (más reciente primero)
        this.registrosTomas.sort((a, b) => {
          return new Date(b.fechaProgramada).getTime() - new Date(a.fechaProgramada).getTime();
        });

        this.tomasYaGeneradas = true;
      } else {
        this.registrosTomas = [];
        this.tomasYaGeneradas = false;
      }

      this.cdr.detectChanges();

    } catch (error) {
      console.warn('No se pudieron cargar registros de tomas:', error);
      this.registrosTomas = [];
      this.tomasYaGeneradas = false;
    }
  }

  // --- FORMATEAR FECHA Y HORA SEPARADAMENTE ---
  formatearFechaYHora(fechaStr: string): { fecha: string, hora: string } {
    if (!fechaStr) return { fecha: 'Fecha no disponible', hora: 'Hora no disponible' };

    try {
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return { fecha: fechaStr, hora: '' };

      // Formato fecha: dd/MM/yyyy
      const dia = String(fecha.getDate()).padStart(2, '0');
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const anio = fecha.getFullYear();
      const fechaFormateada = `${dia}/${mes}/${anio}`;

      // Formato hora: HH:MM (formato 24h)
      const horas = String(fecha.getHours()).padStart(2, '0');
      const minutos = String(fecha.getMinutes()).padStart(2, '0');
      const horaFormateada = `${horas}:${minutos}`;

      return { fecha: fechaFormateada, hora: horaFormateada };
    } catch (error) {
      return { fecha: fechaStr, hora: '' };
    }
  }

  // --- CALCULAR TOMAS ESTIMADAS BASADO EN FRECUENCIA Y FECHAS ---
  calcularTomasEstimadas(): number {
    if (!this.tratamientoSeleccionado) return 0;

    const fechaInicio = this.tratamientoSeleccionado.fechainicio;
    const fechaFin = this.tratamientoSeleccionado.fechafin;
    const frecuenciaHoras = parseInt(this.tratamientoSeleccionado.frecuenciahoras) || 8;

    if (!fechaInicio || !fechaFin || !frecuenciaHoras) return 0;

    try {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);

      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 0;

      // Calcular diferencia en horas
      const diffMs = fin.getTime() - inicio.getTime();
      const diffHoras = diffMs / (1000 * 60 * 60);

      // Calcular número de tomas basado en la frecuencia
      const tomas = Math.ceil(diffHoras / frecuenciaHoras);

      return tomas > 0 ? tomas : 0;
    } catch (error) {
      console.warn('Error calculando tomas estimadas:', error);
      return 0;
    }
  }

  // --- CALCULAR ESTADÍSTICAS ---
  calcularEstadisticas() {
    if (!this.tratamientoSeleccionado) return;

    // Si hay tomas registradas, usar los datos reales
    if (this.registrosTomas && this.registrosTomas.length > 0) {
      const totalTomas = this.registrosTomas.length;
      const tomasCompletadas = this.registrosTomas.filter(t => t.estado === 'Tomada').length;
      const tomasPendientes = this.registrosTomas.filter(t => t.estado === 'Pendiente').length;
      const tomasOmitidas = this.registrosTomas.filter(t => t.estado === 'Omitida').length;
      const tomasRetrasadas = this.registrosTomas.filter(t => t.estado === 'Retrasada').length;

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
        tomasOmitidas: tomasOmitidas,
        tomasRetrasadas: tomasRetrasadas,
        porcentajeCumplimiento: porcentajeCumplimiento,
        diasRestantes: diasRestantes
      };

      this.tomasYaGeneradas = true;
    } else {
      // Si no hay tomas registradas, calcular tomas estimadas
      const totalTomas = this.calcularTomasEstimadas();

      let diasRestantes = 0;
      if (this.tratamientoSeleccionado.fechafin) {
        const hoy = new Date();
        const fin = new Date(this.tratamientoSeleccionado.fechafin);
        const diffTime = fin.getTime() - hoy.getTime();
        diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      this.estadisticas = {
        totalTomas: totalTomas,
        tomasCompletadas: 0,
        tomasPendientes: totalTomas,
        tomasOmitidas: 0,
        tomasRetrasadas: 0,
        porcentajeCumplimiento: 0,
        diasRestantes: diasRestantes
      };

      this.tomasYaGeneradas = false;
    }
  }

  // --- CARGAR DATOS LOCALES (FALLBACK) ---
  cargarDatosLocales() {
    // Paciente info
    if (this.tratamientoSeleccionado.nombrepaciente) {
      this.pacienteInfo = {
        nombre: this.tratamientoSeleccionado.nombrepaciente,
        apPaterno: this.tratamientoSeleccionado.appaternopaciente || '',
        apMaterno: this.tratamientoSeleccionado.apmaternopaciente || ''
      };
    }

    // Medicamento info
    if (this.tratamientoSeleccionado.nombremedicamento) {
      this.medicamentoInfo = {
        nombre: this.tratamientoSeleccionado.nombremedicamento,
        presentacion: this.tratamientoSeleccionado.presentacion || '',
        concentracion: this.tratamientoSeleccionado.concentracion || ''
      };
    }

    // Calcular tomas estimadas
    const totalTomas = this.calcularTomasEstimadas();

    let diasRestantes = 0;
    if (this.tratamientoSeleccionado.fechafin) {
      const hoy = new Date();
      const fin = new Date(this.tratamientoSeleccionado.fechafin);
      const diffTime = fin.getTime() - hoy.getTime();
      diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    this.estadisticas = {
      totalTomas: totalTomas,
      tomasCompletadas: 0,
      tomasPendientes: totalTomas,
      tomasOmitidas: 0,
      tomasRetrasadas: 0,
      porcentajeCumplimiento: 0,
      diasRestantes: diasRestantes
    };

    this.tomasYaGeneradas = false;
    this.cargarHistorialTratamiento();
  }

  // --- MODAL DE CONFIRMACIÓN ---
  mostrarModal(mensaje: string, accion: () => void) {
    this.modalConfirmacionMensaje = mensaje;
    this.modalConfirmacionAccion = accion;
    this.mostrarModalConfirmacion = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModalConfirmacion = false;
    this.modalConfirmacionAccion = null;
    this.cdr.detectChanges();
  }

  confirmarModal() {
    if (this.modalConfirmacionAccion) {
      this.modalConfirmacionAccion();
    }
    this.cerrarModal();
  }

  // --- GENERAR TOMAS PROGRAMADAS ---
  async generarTomasProgramadas() {
    // Verificar si ya hay tomas generadas
    if (this.tomasYaGeneradas) {
      this.lanzarNotificacion('Ya existen tomas generadas para este tratamiento.', 'warning');
      return;
    }

    if (!this.tratamientoSeleccionado) return;

    const idTratamiento = this.tratamientoSeleccionado.idtratamiento;
    const fechaInicio = this.tratamientoSeleccionado.fechainicio;
    const fechaFin = this.tratamientoSeleccionado.fechafin;
    const frecuenciaHoras = this.tratamientoSeleccionado.frecuenciahoras;

    if (!fechaInicio || !fechaFin || !frecuenciaHoras) {
      this.lanzarNotificacion('Faltan datos para generar las tomas.', 'warning');
      return;
    }

    // Calcular tomas estimadas para mostrar en el modal
    const tomasEstimadas = this.calcularTomasEstimadas();

    // Mostrar modal personalizado
    this.mostrarModal(
      `¿Generar ${tomasEstimadas} tomas programadas para este tratamiento?`,
      async () => {
        await this.ejecutarGeneracionTomas();
      }
    );
  }

  async ejecutarGeneracionTomas() {
    if (!this.tratamientoSeleccionado) return;

    const idTratamiento = this.tratamientoSeleccionado.idtratamiento;
    const fechaInicio = this.tratamientoSeleccionado.fechainicio;
    const fechaFin = this.tratamientoSeleccionado.fechafin;
    const frecuenciaHoras = this.tratamientoSeleccionado.frecuenciahoras;

    this.generandoTomas = true;
    this.cdr.detectChanges();

    try {
      const response = await firstValueFrom(
        this.usersService.generarTomasProgramadas({
          idTratamiento: idTratamiento,
          fechaInicio: fechaInicio,
          fechaFin: fechaFin,
          frecuenciaHoras: frecuenciaHoras
        })
      );

      this.lanzarNotificacion(
        `¡${response.totalGeneradas} tomas generadas exitosamente!`,
        'success'
      );

      // Recargar tomas
      await this.cargarRegistrosTomas(idTratamiento);
      this.calcularEstadisticas();
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Error al generar tomas:', error);
      this.lanzarNotificacion('Error al generar las tomas programadas.', 'error');
    } finally {
      this.generandoTomas = false;
      this.cdr.detectChanges();
    }
  }

  // --- VERIFICAR SI EL BOTÓN DE GENERAR TOMAS DEBE ESTAR DESHABILITADO ---
  isGenerarTomasDisabled(): boolean {
    return this.tomasYaGeneradas || this.generandoTomas || !this.tratamientoSeleccionado;
  }

  // --- ACTUALIZAR ESTADO DE UNA TOMA ---
  async actualizarEstadoToma(id: number, estado: string, notas?: string) {
    try {
      const fechaRealizada = estado === 'Tomada' ? new Date().toISOString() : undefined;

      const response = await firstValueFrom(
        this.usersService.actualizarEstadoToma(id, estado, fechaRealizada, notas)
      );

      const estadoTexto = {
        'Tomada': 'completada',
        'Pendiente': 'pendiente',
        'Omitida': 'omitida',
        'Retrasada': 'retrasada'
      }[estado] || estado;

      this.lanzarNotificacion(`Toma marcada como ${estadoTexto}.`, 'success');

      // Recargar tomas
      await this.cargarRegistrosTomas(this.tratamientoSeleccionado.idtratamiento);
      this.calcularEstadisticas();
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Error al actualizar estado:', error);
      this.lanzarNotificacion('Error al actualizar el estado de la toma.', 'error');
    }
  }

  // --- CARGAR HISTORIAL ---
  cargarHistorialTratamiento() {
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
        accion: 'Tratamiento creado',
        detalle: `Inicio: ${this.tratamientoSeleccionado.fechainicio || 'No definida'} - Fin: ${this.tratamientoSeleccionado.fechafin || 'No definida'}`,
        usuario: 'Sistema'
      }
    ];

    // Agregar eventos de tomas al historial
    this.registrosTomas.forEach(toma => {
      if (toma.estado === 'Tomada' && toma.fechaRealizada) {
        const { fecha, hora } = this.formatearFechaYHora(toma.fechaRealizada);
        this.historialCambios.push({
          fecha: `${fecha} ${hora}`,
          accion: 'Toma completada',
          detalle: `Toma del tratamiento ${this.tratamientoSeleccionado.nombremedicamento || ''}`,
          usuario: 'Paciente'
        });
      }
    });

    // Ordenar por fecha
    this.historialCambios.sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      return fechaB.getTime() - fechaA.getTime();
    });
  }

  // --- AGREGAR AL HISTORIAL ---
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

  // --- CONTADORES PARA ESTADÍSTICAS DEL HISTORIAL ---
  contarCambiosDosis(): number {
    return this.historialCambios.filter(h => h.accion.includes('Dosis')).length;
  }

  contarCambiosEstado(): number {
    return this.historialCambios.filter(h =>
      h.accion.includes('activado') ||
      h.accion.includes('desactivado')
    ).length;
  }

  // --- ESTADO DEL TRATAMIENTO ---
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

  getEstadoTratamientoColor(): string {
    const estado = this.getEstadoTratamiento();
    const colores: { [key: string]: string } = {
      'Activo': '#10b981',
      'Inactivo': '#ef4444',
      'Finalizado': '#3b82f6',
      'Bajo cumplimiento': '#f59e0b',
      'Sin datos': '#6c757d'
    };
    return colores[estado.texto] || '#6c757d';
  }

  // --- COLORES PARA TOMAS ---
  getEstadoColor(estado: string): string {
    const colores: { [key: string]: string } = {
      'Tomada': '#10b981',
      'Pendiente': '#f59e0b',
      'Omitida': '#ef4444',
      'Retrasada': '#f97316'
    };
    return colores[estado] || '#6c757d';
  }

  getEstadoIcono(estado: string): string {
    const iconos: { [key: string]: string } = {
      'Tomada': 'bi-check-circle-fill',
      'Pendiente': 'bi-clock-fill',
      'Omitida': 'bi-x-circle-fill',
      'Retrasada': 'bi-exclamation-triangle-fill'
    };
    return iconos[estado] || 'bi-question-circle';
  }

  // --- CÁLCULOS DE FECHAS ---
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

  // --- VALIDAR FECHAS ---
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

  // --- GUARDAR CAMBIOS ---
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
    const frecuenciaAnterior = this.tratamientoSeleccionado.frecuenciahoras;

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

      await firstValueFrom(this.usersService.actualizarTratamiento(id, payload));

      // Registrar cambios en historial
      if (dosisAnterior !== dosis) {
        this.agregarHistorial(
          `Dosis actualizada`,
          `De: "${dosisAnterior}" → "${dosis}"`
        );
      }

      if (frecuenciaAnterior !== frecuenciaHoras) {
        this.agregarHistorial(
          `Frecuencia actualizada`,
          `De: ${frecuenciaAnterior} horas → ${frecuenciaHoras} horas`
        );
      }

      if (estadoAnterior !== estadoActivo) {
        this.agregarHistorial(
          `Tratamiento ${estadoActivo ? 'activado' : 'desactivado'}`,
          `El tratamiento fue ${estadoActivo ? 'activado' : 'desactivado'}`
        );
      }

      if (dosisAnterior === dosis && estadoAnterior === estadoActivo && frecuenciaAnterior === frecuenciaHoras) {
        this.agregarHistorial(
          'Información actualizada',
          'Datos del tratamiento actualizados'
        );
      }

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

  // --- CALENDARIOS ---
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

  // --- OBTENER ESTADÍSTICAS PARA MOSTRAR EN REGISTRO DE TOMAS ---
  getEstadisticasParaRegistro() {
    return this.estadisticas;
  }

  volver() {
    this.location.back();
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
}