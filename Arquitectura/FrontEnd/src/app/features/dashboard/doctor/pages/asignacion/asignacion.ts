// ============================================
// pages/doctor/asignacion/asignacion.ts
// ============================================

import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DoctorMenu } from '../../template/menu/menu';
import { Users } from '../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-asignacion',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, DoctorMenu],
    templateUrl: './asignacion.html',
    styleUrls: ['./asignacion.css']
})
export class DoctorAsignacion implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    notifications: ToastNotification[] = [];
    private toastIdCounter = 0;

    cargandoPacientes = false;
    desasignando = false;

    pacientesAsignados: any[] = [];
    pacientesFiltrados: any[] = [];
    busquedaPaciente = '';
    pacientesSeleccionados: number[] = [];

    mensaje = '';
    mensajeClase = '';
    resultadosDesasignacion: any[] = [];

    get totalDesasignados(): number {
        return this.resultadosDesasignacion.filter(r => r.exitoso).length;
    }

    get totalFallidos(): number {
        return this.resultadosDesasignacion.filter(r => !r.exitoso).length;
    }

    usuarioActual: any = null;
    doctorId: number | null = null;

    ngOnInit(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarUsuarioActual();
        this.cargarMisPacientes();
    }

    cargarUsuarioActual() {
        const userData = localStorage.getItem('user_htas');
        if (userData) {
            try {
                this.usuarioActual = JSON.parse(userData);
                this.doctorId = this.usuarioActual?.idusuario ||
                    this.usuarioActual?.IdUsuario ||
                    this.usuarioActual?.id ||
                    this.usuarioActual?.uid ||
                    null;

                if (this.doctorId && typeof this.doctorId === 'string') {
                    this.doctorId = parseInt(this.doctorId, 10);
                }

                if (!this.doctorId) {
                    this.mostrarToast('error', 'Error', 'No se pudo identificar al doctor');
                }
            } catch (e) {
                this.mostrarToast('error', 'Error', 'Error al cargar datos del usuario');
            }
        }
    }

    async cargarMisPacientes() {
        if (!this.doctorId) {
            this.mostrarToast('error', 'Error', 'Doctor no identificado');
            return;
        }

        this.cargandoPacientes = true;
        try {
            const response = await firstValueFrom(
                this.usersService.getPacientesDeDoctor(this.doctorId)
            );

            let pacientesData: any[] = [];

            if (response && typeof response === 'object') {
                if (response.hasOwnProperty('success') && response.hasOwnProperty('data')) {
                    pacientesData = (response as any).data || [];
                } else if (Array.isArray(response)) {
                    pacientesData = response;
                } else {
                    for (const key in response) {
                        if (Array.isArray((response as any)[key])) {
                            pacientesData = (response as any)[key];
                            break;
                        }
                    }
                }
            } else if (Array.isArray(response)) {
                pacientesData = response;
            }

            if (pacientesData && pacientesData.length > 0) {
                this.pacientesAsignados = pacientesData.map((p: any) => ({
                    IdUsuario: p.id_usuario || p.IdUsuario || p.idusuario || p.id || 0,
                    Nombre: p.nombre || p.Nombre || 'Paciente',
                    ApPaterno: p.apellido_paterno || p.ap_paterno || p.ApPaterno || p.appaterno || '',
                    ApMaterno: p.apellido_materno || p.ap_materno || p.ApMaterno || p.apmaterno || '',
                    Correo: p.correo || p.Correo || '',
                    NSS: p.nss || p.NSS || '',
                    TipoSangre: p.tipo_sangre || p.TipoSangre || p.tiposangre || 'No especificado',
                    AsignacionActiva: true,
                    IdDoctorAsignado: this.doctorId
                }));

                this.pacientesFiltrados = [...this.pacientesAsignados];
                this.mostrarToast('success', 'Pacientes cargados',
                    'Tienes ' + this.pacientesAsignados.length + ' paciente(s) asignado(s)');
            } else {
                await this.cargarPacientesAlternativo();
            }
        } catch (error: any) {
            try {
                await this.cargarPacientesAlternativo();
            } catch (e) {
                this.mostrarToast('error', 'Error', error.message || 'Error al cargar pacientes');
            }
        } finally {
            this.cargandoPacientes = false;
            this.cdr.detectChanges();
        }
    }

    async cargarPacientesAlternativo() {
        const response = await firstValueFrom(this.usersService.getTodosLosPacientes());

        let todosLosPacientes: any[] = [];

        if (response && typeof response === 'object') {
            if (response.hasOwnProperty('success') && response.hasOwnProperty('data')) {
                const data = (response as any).data;
                todosLosPacientes = Array.isArray(data) ? data : [];
            } else if (Array.isArray(response)) {
                todosLosPacientes = response;
            } else {
                for (const key in response) {
                    if (Array.isArray((response as any)[key])) {
                        todosLosPacientes = (response as any)[key];
                        break;
                    }
                }
            }
        } else if (Array.isArray(response)) {
            todosLosPacientes = response;
        }

        const doctorIdNum = Number(this.doctorId);

        this.pacientesAsignados = todosLosPacientes
            .filter((p: any) => {
                const idDoctorAsignado = p.doctorasignado || p.DoctorAsignado || p.iddoctorasignado || p.IdDoctorAsignado || null;
                const asignado = p.asignacionactiva === true || p.AsignacionActiva === true;

                if (asignado && idDoctorAsignado !== null && idDoctorAsignado !== undefined) {
                    const idNum = Number(idDoctorAsignado);
                    return idNum === doctorIdNum;
                }
                return false;
            })
            .map((p: any) => ({
                IdUsuario: p.idusuario || p.IdUsuario || p.id || 0,
                Nombre: p.nombre || p.Nombre || 'Paciente',
                ApPaterno: p.appaterno || p.ApPaterno || p.apellido_paterno || '',
                ApMaterno: p.apmaterno || p.ApMaterno || p.apellido_materno || '',
                Correo: p.correo || p.Correo || '',
                NSS: p.nss || p.NSS || '',
                TipoSangre: p.tiposangre || p.TipoSangre || p.tipo_sangre || 'No especificado',
                AsignacionActiva: true,
                IdDoctorAsignado: this.doctorId
            }));

        this.pacientesFiltrados = [...this.pacientesAsignados];

        if (this.pacientesAsignados.length === 0) {
            this.mostrarToast('info', 'Sin pacientes', 'No tienes pacientes asignados aún');
        } else {
            this.mostrarToast('success', 'Pacientes cargados',
                'Tienes ' + this.pacientesAsignados.length + ' paciente(s) asignado(s)');
        }
    }

    filtrarPacientes() {
        const term = this.busquedaPaciente.toLowerCase().trim();

        if (!this.pacientesAsignados || this.pacientesAsignados.length === 0) {
            this.pacientesFiltrados = [];
            this.cdr.detectChanges();
            return;
        }

        if (!term) {
            this.pacientesFiltrados = [...this.pacientesAsignados];
            return;
        }

        this.pacientesFiltrados = this.pacientesAsignados.filter(p => {
            const nombreCompleto = (p.Nombre + ' ' + p.ApPaterno + ' ' + (p.ApMaterno || '')).toLowerCase();
            return nombreCompleto.includes(term) ||
                (p.Nombre?.toLowerCase() || '').includes(term) ||
                (p.ApPaterno?.toLowerCase() || '').includes(term) ||
                (p.ApMaterno?.toLowerCase() || '').includes(term) ||
                (p.Correo?.toLowerCase() || '').includes(term) ||
                (p.NSS && p.NSS.toLowerCase().includes(term));
        });

        this.cdr.detectChanges();
    }

    togglePaciente(paciente: any) {
        const index = this.pacientesSeleccionados.indexOf(paciente.IdUsuario);
        if (index > -1) {
            this.pacientesSeleccionados.splice(index, 1);
        } else {
            this.pacientesSeleccionados.push(paciente.IdUsuario);
        }
        this.limpiarMensaje();
        this.cdr.detectChanges();
    }

    async desasignarPacientes() {
        if (this.pacientesSeleccionados.length === 0) {
            this.mostrarToast('warning', 'Selección vacía', 'Selecciona al menos un paciente');
            return;
        }

        if (!this.doctorId) {
            this.mostrarToast('error', 'Error', 'Doctor no identificado');
            return;
        }

        this.desasignando = true;
        this.resultadosDesasignacion = [];
        this.limpiarMensaje();

        try {
            const pacientesSeleccionadosData = this.pacientesAsignados.filter(p =>
                this.pacientesSeleccionados.includes(p.IdUsuario)
            );

            const resultados = [];
            let exitosos = 0;
            let fallidos = 0;

            for (const paciente of pacientesSeleccionadosData) {
                try {
                    const response = await firstValueFrom(
                        this.usersService.desasignarPacienteDeDoctor(paciente.IdUsuario, this.doctorId)
                    );

                    const exito = response?.success || false;
                    resultados.push({
                        ...paciente,
                        exitoso: exito,
                        mensaje: exito ? 'Paciente desasignado correctamente' : (response?.message || 'Error al desasignar')
                    });

                    if (exito) {
                        exitosos++;
                    } else {
                        fallidos++;
                    }
                } catch (error: any) {
                    resultados.push({
                        ...paciente,
                        exitoso: false,
                        mensaje: error.message || 'Error al desasignar'
                    });
                    fallidos++;
                }
            }

            this.resultadosDesasignacion = resultados;

            if (fallidos === 0 && exitosos > 0) {
                this.mostrarToast('success', 'Desasignación completada',
                    exitosos + ' paciente(s) desasignado(s) exitosamente');
                this.pacientesSeleccionados = [];
            } else if (exitosos === 0 && fallidos > 0) {
                this.mostrarToast('error', 'Error', 'No se pudo desasignar ningún paciente');
            } else {
                this.mostrarToast('warning', 'Desasignación parcial',
                    exitosos + ' exitosos, ' + fallidos + ' fallidos');
                // Mantener los pacientes que no se pudieron desasignar
                const fallidosIds = this.resultadosDesasignacion
                    .filter(r => !r.exitoso)
                    .map(r => r.IdUsuario);
                this.pacientesSeleccionados = this.pacientesSeleccionados.filter(id =>
                    fallidosIds.includes(id)
                );
            }

            await this.cargarMisPacientes();

        } catch (error: any) {
            this.mostrarToast('error', 'Error', error.message || 'Error al desasignar pacientes');

            const pacientesSeleccionadosData = this.pacientesAsignados.filter(p =>
                this.pacientesSeleccionados.includes(p.IdUsuario)
            );
            this.resultadosDesasignacion = pacientesSeleccionadosData.map((p: any) => ({
                ...p,
                exitoso: false,
                mensaje: error.message || 'Error al desasignar'
            }));
        } finally {
            this.desasignando = false;
            this.cdr.detectChanges();
        }
    }

    limpiarSeleccion() {
        this.pacientesSeleccionados = [];
        this.resultadosDesasignacion = [];
        this.busquedaPaciente = '';
        this.limpiarMensaje();
        this.filtrarPacientes();
        this.mostrarToast('info', 'Limpiado', 'Selección reiniciada correctamente');
    }

    recargarDatos() {
        this.limpiarSeleccion();
        this.cargarMisPacientes();
        this.mostrarToast('info', 'Recargando', 'Datos actualizados correctamente');
    }

    volver() {
        this.router.navigate(['/doctor/inicio']);
    }

    mostrarMensaje(texto: string, clase: string) {
        this.mensaje = texto;
        this.mensajeClase = clase;
    }

    limpiarMensaje() {
        this.mensaje = '';
        this.mensajeClase = '';
    }

    mostrarToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration: number = 5000) {
        const id = ++this.toastIdCounter;
        this.notifications.push({ id, type, title, message, duration });

        setTimeout(() => {
            this.removeToast(id);
        }, duration);
    }

    removeToast(id: number) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index > -1) {
            const toastElement = document.querySelector('.toast-notification[data-id="' + id + '"]');
            if (toastElement) {
                toastElement.classList.add('toast-exit');
                setTimeout(() => {
                    this.notifications = this.notifications.filter(n => n.id !== id);
                    this.cdr.detectChanges();
                }, 300);
            } else {
                this.notifications = this.notifications.filter(n => n.id !== id);
                this.cdr.detectChanges();
            }
        }
    }

    obtenerIniciales(nombre: string, apPaterno: string): string {
        const first = nombre?.charAt(0) || '';
        const second = apPaterno?.charAt(0) || '';
        return (first + second).toUpperCase();
    }
}