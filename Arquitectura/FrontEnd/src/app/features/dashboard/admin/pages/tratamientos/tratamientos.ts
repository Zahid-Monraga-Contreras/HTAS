import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Menu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

// Importaciones para el control de los calendarios Flatpickr
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';

@Component({
  selector: 'app-tratamientos',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './tratamientos.html',
  styleUrls: ['./tratamientos.css']
})
export class Tratamientos implements OnInit, OnDestroy {
  private router = inject(Router);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  tratamientosTodo: any[] = [];
  searchTerm: string = '';
  currentUser: any = null;

  // Listas auxiliares para los selectores del Modal de Creación
  listaPacientes: any[] = [];
  listaMedicamentos: any[] = [];
  filtroPacienteModal: string = '';
  filtroMedicamentoModal: string = '';
  mostrarDropdownPacientes = false;
  mostrarDropdownMedicamentos = false;

  // Paginación
  paginaActual = 0;
  itemsPorPagina = 10;

  // Selección y modales
  tratamientoSeleccionado: any = null;
  mostrarModalCrear = false;
  mostrarModalDelete = false;
  isSaving = false;
  isDeleting = false;

  // Objeto adaptado al esquema real de la tabla TRATAMIENTOS en PostgreSQL
  nuevoTratamiento: any = {
    idPaciente: null,
    idMedicamento: null,
    idDoctor: null,
    dosis: '',
    frecuenciaHoras: null,
    fechaInicio: '',
    fechaFin: '',
    notasInstrucciones: '',
    activo: true
  };

  // Notificaciones Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_htas');
      if (saved) {
        try {
          this.currentUser = JSON.parse(saved);
          // Log para depurar qué está llegando realmente
          console.log("Rol del usuario cargado:", this.currentUser.rol);
        } catch (e) {
          console.error("Error al parsear usuario", e);
        }
      }
      await this.cargarTratamientos();
      await this.cargarCatalogosAuxiliares();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Validador estricto basado en tus requerimientos para Tratamientos:
   * Solo 'administrador' y 'medico' pueden Crear, Editar o Eliminar.
   */
  verificarPermiso(accion: 'crear' | 'editar' | 'eliminar'): boolean {
    if (!this.currentUser || !this.currentUser.rol) return false;

    // 1. Normalizamos: pasamos a minúsculas, quitamos espacios y tildes
    const rol = this.currentUser.rol
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quita tildes

    // 2. Definimos los grupos permitidos
    const esAdmin = rol === 'administrador';
    const esMedico = rol.includes('medico') || rol.includes('doctor');

    // 3. Lógica de acceso
    switch (accion) {
      case 'crear':
      case 'editar':
      case 'eliminar':
        return esAdmin || esMedico;
      default:
        return false;
    }
  }

  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        const configInicio: any = {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevoTratamiento?.fechaInicio || null,
          minDate: "today",
          maxDate: fechaMaxima,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            if (this.nuevoTratamiento) {
              this.nuevoTratamiento.fechaInicio = dateStr;
              this.cdr.detectChanges();
            }
          }
        };
        flatpickr('#fechaInicioInput', configInicio);

        const configFin: any = {
          locale: Spanish,
          dateFormat: "Y-m-d",
          defaultDate: this.nuevoTratamiento?.fechaFin || null,
          minDate: "today",
          maxDate: fechaMaxima,
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            if (this.nuevoTratamiento) {
              this.nuevoTratamiento.fechaFin = dateStr;
              this.cdr.detectChanges();
            }
          }
        };
        flatpickr('#fechaFinInput', configFin);

      }, 50);
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

  async cargarTratamientos() {
    try {
      const data = await firstValueFrom(this.usersService.getTratamientos());
      this.tratamientosTodo = data || [];
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar tratamientos:', error);
      this.tratamientosTodo = [];
    }
  }

  async cargarCatalogosAuxiliares() {
    try {
      const users = await firstValueFrom(this.usersService.getUsuariosBackend());
      this.listaPacientes = (users || []).filter((u: any) => u.rol && u.rol.toLowerCase() === 'paciente');

      const meds = await firstValueFrom(this.usersService.getMedicamentos());
      this.listaMedicamentos = meds || [];

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar catálogos en tratamientos:', error);
    }
  }

  get tratamientosFiltrados() {
    if (!this.searchTerm) return this.tratamientosTodo;
    const term = this.searchTerm.toLowerCase();
    return this.tratamientosTodo.filter(t => {
      const pacNombre = (t.nombre_paciente || t.nombrepaciente || '').toLowerCase();
      const pacAp = (t.appaternopaciente || '').toLowerCase();
      const medNombre = (t.nombre_medicamento || t.nombremedicamento || '').toLowerCase();
      const dosisText = (t.dosis || '').toLowerCase();

      return pacNombre.includes(term) ||
        pacAp.includes(term) ||
        medNombre.includes(term) ||
        dosisText.includes(term);
    });
  }

  get pacientesFiltradosModal() {
    let result = this.listaPacientes;
    if (this.filtroPacienteModal) {
      const term = this.filtroPacienteModal.toLowerCase();
      result = this.listaPacientes.filter(p => {
        const apP = p.apPaterno || p.appaterno || '';
        const apM = p.apMaterno || p.apmaterno || '';
        const nombreCompleto = `${p.nombre || ''} ${apP} ${apM}`.toLowerCase();
        return nombreCompleto.includes(term);
      });
    }
    return result.slice(0, 2);
  }

  get medicamentosFiltradosModal() {
    let result = this.listaMedicamentos;
    if (this.filtroMedicamentoModal) {
      const term = this.filtroMedicamentoModal.toLowerCase();
      result = this.listaMedicamentos.filter(m => {
        const nombreCompleto = `${m.nombrecomercial || m.NombreComercial || ''} ${m.sustanciaactiva || m.SustanciaActiva || ''}`.toLowerCase();
        return nombreCompleto.includes(term);
      });
    }
    return result.slice(0, 2);
  }

  seleccionarPacienteModal(p: any) {
    const apP = p.apPaterno || p.appaterno || '';
    const apM = p.apMaterno || p.apmaterno || '';
    this.nuevoTratamiento.idPaciente = p.idusuario ?? p.id;
    this.filtroPacienteModal = `${p.nombre} ${apP} ${apM}`.trim();
    this.mostrarDropdownPacientes = false;
  }

  seleccionarMedicamentoModal(m: any) {
    this.nuevoTratamiento.idMedicamento = m.idmedicamento;
    this.filtroMedicamentoModal = `${m.nombrecomercial || m.NombreComercial} (${m.sustanciaactiva || m.SustanciaActiva || 'N/A'})`.trim();
    this.mostrarDropdownMedicamentos = false;
  }

  ocultarDropdownPacientes() {
    setTimeout(() => {
      this.mostrarDropdownPacientes = false;
      this.cdr.detectChanges();
    }, 200);
  }

  ocultarDropdownMedicamentos() {
    setTimeout(() => {
      this.mostrarDropdownMedicamentos = false;
      this.cdr.detectChanges();
    }, 200);
  }

  get tratamientosPaginados() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.tratamientosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const totalPaginas = Math.ceil(this.tratamientosFiltrados.length / this.itemsPorPagina);
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  seleccionarTratamiento(t: any) {
    this.tratamientoSeleccionado = { ...t };
  }

  abrirDetalle(t: any) {
    if (!this.verificarPermiso('editar')) {
      this.lanzarNotificacion('No tienes permisos para realizar modificaciones.', 'error');
      return;
    }
    this.router.navigate(['/tratamientos/editar', t.idtratamiento || t.id], {
      state: { tratamiento: t }
    });
  }

  abrirCrear() {
    if (!this.verificarPermiso('crear')) {
      this.lanzarNotificacion('Tu rol no cuenta con permisos para crear nuevos tratamientos.', 'error');
      return;
    }
    this.nuevoTratamiento = {
      idPaciente: null,
      idMedicamento: null,
      idDoctor: null,
      dosis: '',
      frecuenciaHoras: null,
      fechaInicio: '',
      fechaFin: '',
      notasInstrucciones: '',
      activo: true
    };
    this.filtroPacienteModal = '';
    this.filtroMedicamentoModal = '';
    this.mostrarModalCrear = true;
    this.cdr.detectChanges();
    this.inicializarCalendario();
  }

  async guardarNuevoTratamiento() {
    if (!this.verificarPermiso('crear')) {
      this.lanzarNotificacion('Operación rechazada debido a tus restricciones de rol.', 'error');
      return;
    }

    const idPac = this.nuevoTratamiento.idPaciente ? parseInt(this.nuevoTratamiento.idPaciente, 10) : null;
    const idMed = this.nuevoTratamiento.idMedicamento ? parseInt(this.nuevoTratamiento.idMedicamento, 10) : null;
    const dosisLimpia = (this.nuevoTratamiento.dosis || '').trim();
    const frec = this.nuevoTratamiento.frecuenciaHoras ? parseInt(this.nuevoTratamiento.frecuenciaHoras, 10) : null;
    const fInicio = this.nuevoTratamiento.fechaInicio;
    const fFin = this.nuevoTratamiento.fechaFin;

    if (!idPac || !idMed || !dosisLimpia || !frec || isNaN(frec) || !fInicio || !fFin) {
      this.lanzarNotificacion('Faltan datos obligatorios. Paciente, Medicamento, Dosis, Frecuencia y Fechas son requeridos.', 'warning');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const payload = {
        idPaciente: idPac,
        idMedicamento: idMed,
        idDoctor: this.nuevoTratamiento.idDoctor ? parseInt(this.nuevoTratamiento.idDoctor, 10) : null,
        dosis: dosisLimpia,
        frecuenciaHoras: frec, // <- CORREGIDO: Se cambió de 'frecuenciaHours' a 'frecuenciaHoras' para cumplir con la interfaz del servicio
        fechaInicio: fInicio,
        fechaFin: fFin,
        notasInstrucciones: (this.nuevoTratamiento.notasInstrucciones || '').trim(),
        activo: this.nuevoTratamiento.activo === true || this.nuevoTratamiento.activo === 'true'
      };

      await firstValueFrom(this.usersService.crearTratamiento(payload));
      await this.cargarTratamientos();
      this.cerrarModal();
      this.lanzarNotificacion('¡Éxito! El tratamiento ha sido registrado correctamente.', 'success');
    } catch (error: any) {
      console.error('Error al guardar tratamiento:', error);
      const backendMessage = error.error?.error || 'No se pudo registrar el tratamiento.';
      this.lanzarNotificacion(backendMessage, 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  abrirEliminar() {
    if (!this.verificarPermiso('eliminar')) {
      this.lanzarNotificacion('No cuentas con permisos para eliminar registros.', 'error');
      return;
    }
    if (!this.tratamientoSeleccionado) {
      this.lanzarNotificacion('Selecciona un tratamiento de la tabla primero.', 'warning');
      return;
    }
    this.mostrarModalDelete = true;
  }

  async confirmarEliminar() {
    if (!this.verificarPermiso('eliminar')) {
      this.lanzarNotificacion('Acción denegada por permisos de seguridad.', 'error');
      return;
    }
    if (!this.tratamientoSeleccionado) return;
    this.isDeleting = true;
    this.cdr.detectChanges();
    try {
      const id = this.tratamientoSeleccionado.idtratamiento || this.tratamientoSeleccionado.id;
      await firstValueFrom(this.usersService.eliminarTratamiento(id));
      await this.cargarTratamientos();
      this.cerrarModal();
      this.tratamientoSeleccionado = null;
      this.lanzarNotificacion('El tratamiento ha sido eliminado con éxito.', 'success');
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      const backendMessage = error.error?.error || 'No se pudo eliminar el tratamiento.';
      this.lanzarNotificacion(backendMessage, 'error');
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModal() {
    this.mostrarModalCrear = false;
    this.mostrarModalDelete = false;
    this.cdr.detectChanges();
  }
}