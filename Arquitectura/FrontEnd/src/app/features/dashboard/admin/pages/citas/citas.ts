import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

declare var flatpickr: any;

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [Menu, CommonModule, FormsModule],
  templateUrl: './citas.html',
  styleUrl: './citas.css',
})
export class Citas implements OnInit, OnDestroy {
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  citasTodo: any[] = [];
  searchTerm: string = '';
  expandedId: number | null = null;
  currentUser: any = null;

  // Paginación
  paginaActual = 0;
  itemsPorPagina = 10;

  // Selección y Modales
  citaSeleccionada: any = null;
  mostrarModalCrear = false;
  mostrarModalEdit = false;
  mostrarModalDelete = false;
  isSaving = false;
  isDeleting = false;

  nuevaCita: any = {
    fecha: '',
    hora: '',
    motivo: '',
    modalidad: 'Presencial',
    sintomas: ''
  };

  // Sistema de Notificaciones Premium
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  // Instancias locales de Flatpickr
  private fpFechaInstance: any = null;
  private fpHoraInstance: any = null;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_htas');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        console.log('DATOS DEL USUARIO EN LOCALSTORAGE:', this.currentUser);
        console.log('ROL DEL USUARIO:', this.currentUser.rol);
        console.log('ROL EN MINÚSCULAS:', this.currentUser.rol?.toLowerCase());
        await this.cargarCitas();
      } else {
        console.error('No se encontró usuario en localStorage');
      }
    }
  }

  ngOnDestroy() {
    this.destruirCalendarios();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Validador de permisos
   */
  verificarPermiso(accion: 'crear' | 'editar' | 'eliminar'): boolean {
    if (!this.currentUser || !this.currentUser.rol) return false;

    const rol = this.currentUser.rol
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    console.log(`Verificando permiso para "${accion}" con rol:`, rol);

    const esAdmin = rol === 'administrador' || rol === 'admin';
    const esMedicoODoctor = rol.includes('medico') || rol.includes('doctor');
    const esAcompanante = rol === 'acompanante';

    console.log(`  - esAdmin: ${esAdmin}`);
    console.log(`  - esMedicoODoctor: ${esMedicoODoctor}`);
    console.log(`  - esAcompanante: ${esAcompanante}`);

    switch (accion) {
      case 'crear':
        const puedeCrear = rol === 'paciente' || esAcompanante || esAdmin;
        console.log(`  - Puede crear: ${puedeCrear}`);
        return puedeCrear;
      case 'editar':
      case 'eliminar':
        const puedeGestionar = esMedicoODoctor || esAdmin;
        console.log(`  - Puede ${accion}: ${puedeGestionar}`);
        return puedeGestionar;
      default:
        return false;
    }
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

  async cargarCitas() {
    if (!this.currentUser || !this.currentUser.correo) {
      console.error('Usuario o correo no disponible');
      return;
    }

    console.log('Iniciando carga de citas...');
    console.log('Usuario actual:', this.currentUser.correo);
    console.log('Rol del usuario:', this.currentUser.rol);

    // Normalizar el rol
    const rol = this.currentUser.rol.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    console.log('Rol normalizado:', rol);

    // Verificar si es administrador (de varias formas)
    const esAdmin = rol === 'administrador' ||
      rol === 'admin' ||
      this.currentUser.rol?.toLowerCase().includes('admin') ||
      this.currentUser.rol?.toLowerCase() === 'administrador';

    const esMedico = rol.includes('medico') || rol.includes('doctor');
    const esAcompanante = rol === 'acompanante';

    const tieneAccesoGlobal = esAdmin || esMedico || esAcompanante;

    console.log('Resultado de verificación:');
    console.log('  - esAdmin:', esAdmin);
    console.log('  - esMedico:', esMedico);
    console.log('  - esAcompanante:', esAcompanante);
    console.log('  - tieneAccesoGlobal:', tieneAccesoGlobal);

    let data: any[] = [];

    try {
      if (tieneAccesoGlobal) {
        console.log('Cargando TODAS las citas (getAllCitas)');
        data = await firstValueFrom(this.usersService.getAllCitas());
        console.log('Número de citas obtenidas:', data?.length || 0);
      } else {
        console.log('Cargando SOLO citas del paciente (getMisCitas)');
        data = await firstValueFrom(this.usersService.getMisCitas(this.currentUser.correo));
        console.log('Número de citas del paciente:', data?.length || 0);
      }

      // Verificar que data sea un array
      if (!data || !Array.isArray(data)) {
        console.warn('La respuesta no es un array válido:', data);
        data = [];
      }

      this.citasTodo = data.map(c => ({
        ...c,
        id: c.idcita,
        NombreMostrar: `${c.nombrepaciente || ''} ${c.appaternopaciente || ''}`.trim() || 'Paciente sin nombre'
      }));

      console.log('citasTodo actualizado. Total:', this.citasTodo.length);
      console.log('Primeras 3 citas:', this.citasTodo.slice(0, 3));

      this.cdr.detectChanges();

      if (this.citasTodo.length === 0) {
        console.warn('No se encontraron citas para mostrar');
        this.lanzarNotificacion('No hay citas disponibles en el sistema', 'warning');
      }

    } catch (error) {
      console.error('Error al cargar citas:', error);
      this.lanzarNotificacion('Error al cargar la lista de citas', 'error');
      this.citasTodo = [];
      this.cdr.detectChanges();
    }
  }

  get citasFiltradas() {
    if (!this.searchTerm) return this.citasTodo;
    const term = this.searchTerm.toLowerCase();
    return this.citasTodo.filter(c =>
      c.NombreMostrar?.toLowerCase().includes(term) ||
      c.motivo?.toLowerCase().includes(term) ||
      c.estado?.toLowerCase().includes(term)
    );
  }

  get citasPaginadas() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.citasFiltradas.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const totalPaginas = Math.ceil(this.citasFiltradas.length / this.itemsPorPagina);
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  seleccionarCita(c: any) {
    console.log('Seleccionando cita:', c.idcita);
    this.citaSeleccionada = {
      ...c,
      tempEstado: c.estado,
      notasdoctor: c.notasdoctor || ''
    };
  }

  abrirCrearCita() {
    if (!this.verificarPermiso('crear')) {
      this.lanzarNotificacion('No posees los permisos requeridos para agendar citas.', 'error');
      return;
    }

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    this.nuevaCita = {
      fecha: `${anio}-${mes}-${dia}`,
      hora: '10:00',
      motivo: '',
      modalidad: 'Presencial',
      sintomas: ''
    };
    this.mostrarModalCrear = true;
    this.cdr.detectChanges();
    this.inicializarCalendario();
  }

  async guardarNuevaCita() {
    if (!this.verificarPermiso('crear')) {
      this.lanzarNotificacion('Acción denegada por restricciones de rol.', 'error');
      return;
    }

    if (!this.nuevaCita.fecha || !this.nuevaCita.hora || !this.nuevaCita.motivo.trim()) {
      this.lanzarNotificacion('Por favor llena los campos obligatorios del formulario.', 'warning');
      return;
    }

    this.isSaving = true;

    const citaParaEnviar = {
      nombrePaciente: this.currentUser.nombre,
      apPaternoPaciente: this.currentUser.apPaterno,
      apMaternoPaciente: this.currentUser.apMaterno || '',
      telefonoPaciente: this.currentUser.telefono ? String(this.currentUser.telefono) : null,
      correoPaciente: this.currentUser.correo,
      fechaCita: this.nuevaCita.fecha,
      horaCita: this.nuevaCita.hora.length === 5 ? `${this.nuevaCita.hora}:00` : this.nuevaCita.hora,
      motivo: this.nuevaCita.motivo.trim(),
      modalidad: this.nuevaCita.modalidad,
      sintomas: this.nuevaCita.sintomas.trim() || 'Sin síntomas',
      estado: 'Programada'
    };

    try {
      await firstValueFrom(this.usersService.crearCita(citaParaEnviar));
      await this.cargarCitas();
      this.cerrarModal();
      this.lanzarNotificacion('¡Éxito! La cita médica ha sido agendada correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar cita:', error);
      this.lanzarNotificacion('No se pudo agendar la cita médica en el servidor.', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  abrirEditarCita() {
    if (!this.verificarPermiso('editar')) {
      this.lanzarNotificacion('Tu rol no cuenta con permisos para editar citas.', 'error');
      return;
    }
    if (!this.citaSeleccionada) {
      this.lanzarNotificacion('Selecciona una cita de la tabla primero.', 'warning');
      return;
    }
    const id = this.citaSeleccionada.idcita || this.citaSeleccionada.id;
    this.router.navigate(['/citas/editar', id], { state: { cita: this.citaSeleccionada } });
  }

  abrirEliminarCita() {
    if (!this.verificarPermiso('eliminar')) {
      this.lanzarNotificacion('Tu rol no cuenta con permisos para cancelar citas.', 'error');
      return;
    }
    if (!this.citaSeleccionada) {
      this.lanzarNotificacion('Selecciona una cita para cancelar.', 'warning');
      return;
    }
    this.mostrarModalDelete = true;
  }

  async confirmarEliminarCita() {
    if (!this.verificarPermiso('eliminar')) {
      this.lanzarNotificacion('Acción inválida para tu rol.', 'error');
      return;
    }

    if (!this.citaSeleccionada) {
      this.lanzarNotificacion('No hay cita seleccionada.', 'warning');
      return;
    }

    if (this.citaSeleccionada.estado === 'Cancelada') {
      this.lanzarNotificacion('Esta cita ya está cancelada.', 'warning');
      this.cerrarModal();
      return;
    }

    if (this.citaSeleccionada.estado === 'Completada') {
      this.lanzarNotificacion('No se puede cancelar una cita ya completada.', 'warning');
      this.cerrarModal();
      return;
    }

    this.isDeleting = true;

    try {
      const idCita = this.citaSeleccionada.idcita || this.citaSeleccionada.id;

      await firstValueFrom(
        this.usersService.cancelarCita(idCita, 'Cancelada por el usuario')
      );

      await this.cargarCitas();
      this.cerrarModal();
      this.citaSeleccionada = null;
      this.lanzarNotificacion('La cita médica ha sido cancelada con éxito.', 'success');
    } catch (error: any) {
      console.error('Error al cancelar:', error);
      const mensajeError = error.error?.error || error.message || 'Error al cancelar la cita';
      this.lanzarNotificacion(`Error: ${mensajeError}`, 'error');
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  toggleExpand(id: number, event: Event) {
    event.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }

  cerrarModal() {
    this.destruirCalendarios();
    this.mostrarModalCrear = false;
    this.mostrarModalEdit = false;
    this.mostrarModalDelete = false;
  }

  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        this.fpFechaInstance = flatpickr("#fechaCitaInput", {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevaCita.fecha || "today",
          minDate: "today",
          maxDate: fechaMaximaCita,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.fecha = dateStr;
            this.cdr.detectChanges();
          }
        });

        this.fpHoraInstance = flatpickr("#horaCitaInput", {
          locale: Spanish,
          enableTime: true,
          noCalendar: true,
          dateFormat: "H:i",
          time_24hr: true,
          defaultDate: this.nuevaCita.hora || "10:00",
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            this.nuevaCita.hora = dateStr;
            this.cdr.detectChanges();
          }
        });
      }, 50);
    }
  }

  destruirCalendarios() {
    if (this.fpFechaInstance) {
      this.fpFechaInstance.destroy();
      this.fpFechaInstance = null;
    }
    if (this.fpHoraInstance) {
      this.fpHoraInstance.destroy();
      this.fpHoraInstance = null;
    }
  }
}