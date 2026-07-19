import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Menu } from '../../template/menu/menu';
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, Menu],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
})
export class Configuracion implements OnInit, OnDestroy {
  private usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  currentUser: any = null;
  isSaving = false;

  // Solo dejamos los datos modificables de la tabla USUARIOS
  perfilEdit: any = {
    id: '',
    nombre: '',
    apPaterno: '',
    apMaterno: '',
    correo: '',
    telefono: '',
    genero: '',
    rol: '',
    activo: true
  };

  mostrarToast = false;
  mensajeToast = '';
  tipoToast: 'success' | 'error' | 'warning' = 'success';
  private toastTimeout: any = null;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarDatosPerfil();
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  cargarDatosPerfil() {
    const saved = localStorage.getItem('user_htas');
    if (saved) {
      this.currentUser = JSON.parse(saved);

      this.perfilEdit = {
        id: this.currentUser.uid || this.currentUser.idusuario || this.currentUser.id || '',
        nombre: this.currentUser.nombre || '',
        apPaterno: this.currentUser.apPaterno || this.currentUser.appaterno || '',
        apMaterno: this.currentUser.apMaterno || this.currentUser.apmaterno || '',
        correo: this.currentUser.correo || this.currentUser.email || '',
        telefono: this.currentUser.telefono || '',
        genero: this.currentUser.genero || 'Masculino',
        rol: this.currentUser.rol || 'Paciente',
        activo: this.currentUser.activo !== undefined ? this.currentUser.activo : true
      };

      this.cdr.detectChanges();
    }
  }

  async guardarCambiosPerfil() {
    if (!this.perfilEdit.nombre.trim() || !this.perfilEdit.apPaterno.trim() || !this.perfilEdit.correo.trim()) {
      this.lanzarNotificacion('El nombre, apellido paterno y correo son obligatorios.', 'warning');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    // Payload limpio: Solo campos de la tabla USUARIOS
    const payload = {
      idusuario: Number(this.perfilEdit.id) || this.perfilEdit.id,
      nombre: this.perfilEdit.nombre.trim(),
      apPaterno: this.perfilEdit.apPaterno.trim(),
      apMaterno: this.perfilEdit.apMaterno ? this.perfilEdit.apMaterno.trim() : null,
      correo: this.perfilEdit.correo.trim(),
      telefono: this.perfilEdit.telefono ? String(this.perfilEdit.telefono).trim() : null,
      genero: this.perfilEdit.genero || 'Masculino',
      activo: this.perfilEdit.activo,
      rol: this.perfilEdit.rol // Se envía para mantener consistencia en el backend
    };

    try {
      await firstValueFrom(this.usersService.updateUsuario(this.perfilEdit.id, payload));

      // Sincronizamos localstorage manteniendo compatibilidad de formatos
      const sesionActualizada = {
        ...this.currentUser,
        ...payload,
        idusuario: payload.idusuario,
        uid: payload.idusuario,
        email: payload.correo,
        appaterno: payload.apPaterno,
        apmaterno: payload.apMaterno,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.nombre)}&background=b0001e&color=fff&bold=true`
      };

      localStorage.setItem('user_htas', JSON.stringify(sesionActualizada));
      this.currentUser = sesionActualizada;

      this.lanzarNotificacion('¡Datos personales actualizados correctamente!', 'success');
    } catch (error) {
      console.error('Error al actualizar la configuración básica en HTAS:', error);
      this.lanzarNotificacion('Error del Servidor: No se pudieron guardar los cambios.', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
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
}