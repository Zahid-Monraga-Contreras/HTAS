import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// Importar los componentes de partials
import { InfoCita } from './partials/info-cita/info-cita';
import { HistorialCita, HistorialCitaItem } from './partials/historial-cita/historial-cita';
import { ResumenCita } from './partials/resumen-cita/resumen-cita';

type TabCita = 'info' | 'historial' | 'resumen';

@Component({
  selector: 'app-cita-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu, InfoCita, HistorialCita, ResumenCita],
  templateUrl: './cita-detalle.html',
  styleUrls: ['./cita-detalle.css']
})
export class CitaDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  citaSeleccionada: any = null;
  isSaving = false;
  activeTab: TabCita = 'info';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  historialCambios: HistorialCitaItem[] = [];
  citaId: number | null = null;
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

    if (state && state.cita) {
      this.citaSeleccionada = { ...state.cita };
      this.citaId = state.cita.idcita || state.cita.id || null;

      // Limpiar fechas y horas
      if (this.citaSeleccionada.fechacita) {
        this.citaSeleccionada.fechacita = this.limpiarFecha(this.citaSeleccionada.fechacita);
      }
      if (this.citaSeleccionada.horacita) {
        this.citaSeleccionada.horacita = this.limpiarHora(this.citaSeleccionada.horacita);
      }

      // Inicializar campos vacíos
      if (!this.citaSeleccionada.notasdoctor) {
        this.citaSeleccionada.notasdoctor = '';
      }
      if (!this.citaSeleccionada.sintomas) {
        this.citaSeleccionada.sintomas = '';
      }

      this.inicializarHistorial();

    } else {
      this.router.navigate(['/citas']);
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  // --- MÉTODOS DE UTILIDAD ---
  limpiarFecha(fecha: any): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') {
      return fecha.includes('T') ? fecha.split('T')[0] : fecha;
    }
    return new Date(fecha).toISOString().split('T')[0];
  }

  limpiarHora(hora: any): string {
    if (!hora) return '';
    if (typeof hora === 'string') {
      if (hora.includes(':')) {
        const partes = hora.split(':');
        if (partes.length >= 2) {
          return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
        }
      }
      return hora.length > 5 ? hora.substring(0, 5) : hora;
    }
    return String(hora);
  }

  volver() {
    this.location.back();
  }

  // --- CONTROL DE PESTAÑAS ---
  cambiarTab(tab: TabCita) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  // --- INICIALIZAR HISTORIAL ---
  inicializarHistorial() {
    const ahora = new Date();
    const fechaStr = ahora.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    this.historialCambios = [{
      fecha: fechaStr,
      usuario: 'Sistema',
      accion: 'Cita creada',
      detalle: `Cita programada para ${this.citaSeleccionada.fechacita} a las ${this.citaSeleccionada.horacita}`
    }];

    if (this.citaSeleccionada.estado && this.citaSeleccionada.estado !== 'Programada') {
      const fechaEstado = new Date();
      const fechaEstadoStr = fechaEstado.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      this.historialCambios.push({
        fecha: fechaEstadoStr,
        usuario: 'Sistema',
        accion: `Estado actualizado a: ${this.citaSeleccionada.estado}`,
        detalle: `La cita fue marcada como ${this.citaSeleccionada.estado}`
      });
    }
  }

  // --- AGREGAR AL HISTORIAL ---
  agregarHistorialLocal(accion: string, detalle: string) {
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
      usuario: 'Usuario actual',
      accion: accion,
      detalle: detalle
    });
    this.cdr.detectChanges();
  }

  // --- VALIDAR CAMPOS ---
  validarCambios(): { valido: boolean; mensaje: string } {
    const cita = this.citaSeleccionada;

    if (!cita.motivo || cita.motivo.trim().length < 3) {
      return { valido: false, mensaje: 'El motivo debe tener al menos 3 caracteres' };
    }

    if (!cita.fechacita) {
      return { valido: false, mensaje: 'La fecha de la cita es obligatoria' };
    }

    if (!cita.horacita) {
      return { valido: false, mensaje: 'La hora de la cita es obligatoria' };
    }

    return { valido: true, mensaje: '' };
  }

  // --- GUARDAR CAMBIOS ---
  async guardarCambios() {
    if (!this.citaSeleccionada) return;

    const idCita = this.citaSeleccionada.idcita;
    if (!idCita) {
      this.lanzarNotificacion("Error: No se encontró el identificador único de la cita.", "error");
      return;
    }

    const motivo = (this.citaSeleccionada.motivo || '').trim();
    const estado = (this.citaSeleccionada.estado || '').trim();

    const validacion = this.validarCambios();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const estadoAnterior = this.citaSeleccionada.estado;
      const motivoAnterior = this.citaSeleccionada.motivo;

      const payload = {
        nombrePaciente: this.citaSeleccionada.nombrepaciente,
        apPaternoPaciente: this.citaSeleccionada.appaternopaciente,
        apMaternoPaciente: this.citaSeleccionada.apmaternopaciente || null,
        telefonoPaciente: this.citaSeleccionada.telefonopaciente || null,
        correoPaciente: this.citaSeleccionada.correopaciente || null,
        fechaCita: this.citaSeleccionada.fechacita,
        horaCita: this.citaSeleccionada.horacita,
        motivo: motivo,
        modalidad: this.citaSeleccionada.modalidad || 'Presencial',
        sintomas: (this.citaSeleccionada.sintomas || '').trim(),
        notasDoctor: (this.citaSeleccionada.notasdoctor || '').trim()
      };

      await firstValueFrom(this.usersService.actualizarCita(idCita, payload));

      if (estadoAnterior !== estado) {
        this.agregarHistorialLocal(
          `Estado cambiado: ${estadoAnterior} → ${estado}`,
          `El estado de la cita fue actualizado`
        );
      }

      if (motivoAnterior !== motivo) {
        this.agregarHistorialLocal(
          'Motivo actualizado',
          `Nuevo motivo: ${motivo}`
        );
      }

      this.lanzarNotificacion("¡Éxito! La información de la cita ha sido actualizada.", "success");

      setTimeout(() => {
        this.router.navigate(['/citas']);
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

  // --- CANCELAR CITA ---
  async cancelarCita() {
    if (!this.citaSeleccionada) return;

    const idCita = this.citaSeleccionada.idcita;
    if (!idCita) {
      this.lanzarNotificacion("Error: No se encontró el identificador de la cita.", "error");
      return;
    }

    const confirmar = confirm('¿Estás seguro de que deseas cancelar esta cita?');
    if (!confirmar) return;

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const motivoCancelacion = prompt('Motivo de cancelación (opcional):') || 'Cancelada por el sistema';

      await firstValueFrom(this.usersService.cancelarCita(idCita, motivoCancelacion));

      this.citaSeleccionada.estado = 'Cancelada';
      this.agregarHistorialLocal(
        'Cita cancelada',
        `Motivo: ${motivoCancelacion}`
      );

      this.lanzarNotificacion("Cita cancelada exitosamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/citas']);
      }, 2000);

    } catch (error: any) {
      console.error("Error al cancelar cita:", error);
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo cancelar: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // --- MARCAR COMO COMPLETADA ---
  async marcarCompletada() {
    if (!this.citaSeleccionada) return;

    const hoy = new Date().toISOString().split('T')[0];
    if (this.citaSeleccionada.fechacita > hoy) {
      this.lanzarNotificacion("No se puede completar una cita programada para el futuro.", "warning");
      return;
    }

    const confirmar = confirm('¿Confirmas que esta cita se ha completado?');
    if (!confirmar) return;

    const idCita = this.citaSeleccionada.idcita;
    if (!idCita) {
      this.lanzarNotificacion("Error: No se encontró el identificador de la cita.", "error");
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      await firstValueFrom(this.usersService.actualizarCita(idCita, {
        nombrePaciente: this.citaSeleccionada.nombrepaciente,
        apPaternoPaciente: this.citaSeleccionada.appaternopaciente,
        apMaternoPaciente: this.citaSeleccionada.apmaternopaciente || null,
        telefonoPaciente: this.citaSeleccionada.telefonopaciente || null,
        correoPaciente: this.citaSeleccionada.correopaciente || null,
        fechaCita: this.citaSeleccionada.fechacita,
        horaCita: this.citaSeleccionada.horacita,
        motivo: this.citaSeleccionada.motivo,
        modalidad: this.citaSeleccionada.modalidad || 'Presencial',
        sintomas: this.citaSeleccionada.sintomas || '',
        notasDoctor: this.citaSeleccionada.notasdoctor || 'Cita completada'
      }));

      const estadoAnterior = this.citaSeleccionada.estado;
      this.citaSeleccionada.estado = 'Completada';

      this.agregarHistorialLocal(
        `Cita completada (estado anterior: ${estadoAnterior})`,
        'Cita marcada como completada por el sistema'
      );

      this.lanzarNotificacion("Cita marcada como completada exitosamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/citas']);
      }, 2000);

    } catch (error: any) {
      console.error("Error al marcar cita:", error);
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo completar: ${msgErr}`, "error");
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
}