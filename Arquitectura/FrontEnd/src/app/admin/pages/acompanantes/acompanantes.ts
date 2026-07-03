import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { FormsModule } from '@angular/forms';
import { GoogleService } from '../../../auth/services/google';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import { Users } from '../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-acompanantes',
  imports: [Menu, CommonModule, FormsModule],
  templateUrl: './acompanantes.html',
  styleUrl: './acompanantes.css',
})
export class Acompanantes implements OnInit {
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  usuariosTodo: any[] = [];
  searchTerm: string = '';
  expandedId: string | null = null;

  // Paginación
  paginaActual = 0;
  itemsPorPagina = 10;

  // Selección y Modal
  usuarioSeleccionado: any = null;
  mostrarModalDelete = false;
  isDeleting = false;

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.cargarUsuarios();
    }
  }

  async cargarUsuarios() {
    try {
      const usersFirebase = await this.googleService.getUsuarios();
      const usersBackend = await firstValueFrom(this.usersService.getUsuariosBackend());

      const firebaseNormalizado = usersFirebase.map(u => ({
        ...u,
        id: u.id || u.uid,
        NombreCompleto: u.NombreCompleto || u.nombre || 'Usuario de Google',
        fuente: 'Firebase'
      }));

      const backendNormalizado = usersBackend.map(u => {

        let fechaFormateada = "";
        if (u.fechaAsignacion || u.fecha_asignacion) {
          const f = u.fechaAsignacion || u.fecha_asignacion;
          fechaFormateada = f.toString().split('T')[0]; // Corta en la 'T' de la zona horaria
        } return {
          ...u,
          id: u.idusuario || u.id,
          // Usamos los campos exactos que viste en consola
          NombreCompleto: u.NombreCompleto || `${u.nombre || ''} ${u.apPaterno || u.appaterno || ''} ${u.apMaterno || u.apmaterno || ''}`.trim(),
          fechaAsignacion: fechaFormateada,
          fuente: 'Postgres'
        };
      });

      // REASIGNACIÓN TOTAL (Esto dispara la detección de cambios de Angular)
      this.usuariosTodo = [...firebaseNormalizado, ...backendNormalizado].filter(u =>
        (u.rol || u.Rol || '').toLowerCase() === 'acompañante'
      );

      console.log('Lista actualizada en memoria:', this.usuariosTodo);
      this.cdr.detectChanges(); // Forzamos el renderizado

    } catch (error) {
      console.error('Error al cargar:', error);
    }
  }

  get usuariosFiltrados() {
    if (!this.searchTerm) return this.usuariosTodo;
    const term = this.searchTerm.toLowerCase();
    return this.usuariosTodo.filter(u =>
      u.NombreCompleto?.toLowerCase().includes(term) ||
      u.nombre?.toLowerCase().includes(term) ||
      u.correo?.toLowerCase().includes(term) ||
      u.telefono?.toLowerCase().includes(term)
    );
  }

  get usuariosPaginados() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.usuariosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const totalPaginas = Math.ceil(this.usuariosFiltrados.length / this.itemsPorPagina);
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 0 && nuevaPagina < totalPaginas) {
      this.paginaActual = nuevaPagina;
      this.usuarioSeleccionado = null;
    }
  }

  seleccionar(u: any) {
    this.usuarioSeleccionado = { ...u }; // Creamos una copia para editar

    // Separar el nombre completo en partes
    const nombreCompleto = u.NombreCompleto || u.nombre || '';
    const partes = nombreCompleto.trim().split(/\s+/);

    if (partes.length >= 3) {
      // Caso ideal: Nombre(s) ApellidoPaterno ApellidoMaterno
      this.usuarioSeleccionado.tempApellidoMaterno = partes.pop();
      this.usuarioSeleccionado.tempApellidoPaterno = partes.pop();
      this.usuarioSeleccionado.tempNombre = partes.join(' ');
    } else if (partes.length === 2) {
      // Caso: Nombre Apellido
      this.usuarioSeleccionado.tempNombre = partes[0];
      this.usuarioSeleccionado.tempApellidoPaterno = partes[1];
      this.usuarioSeleccionado.tempApellidoMaterno = '';
    } else {
      // Caso: Solo un nombre o vacío
      this.usuarioSeleccionado.tempNombre = nombreCompleto;
      this.usuarioSeleccionado.tempApellidoPaterno = '';
      this.usuarioSeleccionado.tempApellidoMaterno = '';
    }
  }

  toggleExpand(id: string, event: Event) {
    event.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }

  abrirEditar() {
    if (this.usuarioSeleccionado) {
      const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;
      this.router.navigate(['/acompanantes/editar', id], { state: { usuario: this.usuarioSeleccionado } });
    }
  }

  abrirEliminar() {
    this.mostrarModalDelete = true;
  }

  async confirmarEliminar() {
    if (!this.usuarioSeleccionado) return;

    this.isDeleting = true;
    const id = this.usuarioSeleccionado.id;
    const fuente = this.usuarioSeleccionado.fuente;

    // Guardar copia para revertir si falla
    const usuariosCopia = [...this.usuariosTodo];
    this.usuariosTodo = this.usuariosTodo.filter(u => u.id !== id);
    this.cdr.detectChanges();

    try {
      // ELIMINACIÓN SEGÚN LA FUENTE (Esto evita el error de Firebase)
      if (fuente === 'Firebase') {
        await this.googleService.deleteUsuario(id);
      } else {
        // Llama a .delete(`${apiUrl}/delete-user/${id}`)
        await firstValueFrom(this.usersService.deleteUsuario(id));
      }

      console.log(`Usuario eliminado de ${fuente}`);
      this.cerrarModal();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('No se pudo eliminar el registro. Reintentando sincronización...');
      this.usuariosTodo = usuariosCopia; // Revertimos la lista si falló
    } finally {
      this.isDeleting = false;
      this.usuarioSeleccionado = null;
      this.cdr.detectChanges();
    }
  }

  cerrarModal() {
    this.mostrarModalDelete = false;
    this.isDeleting = false;
  }
}
