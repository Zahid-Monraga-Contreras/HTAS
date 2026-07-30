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
    selector: 'app-doctor-nuevo-tratamiento',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, DoctorMenu],
    templateUrl: './nuevo-tratamiento.html',
    styleUrls: ['./nuevo-tratamiento.css']
})
export class DoctorNuevoTratamiento implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = false;
    loadingPacientes = false;
    loadingMedicamentos = false;
    doctorId: number | null = null;

    pacientes: any[] = [];
    pacientesFiltrados: any[] = [];
    searchTermPaciente: string = '';

    medicamentos: any[] = [];
    medicamentosFiltrados: any[] = [];
    searchTermMedicamento: string = '';

    tratamientoForm: FormGroup;
    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    private fpFechaInicioInstance: any = null;
    private fpFechaFinInstance: any = null;

    constructor() {
        this.tratamientoForm = this.fb.group({
            idPaciente: ['', [Validators.required]],
            idMedicamento: ['', [Validators.required]],
            dosis: ['', [Validators.required]],
            frecuenciaHoras: ['', [Validators.required, Validators.min(1)]],
            fechaInicio: ['', [Validators.required]],
            fechaFin: ['', [Validators.required]],
            notasInstrucciones: [''],
            activo: [true]
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

    async cargarDatosIniciales() {
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.doctorId = userData.idusuario || userData.uid || null;
            }

            await Promise.all([
                this.cargarPacientes(),
                this.cargarMedicamentos()
            ]);

            setTimeout(() => {
                this.inicializarCalendarios();
            }, 500);
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

    async cargarMedicamentos() {
        this.loadingMedicamentos = true;
        try {
            const data = await firstValueFrom(this.usersService.getMedicamentos());

            // Verificar qué campos trae el medicamento
            if (Array.isArray(data) && data.length > 0) {
                console.log('Medicamento de ejemplo:', data[0]);
                console.log('Campos del medicamento:', Object.keys(data[0]));
            }

            if (Array.isArray(data)) {
                this.medicamentos = data.map(m => ({
                    ...m,
                    // Mapear nombres de campos según lo que devuelve el backend
                    nombreMostrar: m.nombrecomercial || m.nombreComercial || m.NombreComercial || m.nombre || 'Sin nombre',
                    sustanciaMostrar: m.sustanciaactiva || m.sustanciaActiva || m.SustanciaActiva || m.sustancia || '',
                    laboratorioMostrar: m.laboratorio || m.Laboratorio || ''
                }));
                this.medicamentosFiltrados = [...this.medicamentos];
            }
        } catch (error) {
            console.error('Error al cargar medicamentos:', error);
            this.showError('Error', 'No se pudieron cargar los medicamentos.');
        } finally {
            this.loadingMedicamentos = false;
            this.cdr.detectChanges();
        }
    }

    buscarPacientes() {
        const term = this.searchTermPaciente.toLowerCase().trim();
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
        this.tratamientoForm.patchValue({ idPaciente: paciente.idusuario });
        this.searchTermPaciente = `${paciente.nombre} ${paciente.apPaterno}`;
        this.pacientesFiltrados = [];
        this.cdr.detectChanges();
    }

    buscarMedicamentos() {
        const term = this.searchTermMedicamento.toLowerCase().trim();
        if (!term) {
            this.medicamentosFiltrados = [...this.medicamentos];
            return;
        }
        this.medicamentosFiltrados = this.medicamentos.filter(m => {
            const nombre = (m.nombreMostrar || '').toLowerCase();
            const sustancia = (m.sustanciaMostrar || '').toLowerCase();
            const laboratorio = (m.laboratorioMostrar || '').toLowerCase();
            return nombre.includes(term) || sustancia.includes(term) || laboratorio.includes(term);
        });
    }

    seleccionarMedicamento(medicamento: any) {
        const id = medicamento.idmedicamento || medicamento.IdMedicamento || medicamento.id;
        this.tratamientoForm.patchValue({ idMedicamento: id });
        this.searchTermMedicamento = medicamento.nombreMostrar || 'Medicamento';
        this.medicamentosFiltrados = [];
        this.cdr.detectChanges();
    }

    inicializarCalendarios() {
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
                this.destruirCalendarios();

                const fechaInicioInput = document.getElementById('fechaInicioInput');
                const fechaFinInput = document.getElementById('fechaFinInput');

                const hoy = new Date();
                const fechaMinima = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

                if (fechaInicioInput) {
                    this.fpFechaInicioInstance = flatpickr(fechaInicioInput, {
                        locale: {
                            firstDayOfWeek: 1
                        },
                        dateFormat: "Y-m-d",
                        defaultDate: this.tratamientoForm.get('fechaInicio')?.value || "today",
                        minDate: fechaMinima,
                        appendTo: document.body,
                        static: true,
                        disableMobile: true,
                        onChange: (selectedDates: any, dateStr: string) => {
                            if (dateStr) {
                                this.tratamientoForm.patchValue({ fechaInicio: dateStr });
                                this.tratamientoForm.get('fechaInicio')?.markAsTouched();
                                this.cdr.detectChanges();

                                if (this.fpFechaFinInstance) {
                                    const fechaInicio = new Date(dateStr);
                                    this.fpFechaFinInstance.set('minDate', fechaInicio);
                                }
                            }
                        }
                    });
                }

                if (fechaFinInput) {
                    const fechaInicioVal = this.tratamientoForm.get('fechaInicio')?.value;
                    const minDate = fechaInicioVal ? new Date(fechaInicioVal) : fechaMinima;

                    this.fpFechaFinInstance = flatpickr(fechaFinInput, {
                        locale: {
                            firstDayOfWeek: 1
                        },
                        dateFormat: "Y-m-d",
                        defaultDate: this.tratamientoForm.get('fechaFin')?.value || "",
                        minDate: minDate,
                        appendTo: document.body,
                        static: true,
                        disableMobile: true,
                        onChange: (selectedDates: any, dateStr: string) => {
                            if (dateStr) {
                                this.tratamientoForm.patchValue({ fechaFin: dateStr });
                                this.tratamientoForm.get('fechaFin')?.markAsTouched();
                                this.cdr.detectChanges();
                            }
                        }
                    });
                }
            }, 100);
        }
    }

    destruirCalendarios() {
        if (this.fpFechaInicioInstance) {
            this.fpFechaInicioInstance.destroy();
            this.fpFechaInicioInstance = null;
        }
        if (this.fpFechaFinInstance) {
            this.fpFechaFinInstance.destroy();
            this.fpFechaFinInstance = null;
        }
    }

    abrirCalendarioInicio() {
        if (this.fpFechaInicioInstance) {
            this.fpFechaInicioInstance.open();
        } else {
            this.inicializarCalendarios();
            setTimeout(() => {
                if (this.fpFechaInicioInstance) {
                    this.fpFechaInicioInstance.open();
                }
            }, 200);
        }
    }

    abrirCalendarioFin() {
        if (this.fpFechaFinInstance) {
            this.fpFechaFinInstance.open();
        } else {
            this.inicializarCalendarios();
            setTimeout(() => {
                if (this.fpFechaFinInstance) {
                    this.fpFechaFinInstance.open();
                }
            }, 200);
        }
    }

    async crearTratamiento() {
        if (this.tratamientoForm.invalid) {
            this.tratamientoForm.markAllAsTouched();
            this.showWarning('Formulario Incompleto', 'Por favor, completa todos los campos requeridos.');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        try {
            const formData = this.tratamientoForm.value;

            const datosTratamiento = {
                idPaciente: formData.idPaciente,
                idDoctor: this.doctorId,
                idMedicamento: formData.idMedicamento,
                dosis: formData.dosis,
                frecuenciaHoras: formData.frecuenciaHoras,
                fechaInicio: formData.fechaInicio,
                fechaFin: formData.fechaFin,
                notasInstrucciones: formData.notasInstrucciones || '',
                activo: formData.activo !== undefined ? formData.activo : true
            };

            await firstValueFrom(this.usersService.crearTratamiento(datosTratamiento));

            this.showSuccess(
                'Tratamiento Creado',
                'El tratamiento ha sido creado exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/tratamientos']);
            }, 1000);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al crear el tratamiento.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Crear', mensajeError);
        } finally {
            this.isLoading = false;
            this.destruirCalendarios();
            this.cdr.detectChanges();
        }
    }

    cancelar() {
        this.router.navigate(['/doctor/tratamientos']);
    }

    getAvatarUrl(nombre: string, apPaterno: string): string {
        const name = `${nombre || ''} ${apPaterno || ''}`.trim();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=b0001e&color=fff&bold=true`;
    }
}