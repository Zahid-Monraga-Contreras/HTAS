import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

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

    if (state && state.medicamento) {
      // Duplicamos el objeto y mapeamos de manera segura campos por si vienen en mayúsculas/camelCase desde la navegación
      const m = state.medicamento;
      this.medicamentoSeleccionado = {
        idmedicamento: m.idmedicamento || m.IdMedicamento || m.id,
        nombrecomercial: m.nombrecomercial || m.nombreComercial || '',
        sustanciaactiva: m.sustanciaactiva || m.sustanciaActiva || '',
        presentacion: m.presentacion || m.Presentacion || '',
        concentracion: m.concentracion || m.Concentracion || '',
        laboratorio: m.laboratorio || m.Laboratorio || '',
        indicacionesgenerales: m.indicacionesgenerales || m.indicacionesGenerales || ''
      };
    } else {
      this.router.navigate(['/medicamentos']);
    }
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

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      // El payload empareja exactamente con las propiedades que lee tu servicio del backend
      const payload = {
        nombreComercial: nombreComercial,
        sustanciaActiva: (this.medicamentoSeleccionado.sustanciaactiva || '').trim(),
        presentacion: (this.medicamentoSeleccionado.presentacion || '').trim(),
        concentracion: (this.medicamentoSeleccionado.concentracion || '').trim(),
        laboratorio: (this.medicamentoSeleccionado.laboratorio || '').trim(),
        indicacionesGenerales: (this.medicamentoSeleccionado.indicacionesgenerales || '').trim()
      };

      await firstValueFrom(this.usersService.actualizarMedicamento(id, payload));

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
}