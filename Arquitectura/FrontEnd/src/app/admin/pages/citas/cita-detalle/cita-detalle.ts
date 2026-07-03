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

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  estadosCita = ['Programada', 'Confirmada', 'Completada', 'Cancelada'];
  modalidades = ['Presencial', 'Virtual'];

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
    } else {
      this.router.navigate(['/citas']);
    }
  }

  ngAfterViewInit() {
    this.inicializarCalendario();
  }

  ngOnDestroy() {
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
      return hora.length > 5 ? hora.substring(0, 5) : hora;
    }
    return String(hora);
  }

  volver() {
    this.location.back();
  }

  // Controlador central para disparar alertas dinámicas
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
    if (!this.citaSeleccionada) return;

    const idCita = this.citaSeleccionada.idcita;
    if (!idCita) {
      this.lanzarNotificacion("Error: No se encontró el identificador único de la cita.", "error");
      return;
    }

    const motivo = (this.citaSeleccionada.motivo || '').trim();
    const estado = (this.citaSeleccionada.estado || '').trim();

    if (!motivo || !estado) {
      this.lanzarNotificacion("El motivo y el estado de la cita son obligatorios.", "warning");
      return;
    }

    if (!this.citaSeleccionada.fechacita || !this.citaSeleccionada.horacita) {
      this.lanzarNotificacion("La fecha y hora de la cita son obligatorias.", "warning");
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const payload = {
        estado: estado,
        motivo: motivo,
        modalidad: this.citaSeleccionada.modalidad,
        sintomas: this.citaSeleccionada.sintomas || '',
        notasDoctor: this.citaSeleccionada.notasdoctor || ''
      };

      await firstValueFrom(this.usersService.actualizarEstadoCita(idCita, payload));

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

  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
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
        flatpickr('#fechaCitaDetalleInput', configFecha);

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
        flatpickr('#horaCitaDetalleInput', configHora);

      }, 50);
    }
  }
}
