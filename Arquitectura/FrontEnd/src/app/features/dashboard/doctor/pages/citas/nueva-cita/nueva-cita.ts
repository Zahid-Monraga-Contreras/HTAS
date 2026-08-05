import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DoctorMenu } from "../../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../../core/services/users.service';

declare var flatpickr: any;

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-doctor-nueva-cita',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, DoctorMenu],
    templateUrl: './nueva-cita.html',
    styleUrls: ['./nueva-cita.css']
})
export class DoctorNuevaCita implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = false;
    loadingPacientes = false;
    verificandoDisponibilidad = false;
    userEmail: string = '';
    doctorId: number | null = null;
    pacientes: any[] = [];
    pacientesFiltrados: any[] = [];
    searchTerm: string = '';

    // Variables para disponibilidad
    horarioDisponible: boolean = true;
    mensajeDisponibilidad: string = '';
    horariosDisponibles: string[] = [];
    mostrandoHorarios = false;
    horarioSeleccionadoValido: boolean = true;

    citaForm: FormGroup;
    private fpFechaInstance: any = null;
    private fpHoraInstance: any = null;

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    constructor() {
        this.citaForm = this.fb.group({
            idPaciente: ['', [Validators.required]],
            motivo: ['', [Validators.required, Validators.minLength(3)]],
            fechaCita: ['', [Validators.required]],
            horaCita: ['', [Validators.required]],
            modalidad: ['Presencial'],
            sintomas: ['']
        });
    }

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatosIniciales();
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

    async cargarDatosIniciales() {
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.userEmail = userData.correo || '';
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            await this.cargarPacientes();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los datos iniciales.');
        }
    }

    async cargarPacientes() {
        this.loadingPacientes = true;
        try {
            const allUsers = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(allUsers)) {
                this.pacientes = allUsers.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );
                this.pacientesFiltrados = [...this.pacientes];
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
            this.showError('Error', 'No se pudieron cargar los pacientes.');
        } finally {
            this.loadingPacientes = false;
            this.cdr.detectChanges();
        }
    }

    buscarPacientes() {
        const term = this.searchTerm.toLowerCase().trim();
        if (!term) {
            this.pacientesFiltrados = [...this.pacientes];
            return;
        }
        this.pacientesFiltrados = this.pacientes.filter(p =>
            p.nombre?.toLowerCase().includes(term) ||
            p.apPaterno?.toLowerCase().includes(term) ||
            p.correo?.toLowerCase().includes(term)
        );
    }

    seleccionarPaciente(paciente: any) {
        this.citaForm.patchValue({ idPaciente: paciente.idusuario });
        this.searchTerm = `${paciente.nombre} ${paciente.apPaterno}`;
        this.pacientesFiltrados = [];
        // Resetear disponibilidad al cambiar paciente
        this.horarioDisponible = true;
        this.mensajeDisponibilidad = '';
        this.horariosDisponibles = [];
        this.mostrandoHorarios = false;
        this.horarioSeleccionadoValido = true;
        this.cdr.detectChanges();
    }

    // ==========================================
    // VALIDACION DE DISPONIBILIDAD
    // ==========================================

    private async verificarDisponibilidadEnTiempoReal() {
        const fecha = this.citaForm.get('fechaCita')?.value;
        const hora = this.citaForm.get('horaCita')?.value;

        if (!fecha || !hora) {
            this.horarioDisponible = true;
            this.mensajeDisponibilidad = '';
            this.horarioSeleccionadoValido = true;
            return;
        }

        this.verificandoDisponibilidad = true;
        this.cdr.detectChanges();

        try {
            const disponibilidad = await firstValueFrom(
                this.usersService.verificarDisponibilidad(fecha, hora + ':00', this.userEmail)
            );

            this.horarioDisponible = disponibilidad.disponible;
            this.mensajeDisponibilidad = disponibilidad.mensaje;

            if (!disponibilidad.disponible) {
                this.citaForm.setErrors({ horarioOcupado: true });
                this.horarioSeleccionadoValido = false;

                if (disponibilidad.detalles) {
                    const detalles = disponibilidad.detalles;
                    if (detalles.usuarioYaTieneCita) {
                        this.showWarning('Ya tiene cita', 'El paciente ya tiene una cita agendada para esta fecha y hora.');
                    } else if (detalles.horaLlena) {
                        this.showWarning('Horario completo', 'Este horario ya está completo (3 citas agendadas).');
                    } else if (detalles.limiteDiaAlcanzado) {
                        this.showWarning('Límite diario alcanzado', 'El paciente ya tiene 2 citas para este día.');
                    }
                }
            } else {
                this.citaForm.setErrors(null);
                this.horarioSeleccionadoValido = true;
                this.showInfo('Horario disponible', 'El horario está disponible para agendar.');
            }

        } catch (error) {
            console.error('Error verificando disponibilidad:', error);
            this.showWarning('Error de verificación', 'No se pudo verificar la disponibilidad. Intenta nuevamente.');
        } finally {
            this.verificandoDisponibilidad = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarHorariosDisponibles(fecha: string) {
        if (!fecha) {
            this.horariosDisponibles = [];
            this.mostrandoHorarios = false;
            return;
        }

        try {
            const response = await firstValueFrom(
                this.usersService.getHorariosDisponibles(fecha, this.userEmail)
            );

            if (response && response.success) {
                this.horariosDisponibles = response.horariosDisponibles || [];
                this.mostrandoHorarios = this.horariosDisponibles.length > 0;

                if (this.horariosDisponibles.length === 1) {
                    const horaSugerida = this.horariosDisponibles[0];
                    this.citaForm.patchValue({ horaCita: horaSugerida });
                    this.showInfo('Horario sugerido', `Solo hay un horario disponible: ${this.formatearHora(horaSugerida)}`);
                    this.verificarDisponibilidadEnTiempoReal();
                } else if (this.horariosDisponibles.length === 0) {
                    this.showWarning('Sin horarios', 'No hay horarios disponibles para esta fecha.');
                    this.mostrandoHorarios = false;
                }
            }

            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error cargando horarios disponibles:', error);
            this.mostrandoHorarios = false;
        }
    }

    seleccionarHorario(hora: string) {
        this.citaForm.patchValue({ horaCita: hora });
        this.verificarDisponibilidadEnTiempoReal();
        this.cdr.detectChanges();
    }

    formatearHora(hora: string): string {
        if (!hora) return 'S/H';
        try {
            const partes = hora.split(':');
            if (partes.length >= 2) {
                let h = parseInt(partes[0]);
                const m = partes[1];
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${h}:${m} ${ampm}`;
            }
            return hora;
        } catch {
            return hora;
        }
    }

    abrirCalendarios() {
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
                this.destruirCalendarios();

                const fechaInput = document.getElementById('fechaCitaInput');
                const horaInput = document.getElementById('horaCitaInput');

                if (fechaInput) {
                    const hoy = new Date();
                    const fechaMinima = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
                    const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 3, hoy.getDate());

                    this.fpFechaInstance = flatpickr(fechaInput, {
                        locale: {
                            firstDayOfWeek: 1
                        },
                        dateFormat: "Y-m-d",
                        defaultDate: "today",
                        minDate: fechaMinima,
                        maxDate: fechaMaxima,
                        appendTo: document.body,
                        static: false,
                        disableMobile: true,
                        onChange: (selectedDates: any, dateStr: string) => {
                            if (dateStr) {
                                this.citaForm.patchValue({ fechaCita: dateStr });
                                this.citaForm.get('fechaCita')?.markAsTouched();
                                // Verificar disponibilidad al cambiar fecha
                                this.cargarHorariosDisponibles(dateStr);
                                this.verificarDisponibilidadEnTiempoReal();
                                this.cdr.detectChanges();
                            }
                        },
                        onReady: (selectedDates: any, dateStr: string, instance: any) => {
                            const calendarElement = instance.calendarContainer;
                            if (calendarElement) {
                                calendarElement.style.zIndex = '9999';
                            }
                        }
                    });

                    if (this.citaForm.get('fechaCita')?.value) {
                        this.fpFechaInstance.setDate(this.citaForm.get('fechaCita')?.value);
                        // Cargar horarios para la fecha inicial
                        this.cargarHorariosDisponibles(this.citaForm.get('fechaCita')?.value);
                    }
                }

                if (horaInput) {
                    this.fpHoraInstance = flatpickr(horaInput, {
                        enableTime: true,
                        noCalendar: true,
                        dateFormat: "H:i",
                        time_24hr: true,
                        defaultDate: "10:00",
                        appendTo: document.body,
                        static: false,
                        disableMobile: true,
                        onChange: (selectedDates: any, dateStr: string) => {
                            if (dateStr) {
                                this.citaForm.patchValue({ horaCita: dateStr });
                                this.citaForm.get('horaCita')?.markAsTouched();
                                // Verificar disponibilidad al cambiar hora
                                this.verificarDisponibilidadEnTiempoReal();
                                this.cdr.detectChanges();
                            }
                        }
                    });

                    if (this.citaForm.get('horaCita')?.value) {
                        this.fpHoraInstance.setDate(this.citaForm.get('horaCita')?.value);
                    }
                }
            }, 100);
        }
    }

    destruirCalendarios() {
        if (this.fpFechaInstance) {
            this.fpFechaInstance.destroy();
            this.fpFechaInstance = null;
        }
        if (this.fpHoraInstance) {
            this.fpHoraInstance.destroy();
            this.fpHoraInstance = null;
        }
    }

    async agendarCita() {
        // Verificar si el formulario es válido
        if (this.citaForm.invalid) {
            this.citaForm.markAllAsTouched();
            this.showWarning('Formulario Incompleto', 'Por favor, completa todos los campos requeridos.');
            return;
        }

        // Verificar disponibilidad
        if (!this.horarioDisponible) {
            this.showWarning('Horario no disponible', this.mensajeDisponibilidad || 'El horario seleccionado no está disponible.');
            return;
        }

        if (!this.horarioSeleccionadoValido) {
            this.showWarning('Horario no válido', 'Por favor, selecciona un horario disponible.');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        try {
            const formData = this.citaForm.value;
            const pacienteSeleccionado = this.pacientes.find(p => p.idusuario === formData.idPaciente);

            // Verificar disponibilidad una última vez antes de agendar
            const disponibilidadFinal = await firstValueFrom(
                this.usersService.verificarDisponibilidad(
                    formData.fechaCita,
                    formData.horaCita + ':00',
                    this.userEmail
                )
            );

            if (!disponibilidadFinal.disponible) {
                this.showError(
                    'Horario ocupado',
                    disponibilidadFinal.mensaje || 'El horario seleccionado ya no está disponible. Por favor, selecciona otro.'
                );
                this.horarioDisponible = false;
                this.horarioSeleccionadoValido = false;
                this.isLoading = false;
                this.cargarHorariosDisponibles(formData.fechaCita);
                return;
            }

            const datosCita = {
                nombrePaciente: pacienteSeleccionado?.nombre || 'Paciente',
                apPaternoPaciente: pacienteSeleccionado?.apPaterno || '',
                apMaternoPaciente: pacienteSeleccionado?.apMaterno || '',
                telefonoPaciente: pacienteSeleccionado?.telefono || '',
                correoPaciente: pacienteSeleccionado?.correo || '',
                fechaCita: formData.fechaCita,
                horaCita: formData.horaCita + ':00',
                motivo: formData.motivo || 'Consulta Medica',
                modalidad: formData.modalidad || 'Presencial',
                sintomas: formData.sintomas || '',
                idUsuarioPaciente: formData.idPaciente,
                idUsuarioDoctor: this.doctorId
            };

            await firstValueFrom(this.usersService.crearCita(datosCita));

            this.showSuccess(
                'Cita Agendada',
                'La cita ha sido agendada exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/citas']);
            }, 1500);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al agendar la cita.';
            if (error.error?.error) {
                mensajeError = error.error.error;
                // Si el error es por horario ocupado, actualizar estado
                if (mensajeError.includes('horario no disponible') || mensajeError.includes('ya hay 3 citas')) {
                    this.horarioDisponible = false;
                    this.horarioSeleccionadoValido = false;
                    const fecha = this.citaForm.get('fechaCita')?.value;
                    if (fecha) {
                        this.cargarHorariosDisponibles(fecha);
                    }
                }
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Agendar', mensajeError);
        } finally {
            this.isLoading = false;
            this.destruirCalendarios();
            this.cdr.detectChanges();
        }
    }

    cancelar() {
        this.router.navigate(['/doctor/citas']);
    }

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = `${nombre || ''} ${apPaterno || ''}`.trim();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
    }
}