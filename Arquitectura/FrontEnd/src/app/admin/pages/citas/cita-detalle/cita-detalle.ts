import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
  selector: 'app-cita-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './cita-detalle.html',
  styleUrls: ['./cita-detalle.css']
})
export class CitaDetalle implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  citaSeleccionada: any = null;
  isSaving = false;

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  estadosCita = ['Programada', 'Confirmada', 'Completada', 'Cancelada', 'No Asistió'];
  modalidades = ['Presencial', 'Virtual'];

  estadosConColor = [
    { value: 'Programada', color: '#FFA726', label: 'Programada' },
    { value: 'Confirmada', color: '#66BB6A', label: 'Confirmada' },
    { value: 'Completada', color: '#42A5F5', label: 'Completada' },
    { value: 'Cancelada', color: '#EF5350', label: 'Cancelada' },
    { value: 'No Asistió', color: '#AB47BC', label: 'No Asistió' }
  ];

  historialCambios: any[] = [];
  mostrarHistorial = false;

  private fpFechaInstance: any = null;
  private fpHoraInstance: any = null;

  ngOnInit() {
    let state: any = null;
    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    if (state && state.cita) {
      this.citaSeleccionada = { ...state.cita };

      if (this.citaSeleccionada.fechacita) {
        this.citaSeleccionada.fechacita = this.limpiarFecha(this.citaSeleccionada.fechacita);
      }
      if (this.citaSeleccionada.horacita) {
        this.citaSeleccionada.horacita = this.limpiarHora(this.citaSeleccionada.horacita);
      }

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

  ngAfterViewInit() {
    this.inicializarCalendario();
  }

  ngOnDestroy() {
    this.destruirCalendarios();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

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

  inicializarHistorial() {
    const fechaActual = new Date();
    const fechaStr = fechaActual.toISOString().replace('T', ' ').slice(0, 16);

    this.historialCambios = [{
      fecha: fechaStr,
      usuario: 'Sistema',
      accion: 'Cita creada',
      detalle: `Cita programada para ${this.citaSeleccionada.fechacita} a las ${this.citaSeleccionada.horacita}`
    }];

    if (this.citaSeleccionada.estado && this.citaSeleccionada.estado !== 'Programada') {
      const fechaEstado = new Date();
      const fechaEstadoStr = fechaEstado.toISOString().replace('T', ' ').slice(0, 16);
      this.historialCambios.push({
        fecha: fechaEstadoStr,
        usuario: 'Sistema',
        accion: `Estado actualizado a: ${this.citaSeleccionada.estado}`,
        detalle: `La cita fue marcada como ${this.citaSeleccionada.estado}`
      });
    }
  }

  agregarHistorialLocal(accion: string, detalle: string) {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().replace('T', ' ').slice(0, 16);

    const nuevaEntrada = {
      fecha: fechaStr,
      usuario: 'Sistema',
      accion: accion,
      detalle: detalle
    };

    this.historialCambios.unshift(nuevaEntrada);
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

  getEstadoColor(estado: string): string {
    const found = this.estadosConColor.find(e => e.value === estado);
    return found ? found.color : '#78909C';
  }

  esCitaHoy(): boolean {
    if (!this.citaSeleccionada?.fechacita) return false;
    const hoy = new Date().toISOString().split('T')[0];
    return this.citaSeleccionada.fechacita === hoy;
  }

  esCitaFutura(): boolean {
    if (!this.citaSeleccionada?.fechacita) return false;
    const hoy = new Date().toISOString().split('T')[0];
    return this.citaSeleccionada.fechacita > hoy;
  }

  esCitaVencida(): boolean {
    if (!this.citaSeleccionada?.fechacita) return false;
    if (this.citaSeleccionada.estado === 'Cancelada' ||
      this.citaSeleccionada.estado === 'Completada' ||
      this.citaSeleccionada.estado === 'No Asistió') return false;
    const hoy = new Date().toISOString().split('T')[0];
    return this.citaSeleccionada.fechacita < hoy;
  }

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

    if (cita.estado === 'Completada' && this.esCitaFutura()) {
      return { valido: false, mensaje: 'No se puede marcar como completada una cita futura' };
    }

    return { valido: true, mensaje: '' };
  }

  // ✅ GUARDAR CAMBIOS - AHORA FUNCIONA CON EL BACKEND
  async guardarCambios() {
    if (!this.citaSeleccionada) return;

    const idCita = this.citaSeleccionada.idcita;
    if (!idCita) {
      this.lanzarNotificacion("Error: No se encontró el identificador único de la cita.", "error");
      return;
    }

    const motivo = (this.citaSeleccionada.motivo || '').trim();
    const estado = (this.citaSeleccionada.estado || '').trim();
    const fechacita = this.citaSeleccionada.fechacita || '';
    const horacita = this.citaSeleccionada.horacita || '';

    // Validaciones
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

      // ✅ Preparar payload con TODOS los campos
      const payload = {
        nombrePaciente: this.citaSeleccionada.nombrepaciente,
        apPaternoPaciente: this.citaSeleccionada.appaternopaciente,
        apMaternoPaciente: this.citaSeleccionada.apmaternopaciente || null,
        telefonoPaciente: this.citaSeleccionada.telefonopaciente || null,
        correoPaciente: this.citaSeleccionada.correopaciente || null,
        fechaCita: fechacita,
        horaCita: horacita,
        motivo: motivo,
        modalidad: this.citaSeleccionada.modalidad || 'Presencial',
        sintomas: (this.citaSeleccionada.sintomas || '').trim(),
        notasDoctor: (this.citaSeleccionada.notasdoctor || '').trim()
      };

      // ✅ Usar actualizarCita con la ruta correcta
      await firstValueFrom(this.usersService.actualizarCita(idCita, payload));

      // Registrar cambios en historial
      if (estadoAnterior !== estado) {
        this.agregarHistorialLocal(
          `Cambio de estado: ${estadoAnterior} → ${estado}`,
          `Estado actualizado por el sistema`
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

  // Cancelar cita
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

  // Marcar como completada
  async marcarCompletada() {
    if (!this.citaSeleccionada) return;

    if (this.esCitaFutura()) {
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
      // ✅ Usar actualizarCita con todos los campos (manteniendo los existentes)
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

      this.citaSeleccionada.estado = 'Completada';
      this.agregarHistorialLocal(
        'Cita completada',
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

  inicializarCalendario() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.destruirCalendarios();

    setTimeout(() => {
      const hoy = new Date();
      const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

      const configFecha: any = {
        locale: Spanish,
        dateFormat: "Y-m-d",
        defaultDate: this.citaSeleccionada?.fechacita || null,
        minDate: "today",
        maxDate: fechaMaxima,
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.citaSeleccionada) {
            this.citaSeleccionada.fechacita = dateStr;
            this.cdr.detectChanges();
          }
        }
      };

      const fechaElement = document.querySelector('#fechaCitaDetalleInput') as HTMLInputElement;
      if (fechaElement) {
        this.fpFechaInstance = flatpickr('#fechaCitaDetalleInput', configFecha);
      }

      const configHora: any = {
        locale: Spanish,
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        defaultDate: this.citaSeleccionada?.horacita || null,
        appendTo: document.body,
        static: false,
        disableMobile: true,
        onChange: (selectedDates: any, dateStr: string) => {
          if (this.citaSeleccionada) {
            this.citaSeleccionada.horacita = dateStr;
            this.cdr.detectChanges();
          }
        }
      };

      const horaElement = document.querySelector('#horaCitaDetalleInput') as HTMLInputElement;
      if (horaElement) {
        this.fpHoraInstance = flatpickr('#horaCitaDetalleInput', configHora);
      }

    }, 100);
  }

  destruirCalendarios() {
    if (this.fpFechaInstance) {
      try { this.fpFechaInstance.destroy(); } catch (e) { }
      this.fpFechaInstance = null;
    }
    if (this.fpHoraInstance) {
      try { this.fpHoraInstance.destroy(); } catch (e) { }
      this.fpHoraInstance = null;
    }
  }
}