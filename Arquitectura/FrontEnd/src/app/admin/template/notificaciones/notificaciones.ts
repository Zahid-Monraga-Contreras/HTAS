import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Menu } from "../menu/menu";
import { Users } from '../../../auth/services/users';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, Menu],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.css',
})
export class Notificaciones implements OnInit, OnDestroy {
  public usersService = inject(Users);
  private cdr = inject(ChangeDetectorRef);
  private userSub!: Subscription;

  rolUsuario: string = '';
  loading: boolean = false;

  // Listas de datos reales extraídas desde el servicio Users
  registrosUsuarios: any[] = [];
  alertasMedicas: any[] = [];
  notificacionesPaciente: any[] = [];
  notificacionesAcompanante: any[] = [];

  ngOnInit() {
    this.userSub = this.usersService.currentUser$.subscribe(user => {
      if (!user) {
        this.usersService.cargarSesionPersistente();
        return;
      }

      // Normalizamos la asignación del rol conservando el valor real
      this.rolUsuario = user.rol;
      this.cargarNotificacionesDeServicio(user);
    });
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  cargarNotificacionesDeServicio(user: any) {
    this.loading = true;
    const rolLower = (this.rolUsuario || '').toLowerCase();

    // Médicos y Administradores visualizan globalmente todas las alertas del sistema
    if (rolLower === 'doctor' || rolLower === 'medico' || rolLower === 'administrador' || rolLower === 'admin') {

      // 1. Cargar todos los usuarios registrados del sistema
      this.usersService.getRegistrosUsuarios().subscribe({
        next: (res) => {
          this.registrosUsuarios = res || [];
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Error al obtener usuarios en panel de control:', err)
      });

      // 2. Cargar todas las alertas (Citas, tratamientos, medicamentos y dispositivos)
      this.usersService.getAlertasMedicas().subscribe({
        next: (res) => {
          this.alertasMedicas = res || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al obtener alertas del sistema:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }

    else if (rolLower === 'paciente') {
      this.usersService.getNotificacionesPaciente(user.correo || user.Email).subscribe({
        next: (res) => {
          this.notificacionesPaciente = res || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al obtener alertas del paciente:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }

    else if (rolLower === 'acompañante' || rolLower === 'acompanante') {
      this.usersService.getNotificacionesAcompanante(user.uid || user.IdUsuario).subscribe({
        next: (res) => {
          this.notificacionesAcompanante = res || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al obtener alertas del acompañante:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Selectores CSS dinámicos basados en la Paleta de Colores de HTAS
  obtenerIconoClase(tipo: string): string {
    if (!tipo) return 'bg-secondary';
    const t = tipo.toLowerCase();
    if (t.includes('cita')) return 'bg-blue';
    if (t.includes('tratamiento')) return 'bg-purple';
    if (t.includes('dispositivo')) return 'bg-orange';
    if (t.includes('medicamento') || t.includes('toma')) return 'bg-green';
    if (t.includes('asign') || t.includes('acompañante')) return 'bg-red';
    return 'bg-secondary';
  }

  obtenerIconoNotificacion(tipo: string): string {
    if (!tipo) return 'bi bi-bell-fill';
    const t = tipo.toLowerCase();
    if (t.includes('cita')) return 'bi bi-calendar-event-fill';
    if (t.includes('tratamiento')) return 'bi bi-capsules';
    if (t.includes('dispositivo')) return 'bi bi-cpu-fill';
    if (t.includes('medicamento') || t.includes('toma')) return 'bi bi-droplet-fill';
    if (t.includes('asign') || t.includes('acompañante')) return 'bi bi-person-heart';
    return 'bi bi-bell-fill';
  }
}