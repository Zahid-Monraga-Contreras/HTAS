import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleService } from '../../../../../../core/services/google.service';
import { Users } from '../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Menu } from "../../../template/menu/menu";

// Importar los partials
import { InfoMedicoComponent } from './partials/info-medico/info-medico';
import { HistorialMedicoComponent } from './partials/historial-medico/historial-medico';
import { ExpedienteMedicoComponent } from './partials/expediente-medico/expediente-medico';

type TabMedico = 'info' | 'historial' | 'expediente';

@Component({
  selector: 'app-medico-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Menu,
    InfoMedicoComponent,
    HistorialMedicoComponent,
    ExpedienteMedicoComponent
  ],
  templateUrl: './medico-detalle.html',
  styleUrls: ['./medico-detalle.css']
})
export class MedicoDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  usuarioSeleccionado: any = null;
  isSaving = false;

  activeTab: TabMedico = 'info';

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  historialCambios: any[] = [];
  pacientesAtendidos: any[] = [];

  estadisticas: {
    totalPacientes: number;
    citasCompletadas: number;
    citasPendientes: number;
    promedioConsultas: number;
  } | null = null;

  medicoId: number | null = null;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const state = history.state;

    if (state && state.usuario) {
      this.medicoId = state.usuario.idusuario || state.usuario.id;
      this.usuarioSeleccionado = { ...state.usuario };
      this.inicializarCampos();
      this.cargarDatosAdicionales();
    } else {
      this.router.navigate(['/medicos']);
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  cambiarTab(tab: TabMedico) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  inicializarCampos() {
    if (!this.usuarioSeleccionado) return;

    if (!this.usuarioSeleccionado.fechaNacimiento) {
      this.usuarioSeleccionado.fechaNacimiento = '';
    }
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
    if (!this.usuarioSeleccionado.direccionClinica) {
      this.usuarioSeleccionado.direccionClinica = '';
    }

    if (!this.usuarioSeleccionado.tempNombre) {
      this.usuarioSeleccionado.tempNombre = this.usuarioSeleccionado.nombre || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoPaterno) {
      this.usuarioSeleccionado.tempApellidoPaterno = this.usuarioSeleccionado.apPaterno || '';
    }
    if (!this.usuarioSeleccionado.tempApellidoMaterno) {
      this.usuarioSeleccionado.tempApellidoMaterno = this.usuarioSeleccionado.apMaterno || '';
    }

    this.cdr.detectChanges();
  }

  cargarDatosAdicionales() {
    if (!this.usuarioSeleccionado) return;

    this.cargarHistorialMedico();

    this.estadisticas = {
      totalPacientes: Math.floor(Math.random() * 50) + 10,
      citasCompletadas: Math.floor(Math.random() * 30) + 5,
      citasPendientes: Math.floor(Math.random() * 10) + 2,
      promedioConsultas: Math.floor(Math.random() * 15) + 5
    };

    this.pacientesAtendidos = [
      { id: 1, nombre: 'Maria Lopez Gonzalez', fechaUltimaCita: '2026-07-01', motivo: 'Consulta general' },
      { id: 2, nombre: 'Juan Perez Garcia', fechaUltimaCita: '2026-06-28', motivo: 'Control de rutina' },
      { id: 3, nombre: 'Ana Martinez Ruiz', fechaUltimaCita: '2026-06-25', motivo: 'Dolor de cabeza' }
    ];

    if (this.usuarioSeleccionado.especialidad) {
      this.agregarHistorial(
        'Especialidad asignada',
        `Especialidad: ${this.usuarioSeleccionado.especialidad}`
      );
    }

    this.cdr.detectChanges();
  }

  cargarHistorialMedico() {
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
        accion: 'Medico registrado',
        detalle: `Registrado: ${this.usuarioSeleccionado.nombre || ''} ${this.usuarioSeleccionado.apPaterno || ''}`,
        usuario: 'Sistema'
      }
    ];
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

  getEstadoMedico(): { texto: string; clase: string; icono: string } {
    if (!this.usuarioSeleccionado) {
      return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
    }

    if (this.usuarioSeleccionado.activo === false) {
      return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
    }

    if (this.estadisticas && this.estadisticas.citasPendientes > 0) {
      return { texto: 'Con citas pendientes', clase: 'estado-ocupado', icono: 'bi-clock-fill' };
    }

    return { texto: 'Activo disponible', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
  }

  validarCampos(): { valido: boolean; mensaje: string } {
    const u = this.usuarioSeleccionado;

    if (!u.tempNombre || u.tempNombre.trim().length < 2) {
      return { valido: false, mensaje: 'El nombre debe tener al menos 2 caracteres' };
    }

    if (!u.tempApellidoPaterno || u.tempApellidoPaterno.trim().length < 2) {
      return { valido: false, mensaje: 'El apellido paterno debe tener al menos 2 caracteres' };
    }

    if (!u.correo || !u.correo.includes('@')) {
      return { valido: false, mensaje: 'El correo electronico no es valido' };
    }

    if (u.curp && u.curp.length > 0) {
      const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$/;
      if (!curpRegex.test(u.curp.toUpperCase())) {
        return { valido: false, mensaje: 'El formato de CURP no es valido' };
      }
    }

    if (u.codigoPostal && u.codigoPostal.length > 0) {
      const cpRegex = /^[0-9]{5}$/;
      if (!cpRegex.test(u.codigoPostal)) {
        return { valido: false, mensaje: 'El codigo postal debe tener 5 digitos numericos' };
      }
    }

    return { valido: true, mensaje: '' };
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
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.tempNombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();
    const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();
    const correoFinal = this.usuarioSeleccionado.correo || this.usuarioSeleccionado.Correo;

    if (!nombre || !apPaterno || !correoFinal) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo electronico son requeridos.", "warning");
      return;
    }

    const validacion = this.validarCampos();
    if (!validacion.valido) {
      this.lanzarNotificacion(validacion.mensaje, "warning");
      return;
    }

    const nombreAnterior = this.usuarioSeleccionado.nombre || '';
    const apPaternoAnterior = this.usuarioSeleccionado.apPaterno || '';

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const idFinal = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

      const datosActualizados = {
        nombre: nombre,
        apPaterno: apPaterno,
        appaterno: apPaterno,
        apMaterno: apMaterno,
        apmaterno: apMaterno,
        correo: correoFinal,
        telefono: this.usuarioSeleccionado.telefono || 'Sin telefono',
        genero: this.usuarioSeleccionado.genero || 'No especificado',
        especialidad: this.usuarioSeleccionado.especialidad || 'General',
        direccionClinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        direccionclinica: this.usuarioSeleccionado.direccionClinica || 'No registrada',
        rol: this.usuarioSeleccionado.rol || 'Medico',
        fechaNacimiento: this.usuarioSeleccionado.fechaNacimiento || null,
        curp: (this.usuarioSeleccionado.curp || '').toUpperCase().trim(),
        domicilio: (this.usuarioSeleccionado.domicilio || '').trim(),
        codigoPostal: (this.usuarioSeleccionado.codigoPostal || '').trim(),
        localidad: (this.usuarioSeleccionado.localidad || '').trim(),
        municipio: (this.usuarioSeleccionado.municipio || '').trim(),
        estado: (this.usuarioSeleccionado.estado || '').trim()
      };

      if (this.usuarioSeleccionado.fuente === 'Firebase') {
        await this.googleService.updateUsuario(idFinal, datosActualizados);
      } else {
        await firstValueFrom(this.usersService.updateUsuario(idFinal, datosActualizados));
      }

      if (nombreAnterior !== nombre || apPaternoAnterior !== apPaterno) {
        this.agregarHistorial(
          'Datos personales actualizados',
          `De: "${nombreAnterior} ${apPaternoAnterior}" a "${nombre} ${apPaterno}"`
        );
      } else {
        this.agregarHistorial(
          'Informacion actualizada',
          'Datos del medico actualizados'
        );
      }

      this.lanzarNotificacion("Los datos del medico se actualizaron correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/medicos']);
      }, 2000);

    } catch (error) {
      console.error('Error detallado al guardar:', error);
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // Método para cuando cambian datos en el partial
  onCambioDatos() {
    this.cdr.detectChanges();
  }
}