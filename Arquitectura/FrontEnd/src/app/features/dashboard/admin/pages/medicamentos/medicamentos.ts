import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Menu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-medicamentos',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './medicamentos.html',
  styleUrl: './medicamentos.css'
})
export class Medicamentos implements OnInit, OnDestroy {
  private router = inject(Router);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  medicamentosTodo: any[] = [];
  searchTerm: string = '';

  // Paginacion
  paginaActual = 0;
  itemsPorPagina = 10;

  // Variables de control operacionales
  canAdd: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false;

  // Seleccion y modales
  medicamentoSeleccionado: any = null;
  mostrarModalCrear = false;
  mostrarModalDelete = false;
  isSaving = false;
  isDeleting = false;

  nuevoMedicamento: any = {
    nombreComercial: '',
    sustanciaActiva: '',
    presentacion: '',
    concentracion: '',
    laboratorio: '',
    indicacionesGenerales: ''
  };

  // Notificaciones Toast
  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.establecerPermisosPorRol();
      await this.cargarMedicamentos();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Evalua de forma estricta la matriz de accesos requerida.
   * Con depuracion exhaustiva para identificar el problema.
   */
  private async establecerPermisosPorRol() {
    try {
      const uService = this.usersService as any;
      let rolUsuario = 'invitado';
      let usuario = null;

      console.log('=== INICIANDO DETECCION DE ROL ===');

      // 1. Intentar obtener del Subject
      if (uService.currentUserSubject && uService.currentUserSubject.value) {
        usuario = uService.currentUserSubject.value;
        console.log('Usuario completo del Subject:', usuario);
        rolUsuario = (usuario.rol || 'invitado').toLowerCase();
        console.log('Rol obtenido del Subject:', rolUsuario);
      }
      // 2. Si no esta en el Subject, intentar desde localStorage
      else {
        const saved = localStorage.getItem('user_htas');
        console.log('user_htas en localStorage:', saved);

        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            console.log('Usuario completo del localStorage:', parsed);
            rolUsuario = (parsed.rol || 'invitado').toLowerCase();
            console.log('Rol obtenido del localStorage:', rolUsuario);
          } catch (e) {
            console.error('Error al parsear user_htas:', e);
          }
        } else {
          console.warn('No se encontro user_htas en localStorage');
        }
      }

      // 3. Si aun no tenemos rol, intentar obtenerlo desde el Observable currentUser$
      if (rolUsuario === 'invitado') {
        try {
          const userData = await firstValueFrom(this.usersService.currentUser$);
          console.log('Usuario del currentUser$:', userData);
          if (userData && (userData as any).rol) {
            rolUsuario = (userData as any).rol.toLowerCase();
            console.log('Rol obtenido del currentUser$:', rolUsuario);
          }
        } catch (error) {
          console.warn('No se pudo obtener el usuario del currentUser$:', error);
        }
      }

      // 4. VERIFICACION ADICIONAL: Intentar obtener el rol de otras posibles ubicaciones
      console.log('Verificando otras posibles ubicaciones de rol...');

      // Verificar si hay un rol en sessionStorage
      const sessionRol = sessionStorage.getItem('user_rol');
      if (sessionRol) {
        console.log('Rol en sessionStorage:', sessionRol);
        if (rolUsuario === 'invitado') {
          rolUsuario = sessionRol.toLowerCase();
        }
      }

      // Verificar si hay un rol en otra clave de localStorage
      const otherKeys = ['rol', 'userRole', 'currentUser'];
      otherKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          console.log('Valor en localStorage[' + key + ']:', value);
        }
      });

      // 5. REGLA PRINCIPAL: Asignar permisos segun el rol
      console.log('Rol final detectado:', rolUsuario);

      // Lista de roles que tienen permisos completos (incluyendo variantes)
      const rolesConPermisosCompletos = ['administrador', 'admin', 'doctor', 'medico'];

      // Verificar si el rol esta en la lista (case insensitive)
      const tienePermisos = rolesConPermisosCompletos.some(r =>
        rolUsuario.toLowerCase() === r.toLowerCase()
      );

      console.log('Tiene permisos completos?', tienePermisos);

      if (tienePermisos) {
        this.canAdd = true;
        this.canEdit = true;
        this.canDelete = true;
        console.log('Usuario con rol "' + rolUsuario + '" tiene PERMISOS COMPLETOS (Crear, Editar, Eliminar)');
      } else {
        // Paciente, Acompanante e Invitado: solo lectura
        this.canAdd = false;
        this.canEdit = false;
        this.canDelete = false;
        console.log('Usuario con rol "' + rolUsuario + '" tiene PERMISOS DE SOLO LECTURA');
      }

      console.log('Estado final de permisos:', {
        canAdd: this.canAdd,
        canEdit: this.canEdit,
        canDelete: this.canDelete
      });

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al establecer permisos:', error);
      // En caso de error, establecer permisos restrictivos por seguridad
      this.canAdd = false;
      this.canEdit = false;
      this.canDelete = false;
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

  async cargarMedicamentos() {
    try {
      const data = await firstValueFrom(this.usersService.getMedicamentos());
      this.medicamentosTodo = data || [];
      console.log('Medicamentos cargados:', this.medicamentosTodo.length);
    } catch (error) {
      console.error('Error al cargar medicamentos:', error);
      this.medicamentosTodo = [];
      this.lanzarNotificacion('Error al cargar los medicamentos', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  get medicamentosFiltrados() {
    if (!this.searchTerm) return this.medicamentosTodo;
    const term = this.searchTerm.toLowerCase();
    return this.medicamentosTodo.filter(m => {
      const nom = (m.nombreComercial || m.nombrecomercial || '').toLowerCase();
      const sust = (m.sustanciaActiva || m.sustanciaactiva || '').toLowerCase();
      const lab = (m.laboratorio || '').toLowerCase();
      return nom.includes(term) || sust.includes(term) || lab.includes(term);
    });
  }

  get medicamentosPaginados() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.medicamentosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get totalPaginas() {
    return Math.ceil(this.medicamentosFiltrados.length / this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < this.totalPaginas) {
      this.paginaActual = nuevaPagina;
      this.cdr.detectChanges();
    }
  }

  seleccionarMedicamento(m: any) {
    // Si no tiene permisos de edicion ni borrado, no permitimos activar la seleccion visual
    if (!this.canEdit && !this.canDelete) {
      console.log('Sin permisos para seleccionar medicamento');
      return;
    }

    this.medicamentoSeleccionado = { ...m };
    this.cdr.detectChanges();
    console.log('Medicamento seleccionado:', this.medicamentoSeleccionado?.nombreComercial || this.medicamentoSeleccionado?.nombrecomercial);
  }

  abrirDetalle(m: any) {
    if (!this.canEdit) {
      console.log('Sin permisos para editar medicamento');
      this.lanzarNotificacion('No tienes permisos para editar medicamentos', 'warning');
      return;
    }

    const id = m.IdMedicamento || m.idmedicamento || m.id;
    console.log('Navegando a editar medicamento ID:', id);
    this.router.navigate(['/medicamentos/editar', id], {
      state: { medicamento: m }
    });
  }

  abrirCrear() {
    if (!this.canAdd) {
      console.log('Sin permisos para crear medicamento');
      this.lanzarNotificacion('No tienes permisos para crear medicamentos', 'warning');
      return;
    }

    this.nuevoMedicamento = {
      nombreComercial: '',
      sustanciaActiva: '',
      presentacion: '',
      concentracion: '',
      laboratorio: '',
      indicacionesGenerales: ''
    };
    this.mostrarModalCrear = true;
    this.cdr.detectChanges();
    console.log('Abriendo modal de creacion');
  }

  async guardarNuevoMedicamento() {
    if (!this.canAdd) {
      this.lanzarNotificacion('No tienes permisos para realizar esta accion', 'warning');
      return;
    }

    if (!this.nuevoMedicamento.nombreComercial || !this.nuevoMedicamento.nombreComercial.trim()) {
      this.lanzarNotificacion('El nombre comercial del medicamento es obligatorio.', 'warning');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      console.log('Guardando nuevo medicamento:', this.nuevoMedicamento);
      await firstValueFrom(this.usersService.crearMedicamento(this.nuevoMedicamento));
      await this.cargarMedicamentos();
      this.cerrarModal();
      this.lanzarNotificacion('Exito! El medicamento ha sido registrado correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar medicamento:', error);
      this.lanzarNotificacion('No se pudo registrar el medicamento. Revisa la consola.', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  abrirEliminar() {
    if (!this.canDelete) {
      console.log('Sin permisos para eliminar medicamento');
      this.lanzarNotificacion('No tienes permisos para eliminar medicamentos', 'warning');
      return;
    }

    if (!this.medicamentoSeleccionado) {
      this.lanzarNotificacion('Selecciona un medicamento de la tabla primero.', 'warning');
      return;
    }
    this.mostrarModalDelete = true;
    this.cdr.detectChanges();
    console.log('Abriendo modal de eliminacion');
  }

  async confirmarEliminar() {
    if (!this.canDelete || !this.medicamentoSeleccionado) {
      this.lanzarNotificacion('No tienes permisos para realizar esta accion', 'warning');
      return;
    }

    this.isDeleting = true;
    this.cdr.detectChanges();

    try {
      const id = this.medicamentoSeleccionado.IdMedicamento ||
        this.medicamentoSeleccionado.idmedicamento ||
        this.medicamentoSeleccionado.id;

      console.log('Eliminando medicamento ID:', id);
      await firstValueFrom(this.usersService.eliminarMedicamento(id));
      await this.cargarMedicamentos();
      this.cerrarModal();
      this.medicamentoSeleccionado = null;
      this.lanzarNotificacion('El medicamento ha sido eliminado.', 'success');
    } catch (error) {
      console.error('Error al eliminar medicamento:', error);
      this.lanzarNotificacion('No se pudo eliminar el medicamento debido a dependencias en la base de datos.', 'error');
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