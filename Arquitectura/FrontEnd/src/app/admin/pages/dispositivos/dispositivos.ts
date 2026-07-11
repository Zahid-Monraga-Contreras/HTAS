import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Menu } from "../../template/menu/menu";
import { Users } from '../../../auth/services/users';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-dispositivos',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './dispositivos.html',
  styleUrl: './dispositivos.css'
})
export class Dispositivos implements OnInit, OnDestroy {
  private router = inject(Router);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  dispositivosTodo: any[] = [];
  pacientesLista: any[] = [];
  searchTerm: string = '';
  currentUser: any = null;

  paginaActual = 0;
  itemsPorPagina = 10;

  dispositivoSeleccionado: any = null;
  mostrarModalFormulario = false;
  mostrarModalDelete = false;
  isSaving = false;
  isDeleting = false;

  dispositivoForm: any = {
    idDispositivo: null,
    nombre: '',
    direccionMac: '',
    idPacienteAsociado: null,
    activo: true
  };

  filtroPacienteModal: string = '';
  mostrarDropdownPacientes = false;

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('user_htas');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        console.log("Usuario actual cargado:", this.currentUser);
      }
      await this.cargarDispositivos();
      await this.cargarPacientesAuxiliares();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * ✅ VERIFICAR PERMISOS SEGÚN ROL
   */
  verificarPermiso(accion: 'crear' | 'editar' | 'eliminar' | 'ver' | 'medir' | 'editarPaciente'): boolean {
    if (!this.currentUser || !this.currentUser.rol) return false;

    const rol = this.currentUser.rol.toLowerCase().trim();
    const esAdmin = rol === 'administrador' || rol === 'admin';
    const esMedico = rol === 'medico' || rol === 'doctor';
    const esPaciente = rol === 'paciente';
    const esAcompanante = rol === 'acompañante';

    switch (accion) {
      case 'crear':
        return esAdmin || esMedico;
      case 'editar':
        // Acompañante puede editar nombre y datos básicos, pero no el paciente vinculado
        return esAdmin || esMedico || esAcompanante;
      case 'editarPaciente':
        // Solo admin y médico pueden cambiar el paciente vinculado
        return esAdmin || esMedico;
      case 'eliminar':
        return esAdmin || esMedico;
      case 'ver':
        return esAdmin || esMedico || esPaciente || esAcompanante;
      case 'medir':
        // Paciente, médico y admin pueden medir, acompañante NO
        return esAdmin || esMedico || esPaciente;
      default:
        return false;
    }
  }

  /**
   * ✅ OBTENER NOMBRE COMPLETO DEL PACIENTE
   */
  getNombreCompletoPaciente(dispositivo: any): string {
    if (!dispositivo) return 'Sin vincular';

    const nombre = dispositivo.nombrepaciente || '';
    const apPaterno = dispositivo.appaternopaciente || '';
    const apMaterno = dispositivo.apmaternopaciente || '';

    const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
    return nombreCompleto || 'Sin vincular';
  }

  getNombreCompletoPacienteObj(paciente: any): string {
    if (!paciente) return 'Paciente sin nombre';

    const nombre = paciente.nombre || '';
    const apPaterno = paciente.appaterno || paciente.apPaterno || '';
    const apMaterno = paciente.apmaterno || paciente.apMaterno || '';

    const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim();
    return nombreCompleto || 'Paciente sin nombre';
  }

  getNombrePacienteSeleccionado(): string {
    if (!this.dispositivoForm.idPacienteAsociado) return 'Sin paciente';

    const paciente = this.pacientesLista.find(
      p => p.idusuario === this.dispositivoForm.idPacienteAsociado
    );

    if (paciente) {
      return this.getNombreCompletoPacienteObj(paciente);
    }

    return 'Paciente no encontrado';
  }

  desvincularPaciente() {
    // Solo admin y médico pueden desvincular
    if (!this.verificarPermiso('editarPaciente')) {
      this.lanzarNotificacion('No tienes permiso para modificar el paciente vinculado.', 'error');
      return;
    }
    this.dispositivoForm.idPacienteAsociado = null;
    this.filtroPacienteModal = '';
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

  async cargarDispositivos() {
    try {
      const data = await firstValueFrom(this.usersService.getDispositivos());
      this.dispositivosTodo = data || [];
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar dispositivos:', error);
      this.dispositivosTodo = [];
      this.lanzarNotificacion('Error al conectar con el servidor de dispositivos.', 'error');
    }
  }

  async cargarPacientesAuxiliares() {
    try {
      const users = await firstValueFrom(this.usersService.getUsuariosBackend());
      this.pacientesLista = (users || []).filter((u: any) => u.rol && u.rol.toLowerCase() === 'paciente');
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar catálogo de pacientes:', error);
    }
  }

  get dispositivosFiltrados() {
    if (!this.searchTerm) return this.dispositivosTodo;
    const term = this.searchTerm.toLowerCase();
    return this.dispositivosTodo.filter(d =>
      d.nombre?.toLowerCase().includes(term) ||
      d.direccionmac?.toLowerCase().includes(term) ||
      d.nombrepaciente?.toLowerCase().includes(term) ||
      d.appaternopaciente?.toLowerCase().includes(term)
    );
  }

  get dispositivosPaginados() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.dispositivosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const totalPaginas = Math.ceil(this.dispositivosFiltrados.length / this.itemsPorPagina);
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  seleccionarDispositivo(d: any) {
    this.dispositivoSeleccionado = { ...d };
  }

  /**
   * ✅ IR A DETALLE - SEGÚN PERMISO
   */
  irADetalle(dispositivo: any) {
    if (!dispositivo) {
      this.lanzarNotificacion('Por favor, selecciona un dispositivo.', 'warning');
      return;
    }

    // Si es paciente, solo puede ver y medir
    if (this.currentUser?.rol?.toLowerCase() === 'paciente') {
      this.router.navigate(['/dispositivos/editar', dispositivo.iddispositivo], {
        state: {
          dispositivo: dispositivo,
          modo: 'paciente'  // Modo solo lectura + botón medir
        }
      });
      return;
    }

    // Si es acompañante, puede ver y editar (pero no cambiar paciente vinculado)
    if (this.currentUser?.rol?.toLowerCase() === 'acompañante') {
      this.router.navigate(['/dispositivos/editar', dispositivo.iddispositivo], {
        state: {
          dispositivo: dispositivo,
          modo: 'acompanante'  // Modo edición limitada
        }
      });
      return;
    }

    // Admin y médico: edición completa
    this.router.navigate(['/dispositivos/editar', dispositivo.iddispositivo], {
      state: {
        dispositivo: dispositivo,
        modo: 'editar'  // Modo edición completa
      }
    });
  }

  seleccionarPacienteModal(p: any) {
    // Solo admin y médico pueden seleccionar paciente
    if (!this.verificarPermiso('editarPaciente')) {
      this.lanzarNotificacion('No tienes permiso para vincular pacientes.', 'error');
      return;
    }
    this.dispositivoForm.idPacienteAsociado = p.idusuario;
    this.filtroPacienteModal = this.getNombreCompletoPacienteObj(p);
    this.mostrarDropdownPacientes = false;
    this.cdr.detectChanges();
  }

  get pacientesFiltradosModal() {
    let result = this.pacientesLista;
    if (this.filtroPacienteModal) {
      const term = this.filtroPacienteModal.toLowerCase();
      result = this.pacientesLista.filter(p => {
        const nombreCompleto = this.getNombreCompletoPacienteObj(p).toLowerCase();
        return nombreCompleto.includes(term);
      });
    }
    return result.slice(0, 5);
  }

  ocultarDropdownPacientes() {
    setTimeout(() => {
      this.mostrarDropdownPacientes = false;
      this.cdr.detectChanges();
    }, 200);
  }

  abrirCrear() {
    if (!this.verificarPermiso('crear')) {
      this.lanzarNotificacion('Tu rol no cuenta con permisos para registrar dispositivos.', 'error');
      return;
    }

    this.dispositivoForm = {
      idDispositivo: null,
      nombre: '',
      direccionMac: '',
      idPacienteAsociado: null,
      activo: true
    };
    this.filtroPacienteModal = '';
    this.mostrarModalFormulario = true;
    this.cdr.detectChanges();
  }

  async guardarDispositivo() {
    if (!this.verificarPermiso('crear')) {
      this.lanzarNotificacion('Operación rechazada debido a tus restricciones de rol.', 'error');
      return;
    }

    if (!this.dispositivoForm.nombre.trim() || !this.dispositivoForm.direccionMac.trim()) {
      this.lanzarNotificacion('Nombre y MAC son obligatorios.', 'warning');
      return;
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^[A-Z0-9-]{5,20}$/;
    if (!macRegex.test(this.dispositivoForm.direccionMac)) {
      this.lanzarNotificacion('Formato no válido. Use MAC estándar o Serie.', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      await firstValueFrom(this.usersService.crearDispositivo(this.dispositivoForm));
      this.lanzarNotificacion('¡Éxito! El dispositivo ha sido registrado correctamente.', 'success');
      await this.cargarDispositivos();
      this.cerrarModal();
      this.dispositivoSeleccionado = null;
    } catch (error) {
      console.error('Error al registrar dispositivo:', error);
      this.lanzarNotificacion('Error en el registro. Verifique los datos.', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  abrirEliminar() {
    if (!this.verificarPermiso('eliminar')) {
      this.lanzarNotificacion('Tu rol no cuenta con permisos para eliminar dispositivos.', 'error');
      return;
    }
    if (!this.dispositivoSeleccionado) {
      this.lanzarNotificacion('Selecciona un dispositivo de la tabla primero.', 'warning');
      return;
    }
    this.mostrarModalDelete = true;
  }

  async confirmarEliminar() {
    if (!this.verificarPermiso('eliminar')) return;

    if (!this.dispositivoSeleccionado) return;
    this.isDeleting = true;
    try {
      const id = this.dispositivoSeleccionado.iddispositivo;
      await firstValueFrom(this.usersService.eliminarDispositivo(id));
      await this.cargarDispositivos();
      this.cerrarModal();
      this.dispositivoSeleccionado = null;
      this.lanzarNotificacion('El dispositivo ha sido eliminado correctamente.', 'success');
    } catch (error) {
      console.error('Error al eliminar:', error);
      this.lanzarNotificacion('No se pudo eliminar el dispositivo.', 'error');
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModal() {
    this.mostrarModalFormulario = false;
    this.mostrarModalDelete = false;
    this.mostrarDropdownPacientes = false;
  }
}