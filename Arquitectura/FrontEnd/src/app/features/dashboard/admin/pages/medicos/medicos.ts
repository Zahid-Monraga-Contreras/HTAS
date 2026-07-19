import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { FormsModule } from '@angular/forms';
import { GoogleService } from '../../../../../core/services/google.service';
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-medicos',
  standalone: true,
  imports: [Menu, CommonModule, FormsModule],
  templateUrl: './medicos.html',
  styleUrl: './medicos.css',
})
export class Medicos implements OnInit {
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
        fuente: 'Firebase',
        // Buscamos todas las variantes posibles que vienen del login/registro
        direccionClinica: u.direccionClinica || u.direccion || u.Direccion || 'No registrada',
        especialidad: u.especialidad || u.Especialidad || 'General',
        telefono: u.telefono || u.Telefono || 'Sin teléfono'
      }));

      const backendNormalizado = usersBackend.map(u => ({
        ...u,
        id: u.idusuario || u.id,
        NombreCompleto: u.NombreCompleto || `${u.nombre || ''} ${u.apPaterno || u.appaterno || ''} ${u.apMaterno || u.apmaterno || ''}`.trim(),
        fuente: 'Postgres',
        direccionClinica: u.direccionClinica || u.direccion || u.Direccion || 'No registrada',
        especialidad: u.especialidad || u.Especialidad || 'General',
        telefono: u.telefono || u.Telefono || 'Sin teléfono'
      }));

      this.usuariosTodo = [...firebaseNormalizado, ...backendNormalizado].filter(u => {
        const rol = (u.rol || u.Rol || '').toLowerCase();
        return rol.includes('médico') || rol.includes('medico') || rol.includes('doctor');
      });

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar médicos:', error);
    }
  }

  get usuariosFiltrados() {
    if (!this.searchTerm) return this.usuariosTodo;
    const term = this.searchTerm.toLowerCase();
    return this.usuariosTodo.filter(u =>
      u.NombreCompleto?.toLowerCase().includes(term) ||
      u.correo?.toLowerCase().includes(term) ||
      u.especialidad?.toLowerCase().includes(term) ||
      u.direccionClinica?.toLowerCase().includes(term)
    );
  }

  get usuariosPaginados() {
    const inicio = this.paginaActual * this.itemsPorPagina;
    return this.usuariosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  seleccionar(u: any) {
    this.usuarioSeleccionado = { ...u };
    const nombreCompleto = u.NombreCompleto || u.nombre || '';
    const partes = nombreCompleto.trim().split(/\s+/);

    if (partes.length >= 3) {
      this.usuarioSeleccionado.tempApellidoMaterno = partes.pop();
      this.usuarioSeleccionado.tempApellidoPaterno = partes.pop();
      this.usuarioSeleccionado.tempNombre = partes.join(' ');
    } else if (partes.length === 2) {
      this.usuarioSeleccionado.tempNombre = partes[0];
      this.usuarioSeleccionado.tempApellidoPaterno = partes[1];
      this.usuarioSeleccionado.tempApellidoMaterno = '';
    } else {
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
      this.router.navigate(['/medicos/editar', id], { state: { usuario: this.usuarioSeleccionado } });
    }
  }

  abrirEliminar() { this.mostrarModalDelete = true; }

  cerrarModal() {
    this.mostrarModalDelete = false;
    this.usuarioSeleccionado = null;
  }

  cambiarPagina(delta: number) {
    this.paginaActual += delta;
    this.usuarioSeleccionado = null;
  }

  async confirmarEliminar() {
    if (!this.usuarioSeleccionado) return;
    this.isDeleting = true;

    // Identificamos el ID real dependiendo de si viene de Firebase o Postgres
    const idFinal = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;

    try {
      if (this.usuarioSeleccionado.fuente === 'Firebase') {
        await this.googleService.deleteUsuario(idFinal);
      } else {
        // Usamos firstValueFrom para la petición al backend de Node
        await firstValueFrom(this.usersService.deleteUsuario(idFinal));
      }

      console.log('Usuario eliminado:', idFinal);
      this.cerrarModal();
      await this.cargarUsuarios(); // Recarga la lista para que desaparezca de la tabla

    } catch (error: any) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar: ' + (error.error?.detail || error.message));
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }
}