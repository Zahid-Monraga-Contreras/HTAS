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

      // Limpiar fechas
      if (this.usuarioSeleccionado.fechaNacimiento) {
        this.usuarioSeleccionado.fechaNacimiento = this.limpiarFecha(this.usuarioSeleccionado.fechaNacimiento);
      }
      if (this.usuarioSeleccionado.fechaAsignacion) {
        this.usuarioSeleccionado.fechaAsignacion = this.limpiarFecha(this.usuarioSeleccionado.fechaAsignacion);
      }

      // ✅ NUEVO: Asegurar que los nuevos campos tengan valores
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
      // ✅ NUEVO: Construir payload con todos los campos
      const payload = {
        // Campos básicos
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        correo: correo,
        telefono: telefono,
        genero: this.usuarioSeleccionado.genero,
        activo: this.usuarioSeleccionado.activo,
        rol: this.usuarioSeleccionado.rol || 'Acompañante',

        // Fechas
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento,
        fechaAsignacion: this.usuarioSeleccionado.fechaAsignacion,

        // ✅ NUEVOS CAMPOS DE UBICACIÓN Y DATOS PERSONALES
        curp: (this.usuarioSeleccionado.curp || '').trim().toUpperCase(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      // ✅ NUEVO: Validación opcional de CURP (si se proporciona)
      if (payload.curp && payload.curp.length > 0) {
        // Validación básica de CURP (18 caracteres alfanuméricos)
        const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
        if (!curpRegex.test(payload.curp)) {
          this.lanzarNotificacion("El formato de CURP no es válido. Debe tener 18 caracteres alfanuméricos.", "warning");
          this.isSaving = false;
          this.cdr.detectChanges();
          return;
        }
      }

      // ✅ NUEVO: Validación de código postal (si se proporciona)
      if (payload.codigoPostal && payload.codigoPostal.length > 0) {
        const cpRegex = /^[0-9]{5}$/;
        if (!cpRegex.test(payload.codigoPostal)) {
          this.lanzarNotificacion("El código postal debe tener 5 dígitos numéricos.", "warning");
          this.isSaving = false;
          this.cdr.detectChanges();
          return;
        }
      }

      await firstValueFrom(this.usersService.updateUsuario(id, payload));

      // ✅ NUEVO: Actualizar datos locales después de guardar
      this.usuarioSeleccionado.curp = payload.curp;
      this.usuarioSeleccionado.domicilio = payload.domicilio;
      this.usuarioSeleccionado.codigoPostal = payload.codigoPostal;
      this.usuarioSeleccionado.localidad = payload.localidad;
      this.usuarioSeleccionado.municipio = payload.municipio;
      this.usuarioSeleccionado.estado = payload.estado;

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

  // ==========================================================================
  // ✅ NUEVO: Métodos de utilidad para los nuevos campos
  // ==========================================================================

  /**
   * Verifica si el usuario tiene datos de ubicación completos
   */
  tieneUbicacionCompleta(): boolean {
    const u = this.usuarioSeleccionado;
    if (!u) return false;
    return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
  }

  /**
   * Obtiene la ubicación formateada para mostrar
   */
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
    return partes.join(', ');
  }

  /**
   * Limpia y formatea la CURP automáticamente (mayúsculas)
   */
  formatearCURP() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.curp) {
      this.usuarioSeleccionado.curp = this.usuarioSeleccionado.curp.toUpperCase().trim();
      this.cdr.detectChanges();
    }
  }

  /**
   * Limpia y valida el código postal
   */
  formatearCodigoPostal() {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado.codigoPostal) {
      const cp = this.usuarioSeleccionado.codigoPostal.replace(/\D/g, '').slice(0, 5);
      this.usuarioSeleccionado.codigoPostal = cp;
      this.cdr.detectChanges();
    }
  }

  /**
   * Capitaliza la primera letra de cada palabra
   */
  capitalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto.split(' ').map(palabra =>
      palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * Formatea campos de texto (domicilio, localidad, municipio, estado)
   */
  formatearCampoTexto(campo: string) {
    if (this.usuarioSeleccionado && this.usuarioSeleccionado[campo]) {
      this.usuarioSeleccionado[campo] = this.capitalizarTexto(this.usuarioSeleccionado[campo]);
      this.cdr.detectChanges();
    }
  }
}