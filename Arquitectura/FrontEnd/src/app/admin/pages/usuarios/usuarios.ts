import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Menu } from "../../template/menu/menu";
import { FormsModule } from '@angular/forms';
import { GoogleService } from '../../../auth/services/google';
import { Users } from '../../../auth/services/users';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [Menu, CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios implements OnInit {
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);

  usuariosTodo: any[] = [];
  searchTerm: string = '';
  expandedId: string | null = null;

  // Paginación
  paginaActual = 0;
  itemsPorPagina = 10;

  // Selección y Modal removidos para vista de solo lectura

  async ngOnInit() {
    await this.cargarUsuarios();
  }

  // usuarios.ts

  async cargarUsuarios() {
    try {
      // 1. Ejecutamos ambas peticiones en paralelo.
      // Usamos firstValueFrom para "esperar" el valor del Observable de HttpClient.
      const [resFirebase, resPostgres] = await Promise.all([
        this.googleService.getUsuarios(),
        firstValueFrom(this.usersService.getUsuariosBackend())
      ]);

      // 2. Unificamos y normalizamos los datos
      // resPostgres ahora ya es un arreglo y no un Observable
      this.usuariosTodo = [
        ...this.normalizarUsuarios(resFirebase, 'Firebase'),
        ...this.normalizarUsuarios(resPostgres, 'Postgres')
      ];

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al unificar usuarios de Firebase y Postgres:', error);
    }
  }

  private normalizarUsuarios(users: any[], origen: string) {
    if (!users) return [];

    return users.map((u, index) => {
      const idUnico = u.idusuario || u.uid || u.id || u.ID_Usuario || `${origen}-${index}`;

      // 1. Extraemos el nombre base
      const soloNombre = u.nombre || u.Nombre || '';

      // 2. Extraemos apellidos (AGREGAMOS apPaterno y apMaterno que vienen de tu SQL)
      const apellidoP = u.apPaterno || u.apellido_paterno || u.ApellidoPaterno || '';
      const apellidoM = u.apMaterno || u.apellido_materno || u.ApellidoMaterno || '';

      // 3. Unificamos
      // Si viene de Firebase (NombreCompleto), lo respetamos, si no, unimos piezas
      const nombreFinal = u.NombreCompleto
        ? u.NombreCompleto
        : `${soloNombre} ${apellidoP} ${apellidoM}`.trim() || 'Sin nombre';

      return {
        ...u,
        id: idUnico,
        nombre: nombreFinal, // <--- Este es el campo que usaremos en el HTML
        correo: u.correo || u.Correo || u.email || 'Sin correo',
        fuente: origen
      };
    });
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
    }
  }

  toggleExpand(id: string, event: Event) {
    event.stopPropagation();
    this.expandedId = this.expandedId === id ? null : id;
  }
}