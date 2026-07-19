import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Menu } from "../menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Subscription, forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';

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
  loading: boolean = true;
  emailUsuario: string = '';

  // Listas de datos
  registrosUsuarios: any[] = [];
  citas: any[] = [];
  tratamientos: any[] = [];
  medicamentos: any[] = [];
  dispositivos: any[] = [];
  notificacionesPaciente: any[] = [];
  notificacionesAcompanante: any[] = [];

  ngOnInit() {
    this.userSub = this.usersService.currentUser$.subscribe(async user => {
      if (!user) {
        this.usersService.cargarSesionPersistente();
        return;
      }

      this.rolUsuario = user.rol || '';
      this.emailUsuario = user.correo || user.Email || '';
      this.loading = true;

      await this.cargarNotificacionesPorRol(user);
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  async cargarNotificacionesPorRol(user: any) {
    const rolLower = (this.rolUsuario || '').toLowerCase();

    try {
      // ============================================
      // ROL: DOCTOR / MEDICO
      // ============================================
      if (rolLower === 'doctor' || rolLower === 'medico') {
        // Cargar todos los datos en paralelo
        const [usuarios, citasData, tratamientosData, medicamentosData, dispositivosData] = await Promise.all([
          firstValueFrom(this.usersService.getUsuariosBackend()).catch(() => []),
          firstValueFrom(this.usersService.getAllCitas()).catch(() => []),
          firstValueFrom(this.usersService.getTratamientos()).catch(() => []),
          firstValueFrom(this.usersService.getMedicamentos()).catch(() => []),
          firstValueFrom(this.usersService.getDispositivos()).catch(() => [])
        ]);

        this.registrosUsuarios = usuarios || [];
        this.citas = this.formatearCitas(citasData || []);
        this.tratamientos = tratamientosData || [];
        this.medicamentos = medicamentosData || [];
        this.dispositivos = dispositivosData || [];
      }

      // ============================================
      // ROL: PACIENTE
      // ============================================
      else if (rolLower === 'paciente') {
        // Cargar citas del paciente y medicamentos
        const [citasData, medicamentosData] = await Promise.all([
          firstValueFrom(this.usersService.getMisCitas(this.emailUsuario)).catch(() => []),
          firstValueFrom(this.usersService.getMedicamentos()).catch(() => [])
        ]);

        this.notificacionesPaciente = this.formatearCitasPaciente(citasData || []);
        this.medicamentos = medicamentosData || [];
      }

      // ============================================
      // ROL: ACOMPAÑANTE
      // ============================================
      else if (rolLower === 'acompañante' || rolLower === 'acompanante') {
        const [notificaciones] = await Promise.all([
          firstValueFrom(this.usersService.getNotificacionesAcompanante(user.uid || user.idusuario || user.id)).catch(() => [])
        ]);

        this.notificacionesAcompanante = notificaciones || [];
      }

      // ============================================
      // ROL: ADMINISTRADOR
      // ============================================
      else if (rolLower === 'administrador' || rolLower === 'admin') {
        const [usuarios, citasData, tratamientosData, medicamentosData, dispositivosData] = await Promise.all([
          firstValueFrom(this.usersService.getUsuariosBackend()).catch(() => []),
          firstValueFrom(this.usersService.getAllCitas()).catch(() => []),
          firstValueFrom(this.usersService.getTratamientos()).catch(() => []),
          firstValueFrom(this.usersService.getMedicamentos()).catch(() => []),
          firstValueFrom(this.usersService.getDispositivos()).catch(() => [])
        ]);

        this.registrosUsuarios = usuarios || [];
        this.citas = this.formatearCitas(citasData || []);
        this.tratamientos = tratamientosData || [];
        this.medicamentos = medicamentosData || [];
        this.dispositivos = dispositivosData || [];
      }

    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    }
  }

  // ============================================
  // FORMATEADORES DE DATOS
  // ============================================

  formatearCitas(citasData: any[]): any[] {
    return citasData.map((c: any) => {
      let fechaFormateada = 'Sin fecha';
      if (c.fechacita) {
        try {
          const fechaISO = c.fechacita.includes('T') ? c.fechacita.split('T')[0] : c.fechacita;
          const partes = fechaISO.split('-');
          if (partes.length === 3) {
            fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
        } catch (e) {
          fechaFormateada = c.fechacita;
        }
      }

      return {
        id: c.idcita || c.id,
        fecha: fechaFormateada,
        hora: c.horacita ? c.horacita.substring(0, 5) : 'S/H',
        motivo: c.motivo || 'Consulta Médica',
        paciente: `${c.nombrepaciente || ''} ${c.appaternopaciente || ''}`.trim() || 'Paciente',
        estado: c.estado || 'Programada',
        modalidad: c.modalidad || 'Presencial'
      };
    });
  }

  formatearCitasPaciente(citasData: any[]): any[] {
    return citasData.map((c: any) => {
      let fechaFormateada = 'Sin fecha';
      if (c.fechacita) {
        try {
          const fechaISO = c.fechacita.includes('T') ? c.fechacita.split('T')[0] : c.fechacita;
          const partes = fechaISO.split('-');
          if (partes.length === 3) {
            fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
        } catch (e) {
          fechaFormateada = c.fechacita;
        }
      }

      return {
        id: c.idcita || c.id,
        tipo: 'Cita Médica',
        mensaje: `${c.motivo || 'Consulta'} - ${c.estado || 'Programada'}`,
        fecha: fechaFormateada,
        hora: c.horacita ? c.horacita.substring(0, 5) : 'S/H',
        estado: c.estado || 'Programada',
        doctor: `${c.nombremedico || ''} ${c.appaternomedico || ''}`.trim() || 'Médico'
      };
    });
  }

  // ============================================
  // UTILIDADES PARA ICONOS
  // ============================================

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

  getEstadoClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'confirmada':
      case 'activa':
      case 'programada':
        return 'badge-success';
      case 'pendiente':
        return 'badge-warning';
      case 'cancelada':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  }
}