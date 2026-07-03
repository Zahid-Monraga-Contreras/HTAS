import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Menu } from "../../template/menu/menu";
import { Users } from '../../../auth/services/users';
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

  // Paginación
  paginaActual = 0;
  itemsPorPagina = 10;

  // Variables de control operacionales
  canAdd: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false;

  // Selección y modales
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
      this.establecerPermisosPorRol();
      await this.cargarMedicamentos();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  /**
   * Evalúa de forma estricta la matriz de accesos requerida.
   * Modificado para admitir al rol de 'administrador'.
   */
  private establecerPermisosPorRol() {
    const uService = this.usersService as any;
    let rolUsuario = 'invitado';

    if (uService.currentUserSubject && uService.currentUserSubject.value) {
      rolUsuario = (uService.currentUserSubject.value.rol || 'invitado').toLowerCase();
    } else {
      const saved = localStorage.getItem('user_htas');
      if (saved) {
        const parsed = JSON.parse(saved);
        rolUsuario = (parsed.rol || 'invitado').toLowerCase();
      }
    }

    // Regla del sistema: Tanto Médico como Administrador gestionan completamente medicamentos
    if (rolUsuario === 'doctor' || rolUsuario === 'medico' || rolUsuario === 'administrador') {
      this.canAdd = true;
      this.canEdit = true;
      this.canDelete = true;
    } else {
      // Paciente, Acompañante e Invitado quedan en modo Solo Visualizar
      this.canAdd = false;
      this.canEdit = false;
      this.canDelete = false;
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

  async cargarMedicamentos() {
    try {
      const data = await firstValueFrom(this.usersService.getMedicamentos());
      this.medicamentosTodo = data || [];
    } catch (error) {
      console.error('Error al cargar medicamentos:', error);
      this.medicamentosTodo = [];
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

  cambiarPagina(delta: number) {
    const totalPaginas = Math.ceil(this.medicamentosFiltrados.length / this.itemsPorPagina);
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      this.paginaActual = nuevaPagina;
      this.cdr.detectChanges();
    }
  }

  seleccionarMedicamento(m: any) {
    // Si no tiene permisos de edición ni borrado, no permitimos activar la selección visual
    if (!this.canEdit && !this.canDelete) return;

    this.medicamentoSeleccionado = { ...m };
    this.cdr.detectChanges();
  }

  abrirDetalle(m: any) {
    if (!this.canEdit) return;
    const id = m.IdMedicamento || m.idmedicamento || m.id;
    this.router.navigate(['/medicamentos/editar', id], {
      state: { medicamento: m }
    });
  }

  abrirCrear() {
    if (!this.canAdd) return;
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
  }

  async guardarNuevoMedicamento() {
    if (!this.canAdd) return;
    if (!this.nuevoMedicamento.nombreComercial || !this.nuevoMedicamento.nombreComercial.trim()) {
      this.lanzarNotificacion('El nombre comercial del medicamento es obligatorio.', 'warning');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      await firstValueFrom(this.usersService.crearMedicamento(this.nuevoMedicamento));
      await this.cargarMedicamentos();
      this.cerrarModal();
      this.lanzarNotificacion('¡Éxito! El medicamento ha sido registrado correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar medicamento en componente:', error);
      this.lanzarNotificacion('No se pudo registrar el medicamento. Revisa la consola.', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  abrirEliminar() {
    if (!this.canDelete) return;
    if (!this.medicamentoSeleccionado) {
      this.lanzarNotificacion('Selecciona un medicamento de la tabla primero.', 'warning');
      return;
    }
    this.mostrarModalDelete = true;
    this.cdr.detectChanges();
  }

  async confirmarEliminar() {
    if (!this.canDelete || !this.medicamentoSeleccionado) return;
    this.isDeleting = true;
    this.cdr.detectChanges();

    try {
      const id = this.medicamentoSeleccionado.IdMedicamento || this.medicamentoSeleccionado.idmedicamento || this.medicamentoSeleccionado.id;
      await firstValueFrom(this.usersService.eliminarMedicamento(id));
      await this.cargarMedicamentos();
      this.cerrarModal();
      this.medicamentoSeleccionado = null;
      this.lanzarNotificacion('El medicamento ha sido eliminado.', 'success');
    } catch (error) {
      console.error('Error al eliminar en componente:', error);
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