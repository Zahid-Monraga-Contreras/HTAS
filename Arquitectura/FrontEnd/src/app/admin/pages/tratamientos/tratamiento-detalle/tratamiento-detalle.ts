import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

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

  // Instancias de Flatpickr para control de memoria
  private fpInicio: any = null;
  private fpFin: any = null;

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

    if (state && state.tratamiento) {
      this.tratamientoSeleccionado = { ...state.tratamiento };
      this.inicializarCalendario();
    } else {
      this.router.navigate(['/tratamientos']);
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    if (this.fpInicio) this.fpInicio.destroy();
    if (this.fpFin) this.fpFin.destroy();
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
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        // --- CÁLCULO DE LA FECHA MÁXIMA (Mes actual + 2 meses) ---
        const hoy = new Date();
        const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        const fechaIniValor = this.tratamientoSeleccionado?.fechainicio || this.tratamientoSeleccionado?.fechaInicio || null;
        const fechaFinValor = this.tratamientoSeleccionado?.fechafin || this.tratamientoSeleccionado?.fechaFin || null;

        // --- 1. CONFIGURACIÓN PARA FECHA DE INICIO ---
        this.fpInicio = flatpickr('#fechaInicioInput', {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: fechaIniValor ? fechaIniValor.split('T')[0] : null,
          minDate: "today",
          maxDate: fechaMaxima, // <-- Restricción añadida
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            if (this.tratamientoSeleccionado) {
              this.tratamientoSeleccionado.fechainicio = dateStr;
              this.tratamientoSeleccionado.fechaInicio = dateStr;
              this.cdr.detectChanges();
            }
          }
        });

        // --- 2. CONFIGURACIÓN PARA FECHA DE FINALIZACIÓN (FIN) ---
        this.fpFin = flatpickr('#fechaFinInput', {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: fechaFinValor ? fechaFinValor.split('T')[0] : null,
          minDate: "today",
          maxDate: fechaMaxima, // <-- Restricción añadida
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            if (this.tratamientoSeleccionado) {
              this.tratamientoSeleccionado.fechafin = dateStr;
              this.tratamientoSeleccionado.fechaFin = dateStr;
              this.cdr.detectChanges();
            }
          }
        });
      }, 50);
    }
  }

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

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const estadoActivo = this.tratamientoSeleccionado.activo === true || this.tratamientoSeleccionado.activo === 'true';

      const payload = {
        dosis: dosis,
        frecuenciaHoras: frecuenciaHoras,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        notasInstrucciones: (this.tratamientoSeleccionado.notasinstrucciones || '').trim(),
        activo: estadoActivo
      };

      await firstValueFrom(this.usersService.actualizarTratamiento(id, payload));
      this.lanzarNotificacion("¡Éxito! El tratamiento ha sido actualizado correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/tratamientos']);
      }, 2000);

    } catch (error: any) {
      console.error("Error al guardar cambios en HTAS:", error);
      const msgErr = error.error?.error || error.message || "Error interno del servidor";
      this.lanzarNotificacion(`No se pudo guardar: ${msgErr}`, "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }
}