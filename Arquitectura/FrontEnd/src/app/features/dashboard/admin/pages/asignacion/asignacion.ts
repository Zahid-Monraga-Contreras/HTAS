// ============================================
// admin/pages/asignacion/asignacion.ts
// ============================================

import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Menu } from '../../template/menu/menu';
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
    selector: 'app-admin-asignacion',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, Menu],
    templateUrl: './asignacion.html',
    styleUrls: ['./asignacion.css']
})
export class AdminAsignacion implements OnInit, AfterViewInit {
    @ViewChild('sidebar') sidebar!: Menu;

    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    notifications: ToastNotification[] = [];
    private toastIdCounter = 0;
    private intervalId: any = null;

    cargandoDoctores = false;
    cargandoPacientes = false;
    asignando = false;

    doctores: any[] = [];
    doctoresFiltrados: any[] = [];
    busquedaDoctor = '';
    doctorSeleccionado: any = null;

    pacientes: any[] = [];
    pacientesFiltrados: any[] = [];
    busquedaPaciente = '';
    pacientesSeleccionados: number[] = [];
    ocultarAsignados = false;

    mensaje = '';
    mensajeClase = '';
    resultadosAsignacion: any[] = [];

    isCollapsed = false;

    get totalExitosos(): number {
        return this.resultadosAsignacion.filter(r => r.exitoso).length;
    }

    get totalFallidos(): number {
        return this.resultadosAsignacion.filter(r => !r.exitoso).length;
    }

    get hayPacientesAsignadosAOtroDoctor(): boolean {
        if (!this.doctorSeleccionado) return false;
        return this.pacientesSeleccionados.some(idPaciente => {
            const paciente = this.pacientes.find(p => p.IdUsuario === idPaciente);
            return paciente && paciente.AsignacionActiva &&
                paciente.IdDoctorAsignado !== this.doctorSeleccionado.IdUsuario;
        });
    }

    get botonAsignarDeshabilitado(): boolean {
        return !this.doctorSeleccionado ||
            this.pacientesSeleccionados.length === 0 ||
            this.asignando ||
            this.hayPacientesAsignadosAOtroDoctor;
    }

    usuarioActual: any = null;

    ngOnInit(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarUsuarioActual();
        this.cargarDoctores();
        this.cargarPacientes();
    }

    ngAfterViewInit(): void {
        this.intervalId = setInterval(() => {
            this.verificarEstadoMenu();
        }, 300);
    }

    verificarEstadoMenu() {
        if (this.sidebar) {
            const collapsed = (this.sidebar as any).isCollapsed;
            if (this.isCollapsed !== collapsed) {
                this.isCollapsed = collapsed;
                this.cdr.detectChanges();
            }
        } else {
            const menuElement = document.querySelector('app-menu');
            if (menuElement) {
                const hasClass = menuElement.classList.contains('collapsed');
                if (this.isCollapsed !== hasClass) {
                    this.isCollapsed = hasClass;
                    this.cdr.detectChanges();
                }
            }
        }
    }

    ngOnDestroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    cargarUsuarioActual() {
        const userData = localStorage.getItem('user_htas');
        if (userData) {
            this.usuarioActual = JSON.parse(userData);
        }
    }

    async cargarDoctores() {
        this.cargandoDoctores = true;
        try {
            const response = await firstValueFrom(this.usersService.getDoctoresCompletos());

            if (response.success && response.data) {
                this.doctores = response.data.map((d: any) => ({
                    IdUsuario: d.IdUsuario || d.idusuario || d.id || 0,
                    Nombre: d.Nombre || d.nombre || 'Doctor',
                    ApPaterno: d.ApPaterno || d.appaterno || d.apPaterno || '',
                    ApMaterno: d.ApMaterno || d.apmaterno || d.apMaterno || '',
                    Correo: d.Correo || d.correo || '',
                    Especialidad: d.Especialidad || d.especialidad || 'Sin especialidad',
                    Cedula: d.Cedula || d.cedula || '',
                    TotalPacientesAsignados: d.TotalPacientesAsignados || d.totalpacientesasignados || 0
                }));
                this.doctoresFiltrados = [...this.doctores];

                if (this.doctores.length === 0) {
                    this.mostrarToast('info', 'Sin doctores', 'No hay doctores registrados en el sistema');
                }
            } else {
                this.mostrarToast('error', 'Error', response?.error || 'Error al cargar doctores');
            }
        } catch (error: any) {
            this.mostrarToast('error', 'Error', error.message || 'Error al cargar doctores');
        } finally {
            this.cargandoDoctores = false;
            this.cdr.detectChanges();
        }
    }

    async cargarPacientes() {
        this.cargandoPacientes = true;
        try {
            const response = await firstValueFrom(this.usersService.getTodosLosPacientes());

            if (response && response.data) {
                const datos = response.data;

                if (Array.isArray(datos)) {
                    this.pacientes = datos.map((p: any) => ({
                        IdUsuario: p.IdUsuario || p.idusuario || p.id || 0,
                        Nombre: p.Nombre || p.nombre || 'Paciente',
                        ApPaterno: p.ApPaterno || p.appaterno || p.apPaterno || '',
                        ApMaterno: p.ApMaterno || p.apmaterno || p.apMaterno || '',
                        Correo: p.Correo || p.correo || '',
                        NSS: p.NSS || p.nss || '',
                        TipoSangre: p.TipoSangre || p.tiposangre || '',
                        AsignacionActiva: p.AsignacionActiva || p.asignacionactiva || false,
                        IdDoctorAsignado: p.DoctorAsignado || p.iddoctorasignado || p.IdDoctorAsignado || null,
                        NombreDoctorAsignado: p.NombreDoctorAsignado || p.nombredoctorasignado || null,
                        ApPaternoDoctorAsignado: p.ApPaternoDoctorAsignado || p.appaternodoctorasignado || null
                    }));
                } else {
                    this.pacientes = [];
                    for (const key in datos) {
                        if (Array.isArray(datos[key])) {
                            this.pacientes = datos[key].map((p: any) => ({
                                IdUsuario: p.IdUsuario || p.idusuario || p.id || 0,
                                Nombre: p.Nombre || p.nombre || 'Paciente',
                                ApPaterno: p.ApPaterno || p.appaterno || p.apPaterno || '',
                                ApMaterno: p.ApMaterno || p.apmaterno || p.apMaterno || '',
                                Correo: p.Correo || p.correo || '',
                                NSS: p.NSS || p.nss || '',
                                TipoSangre: p.TipoSangre || p.tiposangre || '',
                                AsignacionActiva: p.AsignacionActiva || p.asignacionactiva || false,
                                IdDoctorAsignado: p.DoctorAsignado || p.iddoctorasignado || p.IdDoctorAsignado || null,
                                NombreDoctorAsignado: p.NombreDoctorAsignado || p.nombredoctorasignado || null,
                                ApPaternoDoctorAsignado: p.ApPaternoDoctorAsignado || p.appaternodoctorasignado || null
                            }));
                            break;
                        }
                    }
                }

                this.filtrarPacientes();

                if (this.pacientes.length === 0) {
                    this.mostrarToast('info', 'Sin pacientes', 'No hay pacientes registrados en el sistema');
                } else {
                    const noAsignados = this.pacientes.filter(p => !p.AsignacionActiva).length;
                    this.mostrarToast('success', 'Pacientes cargados',
                        this.pacientes.length + ' pacientes encontrados, ' + noAsignados + ' sin asignar');
                }
            } else {
                if (Array.isArray(response)) {
                    this.pacientes = response.map((p: any) => ({
                        IdUsuario: p.IdUsuario || p.idusuario || p.id || 0,
                        Nombre: p.Nombre || p.nombre || 'Paciente',
                        ApPaterno: p.ApPaterno || p.appaterno || p.apPaterno || '',
                        ApMaterno: p.ApMaterno || p.apmaterno || p.apMaterno || '',
                        Correo: p.Correo || p.correo || '',
                        NSS: p.NSS || p.nss || '',
                        TipoSangre: p.TipoSangre || p.tiposangre || '',
                        AsignacionActiva: false,
                        IdDoctorAsignado: null,
                        NombreDoctorAsignado: null,
                        ApPaternoDoctorAsignado: null
                    }));
                    this.filtrarPacientes();
                } else {
                    this.mostrarToast('error', 'Error', 'No se pudieron cargar los pacientes');
                }
            }
        } catch (error: any) {
            this.mostrarToast('error', 'Error', error.message || 'Error al cargar pacientes');
        } finally {
            this.cargandoPacientes = false;
            this.cdr.detectChanges();
        }
    }

    filtrarDoctores() {
        const term = this.busquedaDoctor.toLowerCase().trim();
        if (!term) {
            this.doctoresFiltrados = [...this.doctores];
            return;
        }
        this.doctoresFiltrados = this.doctores.filter(d => {
            const nombreCompleto = (d.Nombre + ' ' + d.ApPaterno + ' ' + (d.ApMaterno || '')).toLowerCase();
            return nombreCompleto.includes(term) ||
                (d.Nombre?.toLowerCase() || '').includes(term) ||
                (d.ApPaterno?.toLowerCase() || '').includes(term) ||
                (d.ApMaterno?.toLowerCase() || '').includes(term) ||
                (d.Especialidad?.toLowerCase() || '').includes(term) ||
                (d.Cedula?.toLowerCase() || '').includes(term) ||
                (d.Correo?.toLowerCase() || '').includes(term);
        });
    }

    filtrarPacientes() {
        const term = this.busquedaPaciente.toLowerCase().trim();

        if (!this.pacientes || this.pacientes.length === 0) {
            this.pacientesFiltrados = [];
            this.cdr.detectChanges();
            return;
        }

        let filtrados = [];

        if (this.doctorSeleccionado) {
            const idDoctor = this.doctorSeleccionado.IdUsuario;

            const asignadosAEsteDoctor = this.pacientes.filter(p =>
                p.AsignacionActiva && p.IdDoctorAsignado === idDoctor
            );

            const noAsignados = this.pacientes.filter(p => !p.AsignacionActiva);

            const asignadosAOtroDoctor = this.pacientes.filter(p =>
                p.AsignacionActiva && p.IdDoctorAsignado !== idDoctor
            );

            if (this.ocultarAsignados) {
                filtrados = noAsignados;
            } else {
                filtrados = [...asignadosAEsteDoctor, ...noAsignados, ...asignadosAOtroDoctor];
            }
        } else {
            if (this.ocultarAsignados) {
                filtrados = this.pacientes.filter(p => !p.AsignacionActiva);
            } else {
                filtrados = [...this.pacientes];
            }
        }

        if (term) {
            filtrados = filtrados.filter(p => {
                const nombreCompleto = (p.Nombre + ' ' + p.ApPaterno + ' ' + (p.ApMaterno || '')).toLowerCase();
                return nombreCompleto.includes(term) ||
                    (p.Nombre?.toLowerCase() || '').includes(term) ||
                    (p.ApPaterno?.toLowerCase() || '').includes(term) ||
                    (p.ApMaterno?.toLowerCase() || '').includes(term) ||
                    (p.Correo?.toLowerCase() || '').includes(term) ||
                    (p.NSS && p.NSS.toLowerCase().includes(term));
            });
        }

        this.pacientesFiltrados = filtrados;
        this.cdr.detectChanges();
    }

    seleccionarDoctor(doctor: any) {
        if (this.doctorSeleccionado?.IdUsuario === doctor.IdUsuario) {
            this.doctorSeleccionado = null;
            this.pacientesSeleccionados = [];
        } else {
            this.doctorSeleccionado = doctor;
            this.pacientesSeleccionados = [];
            this.mostrarToast('info', 'Doctor seleccionado',
                'Has seleccionado al Dr. ' + doctor.Nombre + ' ' + doctor.ApPaterno);
        }
        this.limpiarMensaje();
        this.filtrarPacientes();
        this.cdr.detectChanges();
    }

    togglePaciente(paciente: any) {
        if (paciente.AsignacionActiva && paciente.IdDoctorAsignado &&
            this.doctorSeleccionado && paciente.IdDoctorAsignado !== this.doctorSeleccionado.IdUsuario) {
            this.mostrarToast('warning', 'Paciente ya asignado',
                paciente.Nombre + ' ' + paciente.ApPaterno + ' ya está asignado a otro doctor');
            return;
        }

        const index = this.pacientesSeleccionados.indexOf(paciente.IdUsuario);
        if (index > -1) {
            this.pacientesSeleccionados.splice(index, 1);
        } else {
            this.pacientesSeleccionados.push(paciente.IdUsuario);
            this.mostrarToast('success', 'Paciente seleccionado',
                paciente.Nombre + ' ' + paciente.ApPaterno + ' agregado a la lista');
        }
        this.limpiarMensaje();
        this.cdr.detectChanges();
    }

    async asignarPacientes() {
        if (!this.doctorSeleccionado || this.pacientesSeleccionados.length === 0) {
            this.mostrarToast('warning', 'Selección incompleta',
                'Debes seleccionar un doctor y al menos un paciente');
            return;
        }

        if (this.hayPacientesAsignadosAOtroDoctor) {
            this.mostrarToast('error', 'Pacientes ya asignados',
                'Algunos pacientes seleccionados ya están asignados a otro doctor');
            return;
        }

        this.asignando = true;
        this.resultadosAsignacion = [];
        this.limpiarMensaje();

        try {
            const pacientesSeleccionadosData = this.pacientes.filter(p =>
                this.pacientesSeleccionados.includes(p.IdUsuario)
            );

            const response = await firstValueFrom(
                this.usersService.asignarMultiplesPacientesADoctor({
                    idDoctor: this.doctorSeleccionado.IdUsuario,
                    pacientesIds: this.pacientesSeleccionados,
                    asignadoPor: this.usuarioActual?.idusuario || null,
                    notas: 'Asignación realizada por Admin: ' + (this.usuarioActual?.nombre || 'Sistema')
                })
            );

            if (response.success) {
                this.resultadosAsignacion = response.resultados.map((r: any) => {
                    const paciente = pacientesSeleccionadosData.find(p => p.IdUsuario === r.idPaciente);
                    return {
                        ...paciente,
                        exitoso: r.success,
                        mensaje: r.mensaje
                    };
                });

                if (response.fallidos === 0) {
                    this.mostrarToast('success', 'Asignación completada',
                        response.exitosos + ' paciente(s) asignado(s) exitosamente');
                } else {
                    this.mostrarToast('warning', 'Asignación parcial',
                        response.exitosos + ' exitosos, ' + response.fallidos + ' fallidos');
                }

                // Limpiar selección inmediatamente
                const exitososIds = response.resultados
                    .filter((r: any) => r.success)
                    .map((r: any) => r.idPaciente);

                this.pacientesSeleccionados = this.pacientesSeleccionados.filter(id =>
                    !exitososIds.includes(id)
                );

                if (response.fallidos === 0) {
                    this.pacientesSeleccionados = [];
                }

                // Recargar pacientes
                await this.cargarPacientes();

                // Asegurar que el botón se deshabilita correctamente
                this.asignando = false;
                this.cdr.detectChanges();

                // Si no hay pacientes seleccionados, resetear el estado
                if (this.pacientesSeleccionados.length === 0) {
                    // Si todos fueron asignados exitosamente, se puede limpiar la selección
                }
            } else {
                this.mostrarToast('error', 'Error', response.error || 'Error al asignar pacientes');
                this.asignando = false;
                this.cdr.detectChanges();
            }
        } catch (error: any) {
            this.mostrarToast('error', 'Error', error.message || 'Error al asignar pacientes');
            this.asignando = false;
            this.cdr.detectChanges();
        } finally {
            // Asegurar que el estado de asignando se desactive siempre
            if (this.asignando) {
                this.asignando = false;
                this.cdr.detectChanges();
            }
        }
    }

    limpiarSeleccion() {
        this.doctorSeleccionado = null;
        this.pacientesSeleccionados = [];
        this.resultadosAsignacion = [];
        this.busquedaDoctor = '';
        this.busquedaPaciente = '';
        this.ocultarAsignados = false;
        this.limpiarMensaje();
        this.doctoresFiltrados = [...this.doctores];
        this.filtrarPacientes();
        this.mostrarToast('info', 'Limpiado', 'Selección reiniciada correctamente');
    }

    recargarDatos() {
        this.limpiarSeleccion();
        this.cargarDoctores();
        this.cargarPacientes();
        this.mostrarToast('info', 'Recargando', 'Datos actualizados correctamente');
    }

    verPacientesAsignados() {
        if (this.doctorSeleccionado) {
            this.router.navigate(['/admin/pacientes']);
        } else {
            this.mostrarToast('warning', 'Selecciona un doctor', 'Primero selecciona un doctor para ver sus pacientes');
        }
    }

    volver() {
        this.router.navigate(['/admin/inicio']);
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

    obtenerColorDoctor(doctor: any): string {
        const colores = ['#b0001e', '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626'];
        const index = (doctor.IdUsuario || 0) % colores.length;
        return colores[index];
    }

    estaAsignadoAlDoctorSeleccionado(paciente: any): boolean {
        if (!this.doctorSeleccionado) return false;
        return paciente.AsignacionActiva &&
            paciente.IdDoctorAsignado === this.doctorSeleccionado.IdUsuario;
    }

    estaAsignadoAOtroDoctor(paciente: any): boolean {
        if (!this.doctorSeleccionado) return false;
        return paciente.AsignacionActiva &&
            paciente.IdDoctorAsignado &&
            paciente.IdDoctorAsignado !== this.doctorSeleccionado.IdUsuario;
    }

    esPacienteSeleccionable(paciente: any): boolean {
        if (!this.doctorSeleccionado) {
            return true;
        }
        return !paciente.AsignacionActiva ||
            (paciente.AsignacionActiva && paciente.IdDoctorAsignado === this.doctorSeleccionado.IdUsuario);
    }
}