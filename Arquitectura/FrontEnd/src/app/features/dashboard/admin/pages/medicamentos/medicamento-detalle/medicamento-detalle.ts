import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, viewChild } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Users } from '../../../../../../core/services/users.service';
import { Menu } from "../../../template/menu/menu";
import { InfoMedicamento } from './partials/info-medicamento/info-medicamento';
import { HistorialMedicamento } from './partials/historial-medicamento/historial-medicamento';

export interface Medicamento {
  idmedicamento: number;
  nombrecomercial: string;
  sustanciaactiva: string;
  presentacion: string;
  concentracion: string;
  laboratorio: string;
  indicacionesgenerales: string;
}

export interface HistorialMedicamentoItem {
  fecha: string;
  accion: string;
  detalle: string;
  usuario: string;
}

export interface TratamientoAsociado {
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

export interface EstadisticasMedicamento {
  totalTratamientos: number;
  tratamientosActivos: number;
  ultimoUso: string | null;
  pacientesActivos: number;
}

export type TabMedicamento = 'detalle' | 'historial';

@Component({
  selector: 'app-medicamento-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Menu,
    InfoMedicamento,
    HistorialMedicamento
  ],
  templateUrl: './medicamento-detalle.html',
  styleUrls: ['./medicamento-detalle.css']
})
export class MedicamentoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  infoMedicamento = viewChild(InfoMedicamento);
  historialMedicamento = viewChild(HistorialMedicamento);

  medicamentoSeleccionado: Medicamento | null = null;
  activeTab: TabMedicamento = 'detalle';

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
        this.cargarDatosHijos(idMedicamento);
      }
    } else {
      this.router.navigate(['/admin/medicamentos']);
    }
  }

  cargarDatosHijos(idMedicamento: number) {
    setTimeout(() => {
      const infoComponent = this.infoMedicamento();
      const historialComponent = this.historialMedicamento();

      if (infoComponent && this.medicamentoSeleccionado) {
        infoComponent.medicamento = this.medicamentoSeleccionado;
        infoComponent.cargarDatos(idMedicamento);
      }

      if (historialComponent && this.medicamentoSeleccionado) {
        historialComponent.medicamento = this.medicamentoSeleccionado;
        historialComponent.cargarDatos(idMedicamento);
      }
    }, 100);
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

  cambiarTab(tab: TabMedicamento) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    // Recargar datos del componente correspondiente al cambiar de pestaña
    if (this.medicamentoSeleccionado) {
      const idMedicamento = this.medicamentoSeleccionado.idmedicamento;
      if (idMedicamento) {
        if (tab === 'detalle') {
          const infoComponent = this.infoMedicamento();
          if (infoComponent) {
            // Forzar recarga
            infoComponent.cargarDatos(idMedicamento);
          }
        } else if (tab === 'historial') {
          const historialComponent = this.historialMedicamento();
          if (historialComponent) {
            // Forzar recarga
            historialComponent.cargarDatos(idMedicamento);
          }
        }
      }
    }

    this.cdr.detectChanges();
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

    const infoComponent = this.infoMedicamento();
    if (!infoComponent) return;

    const resultado = await infoComponent.guardarCambios();

    if (resultado.exito) {
      this.lanzarNotificacion(resultado.mensaje, 'success');

      const idMedicamento = this.medicamentoSeleccionado.idmedicamento;
      if (idMedicamento) {
        this.cargarDatosHijos(idMedicamento);
      }

      setTimeout(() => {
        this.router.navigate(['/admin/medicamentos']);
      }, 2000);
    } else {
      this.lanzarNotificacion(resultado.mensaje, 'error');
    }
  }

  volver() {
    this.location.back();
  }

  ngOnDestroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }
}