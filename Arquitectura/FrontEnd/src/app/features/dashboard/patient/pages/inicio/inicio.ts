import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { PatientMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-patient-inicio',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PatientMenu
  ],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class PatientInicio implements OnInit {
  private usersService = inject(Users);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  isLoading = true;
  patientName = '';
  patientFullName = '';
  patientId: number | null = null;
  userEmail: string = '';

  metrics = {
    totalCitas: 0,
    citasPendientes: 0,
    medicamentosActivos: 0,
    tratamientosActivos: 0,
    dispositivosVinculados: 0
  };

  citasRecientes: any[] = [];
  medicamentosActuales: any[] = [];
  tratamientosActivos: any[] = [];

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      this.isLoading = true;

      const storedUser = localStorage.getItem('user_htas');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          this.patientId = userData.idusuario || userData.uid || null;
          this.patientName = userData.nombre || 'Paciente';
          this.patientFullName = userData.nombreCompleto || userData.nombre || 'Paciente';
          this.userEmail = userData.correo || '';
        } catch (e) {
          // Error al parsear localStorage
        }
      }

      if (!this.patientId || this.patientFullName === this.patientName) {
        const user = this.auth.currentUser;
        if (user) {
          this.userEmail = user.email || '';
          this.patientName = user.displayName || 'Paciente';

          try {
            const allUsers = await firstValueFrom(
              this.usersService.getUsuariosBackend()
            );

            if (Array.isArray(allUsers) && allUsers.length > 0) {
              const foundUser = allUsers.find((u: any) =>
                u.correo?.toLowerCase() === this.userEmail.toLowerCase()
              );

              if (foundUser) {
                this.patientId = foundUser.idusuario || foundUser.id || foundUser.uid || null;
                this.patientName = foundUser.nombre || this.patientName;

                const nombre = foundUser.nombre || '';
                const apPaterno = foundUser.apPaterno || '';
                const apMaterno = foundUser.apMaterno || '';
                this.patientFullName = `${nombre} ${apPaterno} ${apMaterno}`.trim() || this.patientName;

                this.userEmail = foundUser.correo || this.userEmail;

                if (this.patientId) {
                  const updatedUser = {
                    idusuario: this.patientId,
                    nombre: this.patientName,
                    nombreCompleto: this.patientFullName,
                    correo: this.userEmail,
                    uid: user.uid,
                    rol: foundUser.rol || 'Paciente',
                    apPaterno: apPaterno,
                    apMaterno: apMaterno
                  };
                  localStorage.setItem('user_htas', JSON.stringify(updatedUser));
                }
              }
            }
          } catch (error) {
            // Error al obtener usuarios del backend
          }
        }
      }

      if (this.patientFullName === this.patientName && this.patientName !== 'Paciente') {
        const storedUser = localStorage.getItem('user_htas');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            const nombre = userData.nombre || this.patientName;
            const apPaterno = userData.apPaterno || '';
            const apMaterno = userData.apMaterno || '';
            const fullName = `${nombre} ${apPaterno} ${apMaterno}`.trim();
            if (fullName !== nombre) {
              this.patientFullName = fullName;
            }
          } catch (e) {
            // Error al parsear localStorage
          }
        }
      }

      if (this.patientId) {
        await this.cargarDatos(this.patientId);
      } else if (this.userEmail) {
        await this.cargarDatosPorEmail(this.userEmail);
      }

    } catch (error) {
      // Error general
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private async cargarDatos(idPaciente: number) {
    try {
      let todasLasCitas: any[] = [];
      try {
        todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());
      } catch (error) {
        // Error al obtener citas
      }

      let tratamientos: any[] = [];
      try {
        tratamientos = await firstValueFrom(this.usersService.getTratamientosByPaciente(idPaciente));
      } catch (error) {
        // Error al obtener tratamientos
      }

      let medicamentos: any[] = [];
      try {
        medicamentos = await firstValueFrom(this.usersService.getMedicamentos());
      } catch (error) {
        // Error al obtener medicamentos
      }

      let dispositivos: any[] = [];
      try {
        dispositivos = await firstValueFrom(this.usersService.getDispositivosByPaciente(idPaciente));
      } catch (error) {
        // Error al obtener dispositivos
      }

      let citasPaciente: any[] = [];

      if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
        citasPaciente = todasLasCitas.filter((c: any) => {
          const emailPaciente = (c.correopaciente || c.correoPaciente || c.email || '').toLowerCase().trim();
          const emailUsuario = this.userEmail.toLowerCase().trim();
          return emailPaciente === emailUsuario;
        });

        if (citasPaciente.length === 0 && this.patientName) {
          citasPaciente = todasLasCitas.filter((c: any) => {
            const nombrePaciente = (c.nombrepaciente || c.paciente || '').toLowerCase().trim();
            return nombrePaciente === this.patientName.toLowerCase().trim();
          });
        }

        if (citasPaciente.length > 0) {
          this.procesarCitas(citasPaciente);
        }
      }

      if (Array.isArray(medicamentos) && medicamentos.length > 0) {
        this.medicamentosActuales = medicamentos.slice(0, 4);
        this.metrics.medicamentosActivos = medicamentos.length;
      }

      if (Array.isArray(tratamientos) && tratamientos.length > 0) {
        const activos = tratamientos.filter((t: any) => t.activo !== false && t.activo !== 0);
        this.metrics.tratamientosActivos = activos.length;
        this.tratamientosActivos = activos.slice(0, 3);
      }

      if (Array.isArray(dispositivos)) {
        const activos = dispositivos.filter((d: any) => d.activo !== false);
        this.metrics.dispositivosVinculados = activos.length;
      }

    } catch (error) {
      // Error al cargar datos
    }
  }

  private async cargarDatosPorEmail(email: string) {
    try {
      const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

      if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
        const citasPaciente = todasLasCitas.filter((c: any) => {
          const emailPaciente = (c.correopaciente || c.correoPaciente || c.email || '').toLowerCase().trim();
          return emailPaciente === email.toLowerCase().trim();
        });

        if (citasPaciente.length > 0) {
          this.procesarCitas(citasPaciente);

          const medicamentos = await firstValueFrom(this.usersService.getMedicamentos());
          if (Array.isArray(medicamentos) && medicamentos.length > 0) {
            this.medicamentosActuales = medicamentos.slice(0, 4);
            this.metrics.medicamentosActivos = medicamentos.length;
          }
        }
      }
    } catch (error) {
      // Error cargando por email
    }
  }

  private procesarCitas(citas: any[]) {
    if (!Array.isArray(citas) || citas.length === 0) return;

    this.metrics.totalCitas = citas.length;

    const pendientes = citas.filter((c: any) => {
      const estado = (c.estado || '').toLowerCase();
      return ['pendiente', 'programada', 'confirmada', 'agendada'].includes(estado);
    });

    this.metrics.citasPendientes = pendientes.length;

    const ahora = new Date();
    this.citasRecientes = citas
      .filter((c: any) => {
        const estado = (c.estado || '').toLowerCase();
        if (['cancelada', 'finalizada', 'completada'].includes(estado)) return false;
        const fechaCita = new Date(c.fechacita || c.fecha || c.fechaCita);
        return fechaCita >= ahora;
      })
      .sort((a: any, b: any) => {
        const fechaA = new Date(a.fechacita || a.fecha || a.fechaCita);
        const fechaB = new Date(b.fechacita || b.fecha || b.fechaCita);
        return fechaA.getTime() - fechaB.getTime();
      })
      .slice(0, 4);
  }

  obtenerMes(fecha: string): string {
    if (!fecha) return '';
    try {
      const d = new Date(fecha);
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return meses[d.getMonth()] || '';
    } catch {
      return '';
    }
  }

  obtenerDia(fecha: string): string {
    if (!fecha) return '??';
    try {
      const d = new Date(fecha);
      return d.getDate().toString().padStart(2, '0');
    } catch {
      return '??';
    }
  }

  getEstadoClass(estado: string): string {
    if (!estado) return 'badge-info';
    const estadoLower = estado.toLowerCase();
    switch (estadoLower) {
      case 'completada':
      case 'realizada':
      case 'finalizada':
        return 'badge-success';
      case 'programada':
      case 'pendiente':
      case 'confirmada':
      case 'agendada':
        return 'badge-warning';
      case 'cancelada':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  }

  getProgresoColor(progreso: number): string {
    if (progreso >= 75) return 'success';
    if (progreso >= 50) return 'warning';
    return 'danger';
  }

  verDetalleCita(cita: any) {
    const idCita = cita.idcita || cita.id || cita.IdCita;
    if (idCita) {
      this.router.navigate(['/patient/citas']);
    } else {
      this.router.navigate(['/patient/citas']);
    }
  }
}