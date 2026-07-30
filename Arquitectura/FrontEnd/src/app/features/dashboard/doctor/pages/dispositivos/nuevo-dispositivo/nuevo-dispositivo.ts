import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-nuevo-dispositivo',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, DoctorMenu],
    templateUrl: './nuevo-dispositivo.html',
    styleUrls: ['./nuevo-dispositivo.css']
})
export class DoctorNuevoDispositivo implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = false;
    loadingPacientes = false;
    dispositivoForm: FormGroup;
    pacientes: any[] = [];
    pacientesFiltrados: any[] = [];
    searchTermPaciente: string = '';
    mostrarListaPacientes: boolean = false;
    pacienteSeleccionado: any = null;

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    constructor() {
        this.dispositivoForm = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2)]],
            direccionMac: ['', [Validators.required, Validators.pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)]],
            idPacienteAsociado: [null]
        });
    }

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarPacientes();
    }

    private showToast(type: ToastNotification['type'], title: string, message: string, duration: number = 5000) {
        const id = ++this.notificationCounter;
        const notification: ToastNotification = {
            id,
            type,
            title,
            message,
            duration
        };

        this.notifications.unshift(notification);
        this.cdr.detectChanges();

        setTimeout(() => {
            this.removeToast(id);
        }, duration);
    }

    removeToast(id: number) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.cdr.detectChanges();
    }

    showSuccess(title: string, message: string, duration: number = 5000) {
        this.showToast('success', title, message, duration);
    }

    showError(title: string, message: string, duration: number = 7000) {
        this.showToast('error', title, message, duration);
    }

    showWarning(title: string, message: string, duration: number = 5000) {
        this.showToast('warning', title, message, duration);
    }

    showInfo(title: string, message: string, duration: number = 4000) {
        this.showToast('info', title, message, duration);
    }

    async cargarPacientes() {
        this.loadingPacientes = true;
        try {
            const allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(allUsers)) {
                this.pacientes = allUsers.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                ).map(p => ({
                    ...p,
                    nombreCompleto: `${p.nombre || ''} ${p.apPaterno || ''} ${p.apMaterno || ''}`.trim() || p.correo || 'Paciente'
                }));
                this.pacientesFiltrados = [];
                this.mostrarListaPacientes = false;
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
            this.showError('Error', 'No se pudieron cargar los pacientes.');
        } finally {
            this.loadingPacientes = false;
            this.cdr.detectChanges();
        }
    }

    onFocusPaciente() {
        // Solo mostrar la lista si hay texto en la búsqueda y no hay un paciente seleccionado
        if (this.pacienteSeleccionado) {
            return;
        }

        if (this.searchTermPaciente.trim().length > 0) {
            this.mostrarListaPacientes = true;
            this.buscarPacientes();
        } else {
            this.mostrarListaPacientes = false;
            this.pacientesFiltrados = [];
        }
    }

    buscarPacientes() {
        const term = this.searchTermPaciente.toLowerCase().trim();

        if (!term || this.pacienteSeleccionado) {
            this.pacientesFiltrados = [];
            this.mostrarListaPacientes = false;
            return;
        }

        this.mostrarListaPacientes = true;
        this.pacientesFiltrados = this.pacientes.filter(p =>
            p.nombre?.toLowerCase().includes(term) ||
            p.apPaterno?.toLowerCase().includes(term) ||
            p.correo?.toLowerCase().includes(term) ||
            p.nombreCompleto?.toLowerCase().includes(term)
        );
    }

    seleccionarPaciente(paciente: any) {
        this.pacienteSeleccionado = paciente;
        this.dispositivoForm.patchValue({ idPacienteAsociado: paciente.idusuario });
        this.searchTermPaciente = paciente.nombreCompleto || `${paciente.nombre} ${paciente.apPaterno}`;
        this.pacientesFiltrados = [];
        this.mostrarListaPacientes = false;
        this.cdr.detectChanges();
    }

    limpiarPaciente() {
        this.pacienteSeleccionado = null;
        this.dispositivoForm.patchValue({ idPacienteAsociado: null });
        this.searchTermPaciente = '';
        this.pacientesFiltrados = [];
        this.mostrarListaPacientes = false;
        this.cdr.detectChanges();
    }

    ocultarListaPacientes() {
        setTimeout(() => {
            if (!this.pacienteSeleccionado) {
                this.mostrarListaPacientes = false;
                // Si no hay texto de búsqueda, limpiar filtrados
                if (!this.searchTermPaciente.trim()) {
                    this.pacientesFiltrados = [];
                }
                this.cdr.detectChanges();
            }
        }, 200);
    }

    // Método para verificar si hay pacientes disponibles
    tienePacientesDisponibles(): boolean {
        return this.pacientes.length > 0;
    }

    // Método para verificar si se debe mostrar "No se encontraron pacientes"
    mostrarNoEncontrados(): boolean {
        return !this.loadingPacientes &&
            this.pacientes.length > 0 &&
            this.searchTermPaciente.trim().length > 0 &&
            this.pacientesFiltrados.length === 0 &&
            !this.pacienteSeleccionado;
    }

    async crearDispositivo() {
        if (this.dispositivoForm.invalid) {
            this.dispositivoForm.markAllAsTouched();
            this.showWarning('Formulario Incompleto', 'Por favor, completa todos los campos requeridos.');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        try {
            const formData = this.dispositivoForm.value;

            const datosDispositivo = {
                nombre: formData.nombre.trim(),
                direccionMac: formData.direccionMac.trim().toUpperCase(),
                idPacienteAsociado: formData.idPacienteAsociado || null
            };

            await firstValueFrom(this.usersService.crearDispositivo(datosDispositivo));

            this.showSuccess(
                'Dispositivo Creado',
                'El dispositivo ha sido creado exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/dispositivos']);
            }, 1000);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al crear el dispositivo.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Crear', mensajeError);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    cancelar() {
        this.router.navigate(['/doctor/dispositivos']);
    }

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = `${nombre || ''} ${apPaterno || ''}`.trim();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
    }
}