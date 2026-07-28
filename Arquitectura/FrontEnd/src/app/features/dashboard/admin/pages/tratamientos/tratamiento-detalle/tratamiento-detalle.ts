import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// Importar los partials
import { InfoTratamiento } from './partials/info-tratamiento/info-tratamiento';
import { RegistroTomas } from './partials/registro-tomas/registro-tomas';
import { HistorialTratamiento, HistorialCambio } from './partials/historial-tratamiento/historial-tratamiento';

interface RegistroToma {
  id: number;
  idTratamiento: number;
  fechaProgramada: string;
  fechaRealizada?: string;
  estado: 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada' | 'Eliminada';
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
  imports: [
    CommonModule,
    FormsModule,
    Menu,
    InfoTratamiento,
    RegistroTomas,
    HistorialTratamiento
  ],
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

  // Notificaciones Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // Historial de cambios
  historialCambios: HistorialCambio[] = [];

  // Registros de tomas
  registrosTomas: RegistroToma[] = [];
  generandoTomas = false;
  eliminandoTomas = false;

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
    } else {
      this.router.navigate(['/admin/tratamientos']);
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
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

      const tratamientoCompleto = await firstValueFrom(
        this.usersService.getTratamientoById(idTratamiento)
      );

      if (tratamientoCompleto) {
        this.tratamientoSeleccionado = { ...this.tratamientoSeleccionado, ...tratamientoCompleto };
        this.inicializarCampos();

        this.pacienteInfo = {
          nombre: tratamientoCompleto.nombrepaciente || tratamientoCompleto.NombrePaciente || '',
          apPaterno: tratamientoCompleto.appaternopaciente || tratamientoCompleto.ApPaternoPaciente || '',
          apMaterno: tratamientoCompleto.apmaternopaciente || tratamientoCompleto.ApMaternoPaciente || '',
          correo: tratamientoCompleto.correopaciente || tratamientoCompleto.CorreoPaciente || '',
          telefono: tratamientoCompleto.telefonopaciente || tratamientoCompleto.TelefonoPaciente || ''
        };

        this.medicamentoInfo = {
          nombre: tratamientoCompleto.nombremedicamento || tratamientoCompleto.NombreMedicamento || '',
          presentacion: tratamientoCompleto.presentacion || tratamientoCompleto.PresentacionMedicamento || '',
          concentracion: tratamientoCompleto.concentracion || tratamientoCompleto.ConcentracionMedicamento || '',
          laboratorio: tratamientoCompleto.laboratorio || tratamientoCompleto.LaboratorioMedicamento || ''
        };
      }

      await this.cargarRegistrosTomas(idTratamiento);
      this.calcularEstadisticas();
      this.cargarHistorialTratamiento();

    } catch (error) {
      console.warn('Error al cargar datos adicionales:', error);
      this.cargarDatosLocales();
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // --- CARGAR REGISTROS DE TOMAS ---
  async cargarRegistrosTomas(idTratamiento: number) {
    try {
      const tomas = await firstValueFrom(
        this.usersService.getTomasByTratamiento(idTratamiento)
      );

      if (tomas && tomas.length > 0) {
        this.registrosTomas = tomas.map((t: any) => {
          const fechaProgramada = t.fechaProgramada || t.FechaHoraProgramada;
          const { fecha, hora } = this.formatearFechaYHora(fechaProgramada);

          // Asegurar que el estado sea válido, incluyendo 'Eliminada'
          const estadosValidos = ['Pendiente', 'Tomada', 'Omitida', 'Retrasada', 'Eliminada'];
          const estado = estadosValidos.includes(t.estado) ? t.estado : 'Pendiente';

          return {
            id: t.id || t.IdTomar,
            idTratamiento: t.idTratamiento || t.IdTratamiento,
            fechaProgramada: fechaProgramada,
            fechaRealizada: t.fechaRealizada || t.FechaHoraRealizada,
            estado: estado,
            notas: t.notas || t.NotasTomas || '',
            idAcompanante: t.idAcompanante || t.IdAcompananteQueRegistro,
            nombreAcompanante: t.nombreAcompanante || '',
            fechaFormateada: fecha,
            horaFormateada: hora
          };
        });

        this.registrosTomas.sort((a, b) => {
          return new Date(b.fechaProgramada).getTime() - new Date(a.fechaProgramada).getTime();
        });
      } else {
        this.registrosTomas = [];
      }

      this.cdr.detectChanges();

    } catch (error) {
      console.warn('No se pudieron cargar registros de tomas:', error);
      this.registrosTomas = [];
    }
  }

  formatearFechaYHora(fechaStr: string): { fecha: string, hora: string } {
    if (!fechaStr) return { fecha: 'Fecha no disponible', hora: 'Hora no disponible' };

    try {
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return { fecha: fechaStr, hora: '' };

      const dia = String(fecha.getDate()).padStart(2, '0');
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const anio = fecha.getFullYear();
      const fechaFormateada = `${dia}/${mes}/${anio}`;

      const horas = String(fecha.getHours()).padStart(2, '0');
      const minutos = String(fecha.getMinutes()).padStart(2, '0');
      const horaFormateada = `${horas}:${minutos}`;

      return { fecha: fechaFormateada, hora: horaFormateada };
    } catch (error) {
      return { fecha: fechaStr, hora: '' };
    }
  }

  // --- CALCULAR TOMAS ESTIMADAS ---
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

      const diffMs = fin.getTime() - inicio.getTime();
      const diffHoras = diffMs / (1000 * 60 * 60);
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

    // Filtrar tomas eliminadas para las estadísticas
    const tomasActivas = this.registrosTomas.filter(t => t.estado !== 'Eliminada');

    if (tomasActivas && tomasActivas.length > 0) {
      const totalTomas = tomasActivas.length;
      const tomasCompletadas = tomasActivas.filter(t => t.estado === 'Tomada').length;
      const tomasPendientes = tomasActivas.filter(t => t.estado === 'Pendiente').length;
      const tomasOmitidas = tomasActivas.filter(t => t.estado === 'Omitida').length;
      const tomasRetrasadas = tomasActivas.filter(t => t.estado === 'Retrasada').length;

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
    } else {
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
    }
  }

  // --- CARGAR DATOS LOCALES (FALLBACK) ---
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

    this.cargarHistorialTratamiento();
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

      if (dosisAnterior !== dosis) {
        this.agregarHistorial(`Dosis actualizada`, `De: "${dosisAnterior}" → "${dosis}"`);
      }

      if (frecuenciaAnterior !== frecuenciaHoras) {
        this.agregarHistorial(`Frecuencia actualizada`, `De: ${frecuenciaAnterior} horas → ${frecuenciaHoras} horas`);
      }

      if (estadoAnterior !== estadoActivo) {
        this.agregarHistorial(`Tratamiento ${estadoActivo ? 'activado' : 'desactivado'}`,
          `El tratamiento fue ${estadoActivo ? 'activado' : 'desactivado'}`);
      }

      if (dosisAnterior === dosis && estadoAnterior === estadoActivo && frecuenciaAnterior === frecuenciaHoras) {
        this.agregarHistorial('Información actualizada', 'Datos del tratamiento actualizados');
      }

      await this.cargarDatosAdicionales();

      this.lanzarNotificacion("¡Éxito! El tratamiento ha sido actualizado correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/admin/tratamientos']);
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

  // --- GENERAR TOMAS ---
  async generarTomas() {
    if (!this.tratamientoSeleccionado) return;

    const idTratamiento = this.tratamientoSeleccionado.idtratamiento;
    const fechaInicio = this.tratamientoSeleccionado.fechainicio;
    const fechaFin = this.tratamientoSeleccionado.fechafin;
    const frecuenciaHoras = this.tratamientoSeleccionado.frecuenciahoras;

    if (!fechaInicio || !fechaFin || !frecuenciaHoras) {
      this.lanzarNotificacion('Faltan datos para generar las tomas.', 'warning');
      return;
    }

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

      this.lanzarNotificacion(`¡${response.totalGeneradas} tomas generadas exitosamente!`, 'success');

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

  // --- ACTUALIZAR ESTADO DE TOMA ---
  async actualizarEstadoToma(event: { id: number; estado: string }) {
    try {
      const fechaRealizada = event.estado === 'Tomada' ? new Date().toISOString() : undefined;

      await firstValueFrom(
        this.usersService.actualizarEstadoToma(event.id, event.estado, fechaRealizada)
      );

      const estadoTexto = {
        'Tomada': 'completada',
        'Pendiente': 'pendiente',
        'Omitida': 'omitida',
        'Retrasada': 'retrasada'
      }[event.estado] || event.estado;

      this.lanzarNotificacion(`Toma marcada como ${estadoTexto}.`, 'success');

      await this.cargarRegistrosTomas(this.tratamientoSeleccionado.idtratamiento);
      this.calcularEstadisticas();
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Error al actualizar estado:', error);
      this.lanzarNotificacion('Error al actualizar el estado de la toma.', 'error');
    }
  }

  // --- ELIMINAR UNA TOMA INDIVIDUAL ---
  async eliminarToma(id: number) {
    if (!this.tratamientoSeleccionado) {
      this.lanzarNotificacion('No hay tratamiento seleccionado.', 'warning');
      return;
    }

    try {
      console.log(`[Frontend] Eliminando toma ID: ${id}`);

      await firstValueFrom(this.usersService.eliminarToma(id));

      this.lanzarNotificacion('Toma eliminada correctamente.', 'success');

      // Recargar las tomas
      await this.cargarRegistrosTomas(this.tratamientoSeleccionado.idtratamiento);
      this.calcularEstadisticas();
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Error al eliminar toma:', error);
      this.lanzarNotificacion('Error al eliminar la toma.', 'error');
    }
  }

  // --- ELIMINAR TODAS LAS TOMAS ---
  async eliminarTodasTomas() {
    if (!this.tratamientoSeleccionado) {
      this.lanzarNotificacion('No hay tratamiento seleccionado.', 'warning');
      return;
    }

    const idTratamiento = this.tratamientoSeleccionado.idtratamiento;

    if (!idTratamiento) {
      this.lanzarNotificacion('ID de tratamiento no válido.', 'error');
      return;
    }

    this.eliminandoTomas = true;
    this.cdr.detectChanges();

    try {
      console.log(`[Frontend] Eliminando todas las tomas del tratamiento ID: ${idTratamiento}`);

      await firstValueFrom(this.usersService.eliminarTodasTomas(idTratamiento));

      this.lanzarNotificacion('Todas las tomas han sido eliminadas correctamente.', 'success');

      // Recargar las tomas
      await this.cargarRegistrosTomas(idTratamiento);
      this.calcularEstadisticas();
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Error al eliminar todas las tomas:', error);

      let mensajeError = 'Error al eliminar todas las tomas.';
      if (error.error?.error) {
        mensajeError = error.error.error;
      } else if (error.status === 400) {
        mensajeError = 'Error en la solicitud. Verifica los datos.';
      } else if (error.status === 403) {
        mensajeError = 'No tienes permisos para realizar esta acción.';
      } else if (error.status === 404) {
        mensajeError = 'No se encontraron tomas para eliminar.';
      }

      this.lanzarNotificacion(mensajeError, 'error');
    } finally {
      this.eliminandoTomas = false;
      this.cdr.detectChanges();
    }
  }

  // --- CAMBIAR PESTAÑA ---
  cambiarTab(tab: TabTratamiento) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    if (tab === 'registro-tomas') {
      this.cargarRegistrosTomas(this.tratamientoSeleccionado?.idtratamiento);
    }

    this.cdr.detectChanges();
  }

  // --- VOLVER ---
  volver() {
    this.location.back();
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

  // --- GETTERS PARA EL TEMPLATE ---
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
}