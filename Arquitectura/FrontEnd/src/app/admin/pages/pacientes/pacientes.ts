import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { FormsModule } from '@angular/forms';
import { GoogleService } from '../../../auth/services/google';
import { Users } from '../../../auth/services/users';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [Menu, CommonModule, FormsModule],
  templateUrl: './pacientes.html',
  styleUrl: './pacientes.css',
})
export class Pacientes implements OnInit {
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
        NombreCompleto: u.NombreCompleto || u.nombre || 'Paciente de Google',
        fuente: 'Firebase'
      }));

      const backendNormalizado = usersBackend.map(u => {
        // ESTA ES LA PARTE CRÍTICA: 
        // PostgreSQL suele devolver minúsculas (appaterno) aunque en la DB sea ApPaterno
        const p = u.apPaterno || u.appaterno || '';
        const m = u.apMaterno || u.apmaterno || '';
        const n = u.nombre || '';

        return {
          ...u,
          id: u.idusuario || u.id,
          nombre: n,
          apPaterno: p,
          apMaterno: m,
          // Al asignar appaterno (minúscula), aseguramos compatibilidad
          appaterno: p,
          apmaterno: m,
          NombreCompleto: u.NombreCompleto || `${n} ${p} ${m}`.trim(),
          nss: u.nss || u.NSS || '',
          fuente: 'Postgres'
        };
      });

      this.usuariosTodo = [...firebaseNormalizado, ...backendNormalizado].filter(u =>
        (u.rol || u.Rol || '').toLowerCase() === 'paciente'
      );

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
    }
  }

  get usuariosFiltrados() {
    if (!this.searchTerm) return this.usuariosTodo;
    const term = this.searchTerm.toLowerCase();
    return this.usuariosTodo.filter(u =>
      u.NombreCompleto?.toLowerCase().includes(term) ||
      u.correo?.toLowerCase().includes(term) ||
      (u.nss && u.nss.toString().includes(term))
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
    // Creamos la copia
    this.usuarioSeleccionado = { ...u };

    if (u.fuente === 'Postgres') {
      // IMPORTANTE: Buscamos todas las variantes posibles que vienen del Backend
      this.usuarioSeleccionado.tempNombre = u.nombre || '';

      // Aquí está el truco: usamos los nombres que tú mismo definiste en la normalización o los que vienen de la DB
      this.usuarioSeleccionado.tempApellidoPaterno = u.apPaterno || u.appaterno || '';
      this.usuarioSeleccionado.tempApellidoMaterno = u.apMaterno || u.apmaterno || '';

      // Aseguramos que el NSS también se mapee al campo del modal
      this.usuarioSeleccionado.nss = u.nss || '';
    } else {
      // Lógica de Firebase (Split)
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

    this.cdr.detectChanges(); // Forzamos a Angular a ver el cambio
  }

  toggleExpand(id: string, event: Event) {
    event.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }

  abrirEditar() { 
    if (this.usuarioSeleccionado) {
      const id = this.usuarioSeleccionado.idusuario || this.usuarioSeleccionado.id;
      this.router.navigate(['/pacientes/editar', id], { state: { usuario: this.usuarioSeleccionado } });
    }
  }
  
  abrirEliminar() { this.mostrarModalDelete = true; }

  async confirmarEliminar() {
    if (!this.usuarioSeleccionado) return;
    this.isDeleting = true;
    const id = this.usuarioSeleccionado.id;
    const fuente = this.usuarioSeleccionado.fuente;

    try {
      if (fuente === 'Firebase') {
        await this.googleService.deleteUsuario(id);
      } else {
        await firstValueFrom(this.usersService.deleteUsuario(id));
      }
      this.cerrarModal();
      await this.cargarUsuarios();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('No se pudo eliminar el registro.');
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModal() {
    this.mostrarModalDelete = false;
    this.isDeleting = false;
  }
}