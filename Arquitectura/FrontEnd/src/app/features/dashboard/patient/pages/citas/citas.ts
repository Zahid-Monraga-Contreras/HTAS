import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PatientMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

declare var flatpickr: any;

@Component({
    selector: 'app-patient-citas',
    standalone: true,
    imports: [CommonModule, RouterLink, PatientMenu, ReactiveFormsModule],
    templateUrl: './citas.html',
    styleUrls: ['./citas.css']
})
export class PatientCitas implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private fb = inject(FormBuilder);

    isLoading = true;
    cargandoAgendar = false;
    userEmail: string = '';
    patientName: string = '';
    patientFullName: string = '';
    patientId: number | null = null;
    patientApPaterno: string = '';
    patientApMaterno: string = '';
    fechaMinima: string = '';

    citas: any[] = [];
    citasFiltradas: any[] = [];
    filterEstado: string = 'todas';
    citasEstadisticas = {
        total: 0,
        programadas: 0,
        completadas: 0,
        canceladas: 0
    };

    mostrarModalAgendar = false;
    mostrarModalDetalle = false;
    mostrarModalConfirmacion = false;
    citaSeleccionada: any = null;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        icono: ''
    };

    citaForm: FormGroup;
    private fpFechaInstance: any = null;
    private fpHoraInstance: any = null;

    constructor() {
        this.citaForm = this.fb.group({
            motivo: ['', [Validators.required, Validators.minLength(3)]],
            fechaCita: ['', [Validators.required]],
            horaCita: ['', [Validators.required]],
            modalidad: ['Presencial', [Validators.required]],
            sintomas: ['']
        });

        const hoy = new Date();
        this.fechaMinima = hoy.toISOString().split('T')[0];
    }

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.userEmail = userData.correo || '';
                    this.patientName = userData.nombre || 'Paciente';
                    this.patientFullName = userData.nombreCompleto || userData.nombre || 'Paciente';
                    this.patientId = userData.idusuario || userData.uid || null;
                    this.patientApPaterno = userData.apPaterno || '';
                    this.patientApMaterno = userData.apMaterno || '';
                } catch (e) {
                    // Error al parsear localStorage
                }
            }

            if (!this.userEmail) {
                const user = this.auth.currentUser;
                if (user) {
                    this.userEmail = user.email || '';
                    this.patientName = user.displayName || 'Paciente';
                    this.patientFullName = user.displayName || 'Paciente';
                }
            }

            await this.cargarCitas();

        } catch (error) {
            // Error general
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarCitas() {
        try {
            let citasData: any[] = [];

            // PRIMERO: Intentar obtener solo las citas del paciente
            try {
                if (this.userEmail) {
                    citasData = await firstValueFrom(
                        this.usersService.getMisCitas(this.userEmail)
                    );

                    if (Array.isArray(citasData) && citasData.length > 0) {
                        this.citas = citasData.map(c => ({
                            ...c,
                            id: c.idcita || c.id,
                            fechacita: c.fechacita || c.fecha,
                            horacita: c.horacita || c.hora,
                            correopaciente: c.correopaciente || c.correoPaciente || c.email
                        }));

                        this.citas.sort((a: any, b: any) => {
                            const fechaA = new Date(a.fechacita || a.fecha || a.fechaCita);
                            const fechaB = new Date(b.fechacita || b.fecha || b.fechaCita);
                            return fechaB.getTime() - fechaA.getTime();
                        });

                        this.calcularEstadisticas();
                        this.aplicarFiltro('todas');
                        return;
                    }
                }
            } catch (error) {
                // Si falla getMisCitas, usar getAllCitas como fallback
                console.warn('getMisCitas falló, usando getAllCitas como fallback');
            }

            // FALLBACK: Si no hay citas o falló, usar getAllCitas
            try {
                const todasLasCitas = await firstValueFrom(this.usersService.getAllCitas());

                if (Array.isArray(todasLasCitas) && todasLasCitas.length > 0) {
                    this.citas = todasLasCitas
                        .filter((c: any) => {
                            const emailPaciente = (c.correopaciente || c.correoPaciente || c.email || '').toLowerCase().trim();
                            return emailPaciente === this.userEmail.toLowerCase().trim();
                        })
                        .map(c => ({
                            ...c,
                            id: c.idcita || c.id,
                            fechacita: c.fechacita || c.fecha,
                            horacita: c.horacita || c.hora
                        }));

                    this.citas.sort((a: any, b: any) => {
                        const fechaA = new Date(a.fechacita || a.fecha || a.fechaCita);
                        const fechaB = new Date(b.fechacita || b.fecha || b.fechaCita);
                        return fechaB.getTime() - fechaA.getTime();
                    });

                    this.calcularEstadisticas();
                    this.aplicarFiltro('todas');
                }
            } catch (error) {
                this.citas = [];
            }

        } catch (error) {
            this.citas = [];
        }
    }

    private calcularEstadisticas() {
        this.citasEstadisticas.total = this.citas.length;
        this.citasEstadisticas.programadas = this.citas.filter(c =>
            (c.estado || '').toLowerCase() === 'programada'
        ).length;
        this.citasEstadisticas.completadas = this.citas.filter(c =>
            (c.estado || '').toLowerCase() === 'completada' ||
            (c.estado || '').toLowerCase() === 'realizada'
        ).length;
        this.citasEstadisticas.canceladas = this.citas.filter(c =>
            (c.estado || '').toLowerCase() === 'cancelada'
        ).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todas') {
            this.citasFiltradas = [...this.citas];
        } else {
            this.citasFiltradas = this.citas.filter(c =>
                (c.estado || '').toLowerCase() === estado.toLowerCase()
            );
        }
    }

    abrirModalAgendar() {
        if (!this.userEmail) {
            this.mostrarConfirmacion('Error', 'No se pudo identificar al usuario. Por favor inicia sesion nuevamente.', 'bi-exclamation-triangle-fill');
            return;
        }

        this.mostrarModalAgendar = true;
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');

        this.citaForm.reset({
            modalidad: 'Presencial',
            motivo: '',
            sintomas: '',
            fechaCita: anio + '-' + mes + '-' + dia,
            horaCita: '10:00'
        });

        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
        this.inicializarCalendario();
    }

    cerrarModalAgendar() {
        this.mostrarModalAgendar = false;
        document.body.style.overflow = '';
        this.destruirCalendarios();
    }

    verDetalleCita(cita: any) {
        this.citaSeleccionada = cita;
        this.mostrarModalDetalle = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalDetalle() {
        this.mostrarModalDetalle = false;
        this.citaSeleccionada = null;
        document.body.style.overflow = '';
    }

    mostrarConfirmacion(titulo: string, mensaje: string, icono: string = 'bi-check-circle-fill') {
        this.modalConfirmacion.titulo = titulo;
        this.modalConfirmacion.mensaje = mensaje;
        this.modalConfirmacion.icono = icono;
        this.mostrarModalConfirmacion = true;
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
    }

    inicializarCalendario() {
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
                const hoy = new Date();
                const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

                this.destruirCalendarios();

                this.fpFechaInstance = flatpickr("#fechaCitaInput", {
                    locale: Spanish,
                    dateFormat: "Y-m-d",
                    defaultDate: this.citaForm.get('fechaCita')?.value || "today",
                    minDate: "today",
                    maxDate: fechaMaximaCita,
                    appendTo: document.body,
                    static: false,
                    disableMobile: true,
                    onChange: (selectedDates: any, dateStr: string) => {
                        this.citaForm.patchValue({ fechaCita: dateStr });
                        this.citaForm.get('fechaCita')?.markAsTouched();
                        this.cdr.detectChanges();
                    }
                });

                this.fpHoraInstance = flatpickr("#horaCitaInput", {
                    locale: Spanish,
                    enableTime: true,
                    noCalendar: true,
                    dateFormat: "H:i",
                    time_24hr: true,
                    defaultDate: this.citaForm.get('horaCita')?.value || "10:00",
                    appendTo: document.body,
                    static: false,
                    disableMobile: true,
                    onChange: (selectedDates: any, dateStr: string) => {
                        this.citaForm.patchValue({ horaCita: dateStr });
                        this.citaForm.get('horaCita')?.markAsTouched();
                        this.cdr.detectChanges();
                    }
                });
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
        if (this.citaForm.invalid) {
            this.citaForm.markAllAsTouched();
            return;
        }

        // ✅ IMPORTANTE: Deshabilitar el botón inmediatamente
        this.cargandoAgendar = true;
        this.cdr.detectChanges();

        try {
            const formData = this.citaForm.value;

            if (!this.userEmail) {
                this.mostrarConfirmacion(
                    'Error',
                    'No se pudo identificar al usuario. Por favor inicia sesion nuevamente.',
                    'bi-exclamation-triangle-fill'
                );
                this.cargandoAgendar = false;
                this.cdr.detectChanges();
                return;
            }

            const partesNombre = this.patientFullName.trim().split(' ');
            const nombre = partesNombre[0] || this.patientName || 'Paciente';

            let apPaterno = this.patientApPaterno;
            let apMaterno = this.patientApMaterno;

            if (!apPaterno && partesNombre.length > 1) {
                apPaterno = partesNombre.slice(1).join(' ') || 'Paciente';
            }

            if (!apPaterno) {
                apPaterno = 'Paciente';
            }

            const datosCita = {
                nombrePaciente: nombre,
                apPaternoPaciente: apPaterno,
                apMaternoPaciente: apMaterno || '',
                telefonoPaciente: '',
                correoPaciente: this.userEmail,
                fechaCita: formData.fechaCita,
                horaCita: formData.horaCita + ':00',
                motivo: formData.motivo || 'Consulta Medica',
                modalidad: formData.modalidad || 'Presencial',
                sintomas: formData.sintomas || 'Sin sintomas',
                idUsuarioPaciente: this.patientId || null
            };

            await firstValueFrom(
                this.usersService.crearCita(datosCita)
            );

            // ✅ Cerrar modal de agendar ANTES de mostrar confirmación
            this.cerrarModalAgendar();

            // ✅ Mostrar confirmación
            this.mostrarConfirmacion(
                'Cita Agendada',
                'Tu cita ha sido agendada exitosamente. Recibiras un recordatorio 24 horas antes.',
                'bi-check-circle-fill'
            );

            // ✅ Recargar citas
            await this.cargarCitas();

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al agendar tu cita. Por favor intenta de nuevo.';

            if (error.error && error.error.error) {
                mensajeError = error.error.error;
            } else if (error.error && typeof error.error === 'string') {
                mensajeError = error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.mostrarConfirmacion(
                'Error al Agendar',
                mensajeError,
                'bi-exclamation-triangle-fill'
            );
        } finally {
            // ✅ Asegurar que el estado de carga siempre se reinicie
            this.cargandoAgendar = false;
            this.destruirCalendarios();
            this.cdr.detectChanges();
        }
    }

    async cancelarCita(cita: any) {
        if (!confirm('¿Estas seguro de que deseas cancelar esta cita?')) {
            return;
        }

        try {
            const idCita = cita.idcita || cita.id;
            await firstValueFrom(
                this.usersService.cancelarCita(idCita, 'Cancelada por el paciente')
            );

            this.mostrarConfirmacion(
                'Cita Cancelada',
                'Tu cita ha sido cancelada exitosamente.',
                'bi-check-circle-fill'
            );

            this.cerrarModalDetalle();
            await this.cargarCitas();

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al cancelar tu cita. Por favor intenta de nuevo.';

            if (error.error && error.error.error) {
                mensajeError = error.error.error;
            } else if (error.error && typeof error.error === 'string') {
                mensajeError = error.error;
            }

            this.mostrarConfirmacion(
                'Error al Cancelar',
                mensajeError,
                'bi-exclamation-triangle-fill'
            );
        }
    }

    getEstadoClass(estado: string): string {
        if (!estado) return 'estado-info';
        const estadoLower = estado.toLowerCase();
        switch (estadoLower) {
            case 'completada':
            case 'realizada':
            case 'finalizada':
                return 'estado-completada';
            case 'programada':
                return 'estado-programada';
            case 'cancelada':
                return 'estado-cancelada';
            default:
                return 'estado-info';
        }
    }

    getEstadoIcon(estado: string): string {
        if (!estado) return 'bi-question-circle';
        const estadoLower = estado.toLowerCase();
        switch (estadoLower) {
            case 'completada':
            case 'realizada':
            case 'finalizada':
                return 'bi-check-circle-fill';
            case 'programada':
                return 'bi-calendar-plus';
            case 'cancelada':
                return 'bi-x-circle-fill';
            default:
                return 'bi-calendar-event';
        }
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return `${diasSemana[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
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

    getModalidadClass(modalidad: string): string {
        if (!modalidad) return 'modalidad-presencial';
        const modalidadLower = modalidad.toLowerCase();
        switch (modalidadLower) {
            case 'virtual':
                return 'modalidad-virtual';
            case 'presencial':
            default:
                return 'modalidad-presencial';
        }
    }

    getModalidadIcon(modalidad: string): string {
        if (!modalidad) return 'bi-building';
        const modalidadLower = modalidad.toLowerCase();
        switch (modalidadLower) {
            case 'virtual':
                return 'bi-laptop';
            case 'presencial':
            default:
                return 'bi-building';
        }
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

    esCitaHoy(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const hoy = new Date();
            const fechaCita = new Date(fecha);
            return hoy.getDate() === fechaCita.getDate() &&
                hoy.getMonth() === fechaCita.getMonth() &&
                hoy.getFullYear() === fechaCita.getFullYear();
        } catch {
            return false;
        }
    }

    esCitaProxima(fecha: string): boolean {
        if (!fecha) return false;
        try {
            const hoy = new Date();
            const fechaCita = new Date(fecha);
            return fechaCita > hoy;
        } catch {
            return false;
        }
    }

    obtenerBadgeTiempo(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'Hoy';
        if (this.esCitaProxima(fecha)) return 'Proxima';
        return 'Pasada';
    }

    getBadgeTiempoClass(fecha: string): string {
        if (!fecha) return '';
        if (this.esCitaHoy(fecha)) return 'badge-hoy';
        if (this.esCitaProxima(fecha)) return 'badge-proxima';
        return 'badge-pasada';
    }
}