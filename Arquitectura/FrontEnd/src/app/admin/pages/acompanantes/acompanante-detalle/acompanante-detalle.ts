import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleService } from '../../../../auth/services/google';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
  selector: 'app-acompanante-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './acompanante-detalle.html',
  styleUrls: ['./acompanante-detalle.css']
})
export class AcompananteDetalle implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  usuarioSeleccionado: any = null;
  isSaving = false;

  // Sistema de Notificaciones Premium Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  ngOnInit() {
    let state: any = null;
    if (isPlatformBrowser(this.platformId)) {
      state = history.state;
    } else {
      const navigation = this.router.getCurrentNavigation();
      state = navigation?.extras?.state;
    }

    if (state && state.usuario) {
      this.usuarioSeleccionado = { ...state.usuario };

      if (this.usuarioSeleccionado.fechaNacimiento) {
        this.usuarioSeleccionado.fechaNacimiento = this.limpiarFecha(this.usuarioSeleccionado.fechaNacimiento);
      }
      if (this.usuarioSeleccionado.fechaAsignacion) {
        this.usuarioSeleccionado.fechaAsignacion = this.limpiarFecha(this.usuarioSeleccionado.fechaAsignacion);
      }
    } else {
      this.router.navigate(['/acompanantes']);
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
    if (!this.usuarioSeleccionado) return;

    const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id || this.usuarioSeleccionado.uid;
    if (!id) {
      this.lanzarNotificacion("Error: No se encontró el identificador único del usuario.", "error");
      return;
    }

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.apPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.apMaterno || '').trim();
    const correo = (this.usuarioSeleccionado.correo || '').trim();
    const telefono = (this.usuarioSeleccionado.telefono || '').trim();

    // Validaciones de estructura de datos en Front-end
    if (!nombre || !apPaterno || !apMaterno || !correo || !telefono) {
      this.lanzarNotificacion("Todos los campos personales básicos son obligatorios.", "warning");
      return;
    }

    if (!this.usuarioSeleccionado.fechaNacimiento || !this.usuarioSeleccionado.fechaAsignacion) {
      this.lanzarNotificacion("La fecha de nacimiento y asignación son obligatorias.", "warning");
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const payload = {
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        correo: correo,
        telefono: telefono,
        genero: this.usuarioSeleccionado.genero,
        activo: this.usuarioSeleccionado.activo,
        rol: this.usuarioSeleccionado.rol || 'Acompañante',
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento,
        fechaAsignacion: this.usuarioSeleccionado.fechaAsignacion
      };

      await firstValueFrom(this.usersService.updateUsuario(id, payload));

      this.lanzarNotificacion("¡Éxito! La información del acompañante ha sido actualizada.", "success");

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

  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        // --- 1. CONFIGURACIÓN PARA FECHA DE NACIMIENTO ---
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
        flatpickr('#fechaNacimientoInput', configNacimiento);

        // --- 2. CONFIGURACIÓN PARA FECHA DE ASIGNACIÓN ---
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
        flatpickr('#fechaInput', configAsignacion);

      }, 50);
    }
  }
}