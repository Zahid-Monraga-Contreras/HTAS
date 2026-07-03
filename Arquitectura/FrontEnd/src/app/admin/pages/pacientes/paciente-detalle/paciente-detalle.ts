import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
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
  selector: 'app-paciente-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './paciente-detalle.html',
  styleUrls: ['./paciente-detalle.css']
})
export class PacienteDetalle implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  usuarioSeleccionado: any = null;
  isSaving = false;

  // Control de estado para el modal de citas
  mostrarModalCita = false;
  isSavingCita = false;

  nuevaCita = {
    fechaCita: '',
    horaCita: '',
    motivo: '',
    sintomas: '',
    modalidad: 'Presencial'
  };

  // Sistema de Notificaciones Premium (Reemplazo de Alerts de Navegador)
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // Referencias para destruir las instancias al cerrar el modal o salir del componente
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

    if (state && state.usuario) {
      this.usuarioSeleccionado = { ...state.usuario };
    } else {
      if (isPlatformBrowser(this.platformId)) {
        this.router.navigate(['/pacientes']);
      }
    }
  }

  ngOnDestroy() {
    this.destruirCalendariosCita();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  volver() {
    this.location.back();
  }

  // --- CONTROL DEL TOAST NOTIFICACIÓN PREMIUM ---
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

  // --- CONTROL DEL MODAL Y FLATPICKR ---
  abrirModalCita() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    this.nuevaCita = {
      fechaCita: `${anio}-${mes}-${dia}`,
      horaCita: '10:00',
      motivo: '',
      sintomas: '',
      modalidad: 'Presencial'
    };

    this.mostrarModalCita = true;
    this.cdr.detectChanges();

    this.inicializarCalendariosCita();
  }

  cerrarModalCita() {
    this.destruirCalendariosCita();
    this.mostrarModalCita = false;
  }

  inicializarCalendariosCita() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        // 1. CONFIGURACIÓN COMPLETA PARA FECHA DE CITA (Flatpickr)
        this.fpFechaInstance = flatpickr('#fechaCitaInput', {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevaCita.fechaCita || "today",
          minDate: "today",
          maxDate: fechaMaximaCita,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.fechaCita = dateStr;
            this.cdr.detectChanges();
          }
        });

        // 2. CONFIGURACIÓN COMPLETA PARA HORA DE CITA (Flatpickr en modo Reloj)
        this.fpHoraInstance = flatpickr('#horaCitaInput', {
          locale: Spanish,
          enableTime: true,
          noCalendar: true,
          dateFormat: "H:i",
          time_24hr: true,
          defaultDate: this.nuevaCita.horaCita || "10:00",
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.horaCita = dateStr;
            this.cdr.detectChanges();
          }
        });
      }, 50);
    }
  }

  destruirCalendariosCita() {
    if (this.fpFechaInstance) {
      this.fpFechaInstance.destroy();
      this.fpFechaInstance = null;
    }
    if (this.fpHoraInstance) {
      this.fpHoraInstance.destroy();
      this.fpHoraInstance = null;
    }
  }

  async registrarCita() {
    if (!this.nuevaCita.fechaCita || !this.nuevaCita.horaCita || !this.nuevaCita.motivo.trim()) {
      this.lanzarNotificacion("Por favor rellene los campos obligatorios para agendar la cita.", "warning");
      return;
    }

    this.isSavingCita = true;
    try {
      const nombre = (this.usuarioSeleccionado.nombre || '').trim();
      const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || this.usuarioSeleccionado.apPaterno || '').trim();
      const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || this.usuarioSeleccionado.apMaterno || '').trim();

      const payloadCita = {
        nombrePaciente: nombre,
        apPaternoPaciente: apPaterno,
        apMaternoPaciente: apMaterno,
        telefonoPaciente: this.usuarioSeleccionado.telefono ? String(this.usuarioSeleccionado.telefono) : null,
        correoPaciente: this.usuarioSeleccionado.correo,
        fechaCita: this.nuevaCita.fechaCita,
        horaCita: this.nuevaCita.horaCita.length === 5 ? `${this.nuevaCita.horaCita}:00` : this.nuevaCita.horaCita,
        motivo: this.nuevaCita.motivo.trim(),
        sintomas: this.nuevaCita.sintomas.trim() || 'Sin síntomas',
        modalidad: this.nuevaCita.modalidad,
        estado: 'Programada'
      };

      await firstValueFrom(this.usersService.crearCita(payloadCita));

      this.cerrarModalCita();
      this.lanzarNotificacion("¡Cita asignada! Se registró la cita médica correctamente.", "success");

    } catch (error: any) {
      console.error("Error al registrar la cita:", error);
      this.lanzarNotificacion("Hubo un error al registrar la cita médica.", "error");
    } finally {
      this.isSavingCita = false;
      this.cdr.detectChanges();
    }
  }

  async guardarCambios() {
    if (!this.usuarioSeleccionado) return;

    const nombre = (this.usuarioSeleccionado.nombre || '').trim();
    const apPaterno = (this.usuarioSeleccionado.tempApellidoPaterno || '').trim();

    if (!nombre || !apPaterno || !this.usuarioSeleccionado.correo) {
      this.lanzarNotificacion("El nombre, apellido paterno y correo son obligatorios.", "warning");
      return;
    }

    this.isSaving = true;
    const fuenteActual = this.usuarioSeleccionado.fuente;
    const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id; // Asegurar captura de ID

    try {
      const apMaterno = (this.usuarioSeleccionado.tempApellidoMaterno || '').trim();
      const nombreCompleto = [nombre, apPaterno, apMaterno].filter(p => p).join(' ');

      if (fuenteActual === 'Firebase') {
        const dataFirebase = {
          NombreCompleto: nombreCompleto,
          correo: this.usuarioSeleccionado.correo,
          rol: this.usuarioSeleccionado.rol,
          telefono: this.usuarioSeleccionado.telefono
        };
        await this.googleService.updateUsuario(id, dataFirebase);
      } else {
        // Mapeo exacto con las variables estructuradas en el updateUsuario del Backend
        const datosPostgres = {
          nombre: nombre,
          apPaterno: apPaterno,
          apMaterno: apMaterno,
          appaterno: apPaterno,
          apmaterno: apMaterno,
          correo: this.usuarioSeleccionado.correo,
          telefono: this.usuarioSeleccionado.telefono,
          genero: this.usuarioSeleccionado.genero || null, // <- Agregado
          nss: this.usuarioSeleccionado.nss || null,
          tipoSangre: this.usuarioSeleccionado.tipoSangre || null, // <- Agregado
          peso: this.usuarioSeleccionado.peso || null, // <- Agregado
          altura: this.usuarioSeleccionado.altura || null, // <- Agregado
          antecedentesFamiliares: this.usuarioSeleccionado.antecedentesFamiliares || null, // <- Agregado
          rol: 'Paciente',
          activo: this.usuarioSeleccionado.activo ?? true
        };
        await firstValueFrom(this.usersService.updateUsuario(id, datosPostgres));
      }

      this.lanzarNotificacion("¡Éxito! Los datos del paciente se actualizaron correctamente.", "success");

      setTimeout(() => {
        this.router.navigate(['/pacientes']);
      }, 2000);

    } catch (error: any) {
      console.error('Error al actualizar:', error);
      this.lanzarNotificacion("No se pudieron guardar los cambios en el servidor.", "error");
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }
}