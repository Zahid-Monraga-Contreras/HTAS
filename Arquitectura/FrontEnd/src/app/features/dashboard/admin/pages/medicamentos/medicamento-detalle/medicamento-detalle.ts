import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

interface HistorialMedicamento {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

interface TratamientoAsociado {
  id: number;
  paciente: string;
  nombre: string;
  apPaterno: string;
  apMaterno: string;
  idPaciente: number;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  dosis: string;
  idMedicamento: number;
}

type TabMedicamento = 'detalle' | 'historial';

@Component({
  selector: 'app-medicamento-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './medicamento-detalle.html',
  styleUrls: ['./medicamento-detalle.css']
})
export class MedicamentoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  medicamentoSeleccionado: any = null;
  isSaving = false;

  // Pestaña activa
  activeTab: TabMedicamento = 'detalle';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  historialCambios: HistorialMedicamento[] = [];

  estadisticas: {
    totalTratamientos: number;
    tratamientosActivos: number;
    ultimoUso: string | null;
    pacientesActivos: number;
  } | null = null;

  tratamientosAsociados: TratamientoAsociado[] = [];

  cargandoEstadisticas = false;
  cargandoTratamientos = false;

  ngOnInit() {
    let state: any = null;
    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    if (state && state.medicamento) {
      const m = state.medicamento;

      this.medicamentoSeleccionado = {
        idmedicamento: m.IdMedicamento || m.idmedicamento || m.id,
        nombrecomercial: m.NombreComercial || m.nombrecomercial || m.nombre || '',
        sustanciaactiva: m.SustanciaActiva || m.sustanciaactiva || '',
        presentacion: m.Presentacion || m.presentacion || '',
        concentracion: m.Concentracion || m.concentracion || '',
        laboratorio: m.Laboratorio || m.laboratorio || '',
        indicacionesgenerales: m.IndicacionesGenerales || m.indicacionesgenerales || ''
      };

      this.inicializarCampos();

      const idMedicamento = this.medicamentoSeleccionado.idmedicamento;
      if (idMedicamento) {
        this.cargarEstadisticasReales(idMedicamento);
        this.cargarTratamientosReales(idMedicamento);
      }

      this.inicializarHistorial();

    } else {
      this.router.navigate(['/medicamentos']);
    }
  }

  // --- CONTROL DE PESTAÑAS ---
  cambiarTab(tab: TabMedicamento) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    // Si cambiamos a la pestaña de historial, refrescar estadísticas y tratamientos
    if (tab === 'historial') {
      const idMedicamento = this.medicamentoSeleccionado?.idmedicamento;
      if (idMedicamento) {
        this.cargarEstadisticasReales(idMedicamento);
        this.cargarTratamientosReales(idMedicamento);
      }
    }

    this.cdr.detectChanges();
  }

  inicializarCampos() {
    if (!this.medicamentoSeleccionado) return;
    if (!this.medicamentoSeleccionado.sustanciaactiva) {
      this.medicamentoSeleccionado.sustanciaactiva = '';
    }
    if (!this.medicamentoSeleccionado.concentracion) {
      this.medicamentoSeleccionado.concentracion = '';
    }
    if (!this.medicamentoSeleccionado.laboratorio) {
      this.medicamentoSeleccionado.laboratorio = '';
    }
    if (!this.medicamentoSeleccionado.indicacionesgenerales) {
      this.medicamentoSeleccionado.indicacionesgenerales = '';
    }
  }

  // --- CARGAR ESTADÍSTICAS REALES ---
  async cargarEstadisticasReales(idMedicamento: number) {
    if (!idMedicamento) return;

    this.cargandoEstadisticas = true;

    try {
      const response = await firstValueFrom(
        this.usersService.getEstadisticasMedicamento(idMedicamento)
      );

      if (response) {
        this.estadisticas = {
          totalTratamientos: response.totalTratamientos || 0,
          tratamientosActivos: response.tratamientosActivos || 0,
          ultimoUso: response.ultimoUso || null,
          pacientesActivos: response.pacientesActivos || 0
        };
      } else {
        this.estadisticas = {
          totalTratamientos: 0,
          tratamientosActivos: 0,
          ultimoUso: null,
          pacientesActivos: 0
        };
      }

    } catch (error) {
      console.warn('No se pudieron cargar estadísticas reales:', error);
      if (this.tratamientosAsociados.length > 0) {
        this.calcularEstadisticasDesdeTratamientos();
      } else {
        this.estadisticas = {
          totalTratamientos: 0,
          tratamientosActivos: 0,
          ultimoUso: null,
          pacientesActivos: 0
        };
      }
    } finally {
      this.cargandoEstadisticas = false;
      this.cdr.detectChanges();
    }
  }

  calcularEstadisticasDesdeTratamientos() {
    const activos = this.tratamientosAsociados.filter(t => t.activo);
    const pacientes = new Set(this.tratamientosAsociados.map(t => t.idPaciente));

    this.estadisticas = {
      totalTratamientos: this.tratamientosAsociados.length,
      tratamientosActivos: activos.length,
      ultimoUso: this.tratamientosAsociados.length > 0
        ? this.tratamientosAsociados[0].fechaInicio
        : null,
      pacientesActivos: pacientes.size
    };
  }

  // --- CARGAR TRATAMIENTOS ASOCIADOS REALES ---
  async cargarTratamientosReales(idMedicamento: number) {
    if (!idMedicamento) return;

    this.cargandoTratamientos = true;

    try {
      const response = await firstValueFrom(
        this.usersService.getTratamientos()
      );

      const tratamientosFiltrados = response.filter((t: any) =>
        t.idmedicamento === idMedicamento ||
        t.IdMedicamento === idMedicamento ||
        t.idMedicamento === idMedicamento
      );

      if (tratamientosFiltrados && tratamientosFiltrados.length > 0) {
        this.tratamientosAsociados = tratamientosFiltrados.map((t: any) => ({
          id: t.idtratamiento || t.IdTratamiento || t.id || 0,
          paciente: this.getNombreCompletoPaciente(t),
          nombre: t.nombre || t.Nombre || t.nombrepaciente || t.NombrePaciente || '',
          apPaterno: t.appaterno || t.ApPaterno || t.appaternopaciente || t.ApPaternoPaciente || '',
          apMaterno: t.apmaterno || t.ApMaterno || t.apmaternopaciente || t.ApMaternoPaciente || '',
          idPaciente: t.idpaciente || t.IdPaciente || 0,
          fechaInicio: this.formatearFecha(t.fechainicio || t.FechaInicio || ''),
          fechaFin: this.formatearFecha(t.fechafin || t.FechaFin || ''),
          activo: t.activo !== undefined ? t.activo : true,
          dosis: t.dosis || t.Dosis || 'Sin dosis especificada',
          idMedicamento: t.idmedicamento || t.IdMedicamento || idMedicamento
        }));

        this.calcularEstadisticasDesdeTratamientos();

      } else {
        this.tratamientosAsociados = [];
        this.estadisticas = {
          totalTratamientos: 0,
          tratamientosActivos: 0,
          ultimoUso: null,
          pacientesActivos: 0
        };
      }

    } catch (error) {
      console.warn('No se pudieron cargar tratamientos reales:', error);
      this.tratamientosAsociados = [];
    } finally {
      this.cargandoTratamientos = false;
      this.cdr.detectChanges();
    }
  }

  // --- OBTENER NOMBRE COMPLETO DEL PACIENTE ---
  getNombreCompletoPaciente(t: any): string {
    const nombre = t.nombre || t.Nombre || t.nombrepaciente || t.NombrePaciente || '';
    const apPaterno = t.appaterno || t.ApPaterno || t.appaternopaciente || t.ApPaternoPaciente || '';
    const apMaterno = t.apmaterno || t.ApMaterno || t.apmaternopaciente || t.ApMaternoPaciente || '';

    if (nombre && apPaterno) {
      return `${nombre} ${apPaterno} ${apMaterno || ''}`.trim();
    }

    if (nombre) {
      return nombre;
    }

    if (t.nombrepaciente || t.NombrePaciente) {
      return t.nombrepaciente || t.NombrePaciente;
    }

    return 'Paciente sin nombre';
  }

  // --- FORMATEAR FECHA ---
  formatearFecha(fecha: string): string {
    if (!fecha) return '';

    try {
      if (fecha.includes('T')) {
        const fechaObj = new Date(fecha);
        if (!isNaN(fechaObj.getTime())) {
          const dia = String(fechaObj.getDate()).padStart(2, '0');
          const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
          const anio = fechaObj.getFullYear();
          return `${dia}/${mes}/${anio}`;
        }
      }

      if (fecha.includes('-')) {
        const partes = fecha.split('-');
        if (partes.length === 3) {
          return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
      }

      return fecha;
    } catch (error) {
      return fecha;
    }
  }

  inicializarHistorial() {
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
        accion: 'Medicamento registrado',
        detalle: `Registrado: ${this.medicamentoSeleccionado.nombrecomercial}`,
        usuario: 'Sistema'
      }
    ];

    if (this.medicamentoSeleccionado.laboratorio) {
      this.historialCambios.push({
        fecha: fechaStr,
        accion: 'Laboratorio asignado',
        detalle: `Laboratorio: ${this.medicamentoSeleccionado.laboratorio}`,
        usuario: 'Sistema'
      });
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

  // --- ESTADO DEL MEDICAMENTO ---
  getEstadoMedicamento(): { texto: string; clase: string; icono: string } {
    if (!this.estadisticas) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.estadisticas.tratamientosActivos > 0) {
      return {
        texto: 'En uso activo',
        clase: 'estado-activo',
        icono: 'bi-check-circle-fill'
      };
    } else if (this.estadisticas.totalTratamientos > 0) {
      return {
        texto: 'Sin uso activo',
        clase: 'estado-inactivo',
        icono: 'bi-clock'
      };
    } else {
      return {
        texto: 'Sin tratamientos',
        clase: 'estado-sin-datos',
        icono: 'bi-plus-circle'
      };
    }
  }

  getEstadoMedicamentoColor(): string {
    const estado = this.getEstadoMedicamento();
    const colores: { [key: string]: string } = {
      'En uso activo': '#10b981',
      'Sin uso activo': '#f59e0b',
      'Sin tratamientos': '#6c757d',
      'Sin datos': '#6c757d'
    };
    return colores[estado.texto] || '#6c757d';
  }

  formatearIndicaciones(texto: string): string {
    if (!texto) return '';
    return texto.split('. ').map(oracion =>
      oracion.charAt(0).toUpperCase() + oracion.slice(1)
    ).join('. ');
  }

  validarCampos(): { valido: boolean; mensaje: string } {
    const m = this.medicamentoSeleccionado;

    if (!m.nombrecomercial || m.nombrecomercial.trim().length < 2) {
      return { valido: false, mensaje: 'El nombre comercial debe tener al menos 2 caracteres' };
    }

    if (!m.presentacion || m.presentacion.trim().length < 2) {
      return { valido: false, mensaje: 'La presentación es obligatoria' };
    }

    return { valido: true, mensaje: '' };
  }

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
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

  // --- GUARDAR CAMBIOS ---
  async guardarCambios() {
    if (!this.medicamentoSeleccionado) return;

    const id = this.medicamentoSeleccionado.idmedicamento;
    if (!id) {
      this.lanzarNotificacion("Error: No se encontró el identificador del medicamento.", "error");
      return;
    }

    const nombreComercial = (this.medicamentoSeleccionado.nombrecomercial || '').trim();
    if (!nombreComercial) {
      this.lanzarNotificacion("El nombre comercial del medicamento es obligatorio.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const nombreAnterior = this.medicamentoSeleccionado.nombrecomercial;

      const payload = {
        nombreComercial: nombreComercial,
        sustanciaActiva: (this.medicamentoSeleccionado.sustanciaactiva || '').trim(),
        presentacion: (this.medicamentoSeleccionado.presentacion || '').trim(),
        concentracion: (this.medicamentoSeleccionado.concentracion || '').trim(),
        laboratorio: (this.medicamentoSeleccionado.laboratorio || '').trim(),
        indicacionesGenerales: (this.medicamentoSeleccionado.indicacionesgenerales || '').trim()
      };

      await firstValueFrom(this.usersService.actualizarMedicamento(id, payload));

      if (nombreAnterior !== payload.nombreComercial) {
        this.agregarHistorial(
          `Nombre actualizado`,
          `De: "${nombreAnterior}" → "${payload.nombreComercial}"`
        );
      } else {
        this.agregarHistorial(
          'Información actualizada',
          'Datos del medicamento actualizados'
        );
      }

      await this.cargarEstadisticasReales(id);
      await this.cargarTratamientosReales(id);

      this.lanzarNotificacion("¡Éxito! El medicamento ha sido actualizado correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/medicamentos']);
      }, 2000);

    } catch (error: any) {
      console.error("Error al guardar cambios del medicamento:", error);
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo guardar: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  getNombreFormateado(): string {
    if (!this.medicamentoSeleccionado) return '';
    const nombre = this.medicamentoSeleccionado.nombrecomercial || '';
    const sustancia = this.medicamentoSeleccionado.sustanciaactiva || '';

    if (sustancia) {
      return `${nombre} (${sustancia})`;
    }
    return nombre;
  }

  getInfoPresentacion(): string {
    const m = this.medicamentoSeleccionado;
    if (!m) return '';
    const partes = [];
    if (m.presentacion) partes.push(m.presentacion);
    if (m.concentracion) partes.push(m.concentracion);
    return partes.join(' - ');
  }

  getTotalTratamientos(): number {
    return this.tratamientosAsociados.length;
  }
}