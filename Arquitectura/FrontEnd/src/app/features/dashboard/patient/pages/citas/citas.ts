import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PatientMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

declare var flatpickr: any;

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-patient-citas',
    standalone: true,
    imports: [CommonModule, PatientMenu, ReactiveFormsModule],
    templateUrl: './citas.html',
    styleUrls: ['./citas.css']
})
export class PatientCitas implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private fb = inject(FormBuilder);

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    isLoading = true;
    cargandoAgendar = false;
    cargandoCancelar = false;
    verificandoDisponibilidad = false;

    userEmail: string = '';
    patientName: string = '';
    patientFullName: string = '';
    patientId: number | null = null;
    patientApPaterno: string = '';
    patientApMaterno: string = '';
    fechaMinima: string = '';

    doctorId: number | null = null; // ⭐ doctor asignado a este paciente
    doctorNombre: string = ''; // ⭐ NUEVO: nombre completo del doctor asignado
    doctorEspecialidad: string = ''; // ⭐ NUEVO: especialidad del doctor asignado (si viene en la respuesta)

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
    mostrarModalConfirmacionCancelar = false;
    citaSeleccionada: any = null;
    citaParaCancelar: any = null;

    horarioDisponible: boolean = true;
    mensajeDisponibilidad: string = '';
    horariosDisponibles: string[] = [];
    mostrandoHorarios = false;
    horarioSeleccionadoValido: boolean = true;
    correoOcupante: string | null = null;

    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        icono: '',
        accion: ''
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

    mostrarConfirmacionCancelar(cita: any) {
        this.citaParaCancelar = cita;
        this.modalConfirmacion = {
            titulo: 'Cancelar Cita',
            mensaje: '¿Estas seguro de que deseas cancelar esta cita? Esta accion no se puede deshacer.',
            icono: 'bi-exclamation-triangle-fill',
            accion: 'cancelar'
        };
        this.mostrarModalConfirmacionCancelar = true;
        document.body.style.overflow = 'hidden';
    }

    cerrarModalConfirmacionCancelar() {
        this.mostrarModalConfirmacionCancelar = false;
        this.citaParaCancelar = null;
        document.body.style.overflow = '';
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

            // ⭐ obtener el doctor asignado antes de cargar citas
            await this.cargarDoctorAsignado();

            await this.cargarCitas();

        } catch (error) {
            this.showError('Error', 'No se pudieron cargar tus citas');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    // ==========================================================================
    // ⭐ HELPERS DE EXTRACCION ROBUSTA DE CAMPOS
    // ==========================================================================
    // Postgres, cuando los alias de columna no van entre comillas dobles,
    // los devuelve TODO en minusculas (idcita, correopaciente, iddoctor...).
    // En vez de listar manualmente cada variante de casing posible
    // (idDoctor, IdDoctor, iddoctor, ID_DOCTOR, etc.), buscamos la clave
    // de forma case-insensitive dentro del objeto.
    // Normaliza quitando mayusculas Y separadores (_ , -, espacios) para que
    // "id_usuario", "IdUsuario", "ID-USUARIO" y "idusuario" se consideren la misma clave.
    private normalizarClave(clave: string): string {
        return clave.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    private buscarValorPorClave(obj: any, posiblesClaves: string[]): any {
        if (!obj || typeof obj !== 'object') return null;

        const clavesNormalizadas = posiblesClaves.map(k => this.normalizarClave(k));
        const claveEncontrada = Object.keys(obj).find(k =>
            clavesNormalizadas.includes(this.normalizarClave(k))
        );

        return claveEncontrada ? obj[claveEncontrada] : null;
    }

    // Busca un id de doctor en el objeto raiz y, si no lo encuentra,
    // en las propiedades anidadas de primer nivel (por si el backend
    // envuelve la respuesta como { data: { doctor: {...} } } o similar).
    private extraerDoctorId(doctorData: any): number | null {
        if (!doctorData || typeof doctorData !== 'object') return null;

        const clavesId = ['idusuario', 'idUsuario', 'idDoctor', 'iddoctor', 'id'];

        // 1. Buscar directamente en el objeto
        let valor = this.buscarValorPorClave(doctorData, clavesId);

        // 2. Si no se encontro, buscar en propiedades anidadas de primer nivel
        if (valor === null || valor === undefined) {
            for (const key of Object.keys(doctorData)) {
                const posibleAnidado = doctorData[key];
                if (posibleAnidado && typeof posibleAnidado === 'object' && !Array.isArray(posibleAnidado)) {
                    valor = this.buscarValorPorClave(posibleAnidado, clavesId);
                    if (valor !== null && valor !== undefined) break;
                }
            }
        }

        if (valor === null || valor === undefined) return null;

        const idNumerico = typeof valor === 'string' ? parseInt(valor, 10) : valor;
        return (typeof idNumerico === 'number' && !isNaN(idNumerico) && idNumerico > 0) ? idNumerico : null;
    }

    // ⭐ NUEVO: igual que extraerDoctorId, pero para armar el nombre completo del doctor.
    // Busca nombre / apPaterno / apMaterno (o nombreCompleto ya armado) de forma
    // case-insensitive, tanto en el objeto raiz como en propiedades anidadas.
    private extraerDoctorNombre(doctorData: any): string {
        if (!doctorData || typeof doctorData !== 'object') return '';

        const buscarEnObjeto = (obj: any): string => {
            if (!obj || typeof obj !== 'object') return '';

            // Si ya viene un nombre completo armado, usarlo directamente
            const nombreCompleto = this.buscarValorPorClave(obj, ['nombreCompleto', 'nombre_completo', 'fullName']);
            if (nombreCompleto && typeof nombreCompleto === 'string' && nombreCompleto.trim()) {
                return nombreCompleto.trim();
            }

            const nombre = this.buscarValorPorClave(obj, ['nombre', 'name']);
            const apPaterno = this.buscarValorPorClave(obj, ['apPaterno', 'ap_paterno', 'apellidoPaterno']);
            const apMaterno = this.buscarValorPorClave(obj, ['apMaterno', 'ap_materno', 'apellidoMaterno']);

            const partes = [nombre, apPaterno, apMaterno].filter(p => p && typeof p === 'string' && p.trim());
            return partes.length > 0 ? partes.join(' ').trim() : '';
        };

        // 1. Buscar directamente en el objeto
        let nombreEncontrado = buscarEnObjeto(doctorData);

        // 2. Si no se encontro, buscar en propiedades anidadas de primer nivel
        if (!nombreEncontrado) {
            for (const key of Object.keys(doctorData)) {
                const posibleAnidado = doctorData[key];
                if (posibleAnidado && typeof posibleAnidado === 'object' && !Array.isArray(posibleAnidado)) {
                    nombreEncontrado = buscarEnObjeto(posibleAnidado);
                    if (nombreEncontrado) break;
                }
            }
        }

        return nombreEncontrado;
    }

    // ⭐ NUEVO: extrae la especialidad del doctor, si el backend la incluye.
    private extraerDoctorEspecialidad(doctorData: any): string {
        if (!doctorData || typeof doctorData !== 'object') return '';

        const buscarEnObjeto = (obj: any): string => {
            const valor = this.buscarValorPorClave(obj, ['especialidad', 'especialidadMedica', 'especialidad_medica']);
            return (valor && typeof valor === 'string') ? valor.trim() : '';
        };

        let valorEncontrado = buscarEnObjeto(doctorData);

        if (!valorEncontrado) {
            for (const key of Object.keys(doctorData)) {
                const posibleAnidado = doctorData[key];
                if (posibleAnidado && typeof posibleAnidado === 'object' && !Array.isArray(posibleAnidado)) {
                    valorEncontrado = buscarEnObjeto(posibleAnidado);
                    if (valorEncontrado) break;
                }
            }
        }

        return valorEncontrado;
    }

    // obtiene el doctor asignado a este paciente para poder
    // filtrar la disponibilidad de horarios por ese doctor específico
    private async cargarDoctorAsignado() {
        if (!this.patientId) {
            this.doctorId = null;
            console.warn('[cargarDoctorAsignado] patientId vacio, no se puede consultar el doctor asignado.');
            return;
        }

        try {
            const response = await firstValueFrom(
                this.usersService.getDoctorDePaciente(this.patientId)
            );

            // Log de diagnostico: deja esto o coméntalo una vez confirmado
            // que la extraccion funciona correctamente en tu backend.
            console.log('[cargarDoctorAsignado] respuesta cruda:', response);

            // Manejo flexible: el backend puede regresar el doctor en distintas formas
            let doctorData: any = null;

            if (response && typeof response === 'object') {
                if (response.hasOwnProperty('success') && response.hasOwnProperty('data')) {
                    doctorData = (response as any).data;
                } else if (Array.isArray(response)) {
                    doctorData = response.length > 0 ? response[0] : null;
                } else {
                    doctorData = response;
                }
            }

            console.log('[cargarDoctorAsignado] doctorData:', doctorData);

            this.doctorId = this.extraerDoctorId(doctorData);
            this.doctorNombre = this.extraerDoctorNombre(doctorData); // ⭐ NUEVO
            this.doctorEspecialidad = this.extraerDoctorEspecialidad(doctorData); // ⭐ NUEVO

            console.log('[cargarDoctorAsignado] doctorId extraido:', this.doctorId);
            console.log('[cargarDoctorAsignado] doctorNombre extraido:', this.doctorNombre); // ⭐ NUEVO

            if (!this.doctorId) {
                this.showWarning('Sin doctor asignado', 'No tienes un doctor asignado. Contacta al administrador para agendar una cita.');
            }

        } catch (error) {
            console.error('Error al obtener el doctor asignado:', error);
            this.doctorId = null;
            this.doctorNombre = ''; // ⭐ NUEVO
            this.doctorEspecialidad = ''; // ⭐ NUEVO
            this.showWarning('Sin doctor asignado', 'No se pudo identificar tu doctor asignado. Contacta al administrador.');
        }
    }

    private async cargarCitas() {
        try {
            let citasData: any[] = [];

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
                            correopaciente: c.correopaciente || c.correoPaciente || c.email,
                            // ⭐ NUEVO: si la cita no trae el nombre del medico, usamos el
                            // nombre del doctor asignado que obtuvimos en cargarDoctorAsignado()
                            medico: c.medico || c.nombreDoctor || c.doctor || this.doctorNombre || 'Medico',
                            especialidad: c.especialidad || this.doctorEspecialidad || c.especialidad
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
                // Fallback
            }

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
                            horacita: c.horacita || c.hora,
                            // ⭐ NUEVO: mismo respaldo de nombre de doctor en el fallback
                            medico: c.medico || c.nombreDoctor || c.doctor || this.doctorNombre || 'Medico',
                            especialidad: c.especialidad || this.doctorEspecialidad || c.especialidad
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
            this.showError('Error de Identificacion', 'No se pudo identificar al usuario. Por favor inicia sesion nuevamente.');
            return;
        }

        // no permitir agendar si no hay doctor asignado
        if (!this.doctorId) {
            this.showError('Sin doctor asignado', 'No tienes un doctor asignado. Contacta al administrador antes de agendar una cita.');
            return;
        }

        this.mostrarModalAgendar = true;
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');

        this.horarioDisponible = true;
        this.mensajeDisponibilidad = '';
        this.mostrandoHorarios = false;
        this.horarioSeleccionadoValido = true;
        this.horariosDisponibles = [];
        this.correoOcupante = null;

        this.citaForm.reset({
            modalidad: 'Presencial',
            motivo: '',
            sintomas: '',
            fechaCita: anio + '-' + mes + '-' + dia,
            horaCita: '10:00'
        });

        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
        setTimeout(() => this.inicializarCalendario(), 100);
    }

    cerrarModalAgendar() {
        this.mostrarModalAgendar = false;
        document.body.style.overflow = '';
        this.destruirCalendarios();
        this.mostrandoHorarios = false;
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

    inicializarCalendario() {
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
                const hoy = new Date();
                const fechaMaximaCita = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

                this.destruirCalendarios();

                const fechaInput = document.getElementById('fechaCitaInput');
                const horaInput = document.getElementById('horaCitaInput');

                if (fechaInput) {
                    this.fpFechaInstance = flatpickr(fechaInput, {
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
                            this.verificarDisponibilidadEnTiempoReal();
                            this.cargarHorariosDisponibles(dateStr);
                            this.cdr.detectChanges();
                        }
                    });
                }

                if (horaInput) {
                    this.fpHoraInstance = flatpickr(horaInput, {
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
                            this.verificarDisponibilidadEnTiempoReal();
                            this.cdr.detectChanges();
                        }
                    });
                }

                const fechaInicial = this.citaForm.get('fechaCita')?.value;
                if (fechaInicial) {
                    this.cargarHorariosDisponibles(fechaInicial);
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

    private async verificarDisponibilidadEnTiempoReal() {
        const fecha = this.citaForm.get('fechaCita')?.value;
        const hora = this.citaForm.get('horaCita')?.value;

        if (!fecha || !hora) {
            this.horarioDisponible = true;
            this.mensajeDisponibilidad = '';
            this.correoOcupante = null;
            return;
        }

        this.verificandoDisponibilidad = true;
        this.cdr.detectChanges();

        try {
            const disponibilidad = await firstValueFrom(
                this.usersService.verificarDisponibilidad(fecha, hora + ':00', this.userEmail, this.doctorId)
            );

            this.horarioDisponible = disponibilidad.disponible;
            this.mensajeDisponibilidad = disponibilidad.mensaje;
            this.correoOcupante = disponibilidad.detalles?.correoExistente || null;

            if (!disponibilidad.disponible) {
                this.citaForm.setErrors({ horarioOcupado: true });
                this.horarioSeleccionadoValido = false;

                if (disponibilidad.detalles) {
                    const detalles = disponibilidad.detalles;

                    if (detalles.yaAgendado && detalles.correoExistente && detalles.correoExistente !== this.userEmail) {
                        this.showWarning(
                            'Horario ocupado',
                            `Este horario ya está ocupado por ${detalles.correoExistente}. Por favor, selecciona otro horario.`
                        );
                    } else if (detalles.usuarioYaTieneCita) {
                        this.showWarning('Ya tienes cita', 'Ya tienes una cita agendada para esta fecha y hora.');
                    } else if (detalles.horaLlena) {
                        this.showWarning('Horario completo', 'Este horario ya está completo (3 citas agendadas).');
                    } else if (detalles.limiteDiaAlcanzado) {
                        this.showWarning('Límite diario alcanzado', 'Ya tienes 2 citas para este día.');
                    } else {
                        this.showWarning('Horario no disponible', this.mensajeDisponibilidad || 'El horario no está disponible.');
                    }
                }
            } else {
                this.citaForm.setErrors(null);
                this.horarioSeleccionadoValido = true;
                this.correoOcupante = null;
                this.showInfo('Horario disponible', 'Puedes agendar tu cita en este horario.');
            }

        } catch (error) {
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
                this.usersService.getHorariosDisponibles(fecha, this.userEmail, this.doctorId)
            );

            if (response && response.success) {
                this.horariosDisponibles = response.horariosDisponibles || [];
                this.mostrandoHorarios = this.horariosDisponibles.length > 0;

                if (this.horariosDisponibles.length === 1) {
                    const horaSugerida = this.horariosDisponibles[0];
                    this.seleccionarHorario(horaSugerida);
                    this.showInfo('Horario sugerido', `Solo hay un horario disponible: ${this.formatearHora(horaSugerida)}`);
                } else if (this.horariosDisponibles.length === 0) {
                    this.showWarning('Sin horarios', 'No hay horarios disponibles para esta fecha.');
                    this.mostrandoHorarios = false;
                } else {
                    const horariosTexto = this.horariosDisponibles.map(h => this.formatearHora(h)).join(', ');
                    this.showInfo('Horarios disponibles', `Horarios disponibles: ${horariosTexto}`);
                }
            }

            this.cdr.detectChanges();
        } catch (error) {
            this.mostrandoHorarios = false;
        }
    }

    seleccionarHorario(hora: string) {
        this.citaForm.patchValue({ horaCita: hora });
        this.citaForm.get('horaCita')?.markAsTouched();

        if (this.fpHoraInstance) {
            try {
                const hoy = new Date();
                const [h, m] = hora.split(':').map(Number);
                hoy.setHours(h, m, 0, 0);
                this.fpHoraInstance.setDate(hoy, false);
            } catch (e) {
                // Error actualizando flatpickr hora
            }
        }

        this.verificarDisponibilidadEnTiempoReal();
        this.cdr.detectChanges();
    }

    async agendarCita() {
        if (this.citaForm.invalid) {
            this.citaForm.markAllAsTouched();
            this.showWarning('Formulario Incompleto', 'Por favor, completa todos los campos requeridos.');
            return;
        }

        if (!this.horarioDisponible) {
            this.showWarning('Horario no disponible', this.mensajeDisponibilidad || 'El horario seleccionado no está disponible.');
            return;
        }

        if (!this.horarioSeleccionadoValido) {
            this.showWarning('Horario no válido', 'Por favor, selecciona un horario disponible de la lista.');
            return;
        }

        // no permitir agendar sin doctor asignado
        if (!this.doctorId) {
            this.showError('Sin doctor asignado', 'No tienes un doctor asignado. Contacta al administrador.');
            return;
        }

        this.cargandoAgendar = true;
        this.cdr.detectChanges();

        try {
            const formData = this.citaForm.value;

            if (!this.userEmail) {
                this.showError('Error de Identificacion', 'No se pudo identificar al usuario.');
                this.cargandoAgendar = false;
                return;
            }

            const disponibilidadFinal = await firstValueFrom(
                this.usersService.verificarDisponibilidad(
                    formData.fechaCita,
                    formData.horaCita + ':00',
                    this.userEmail,
                    this.doctorId
                )
            );

            if (!disponibilidadFinal.disponible) {
                this.showError(
                    'Horario ocupado',
                    disponibilidadFinal.mensaje || 'El horario seleccionado ya no está disponible. Por favor, selecciona otro.'
                );
                this.horarioDisponible = false;
                this.horarioSeleccionadoValido = false;
                this.cargandoAgendar = false;
                this.cargarHorariosDisponibles(formData.fechaCita);
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
                idDoctor: this.doctorId // guardamos a qué doctor pertenece la cita
            };

            await firstValueFrom(
                this.usersService.crearCita(datosCita)
            );

            this.cerrarModalAgendar();
            this.showSuccess(
                'Cita Agendada',
                'Tu cita ha sido agendada exitosamente. Recibiras un recordatorio 24 horas antes.'
            );

            await this.cargarCitas();

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al agendar tu cita.';

            if (error.error && error.error.error) {
                mensajeError = error.error.error;
                if (mensajeError.includes('horario no disponible') ||
                    mensajeError.includes('ya hay 3 citas') ||
                    mensajeError.includes('ocupado por')) {
                    this.horarioDisponible = false;
                    this.horarioSeleccionadoValido = false;
                    const fecha = this.citaForm.get('fechaCita')?.value;
                    if (fecha) {
                        this.cargarHorariosDisponibles(fecha);
                    }
                }
            } else if (error.error && typeof error.error === 'string') {
                mensajeError = error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.showError('Error al Agendar', mensajeError);
        } finally {
            this.cargandoAgendar = false;
            this.destruirCalendarios();
            this.cdr.detectChanges();
        }
    }

    confirmarCancelarCita(cita: any) {
        const estado = (cita.estado || '').toLowerCase();
        if (estado === 'cancelada') {
            this.showWarning('Cita ya cancelada', 'Esta cita ya ha sido cancelada anteriormente.');
            return;
        }
        if (estado === 'completada' || estado === 'realizada' || estado === 'finalizada') {
            this.showWarning('No se puede cancelar', 'No se puede cancelar una cita que ya ha sido completada.');
            return;
        }

        this.mostrarConfirmacionCancelar(cita);
    }

    async ejecutarCancelarCita() {
        if (!this.citaParaCancelar) {
            this.cerrarModalConfirmacionCancelar();
            return;
        }

        this.cargandoCancelar = true;
        this.cdr.detectChanges();

        try {
            const cita = this.citaParaCancelar;
            const idCita = cita.idcita || cita.id;

            if (!idCita) {
                this.showError('Error', 'No se pudo identificar la cita a cancelar.');
                this.cargandoCancelar = false;
                this.cerrarModalConfirmacionCancelar();
                return;
            }

            const idNumerico = typeof idCita === 'string' ? parseInt(idCita, 10) : idCita;

            if (isNaN(idNumerico) || idNumerico <= 0) {
                this.showError('Error', 'ID de cita invalido.');
                this.cargandoCancelar = false;
                this.cerrarModalConfirmacionCancelar();
                return;
            }

            await firstValueFrom(
                this.usersService.cancelarCita(idNumerico, 'Cancelada por el paciente')
            );

            this.cerrarModalConfirmacionCancelar();
            this.cerrarModalDetalle();

            this.showSuccess(
                'Cita Cancelada',
                'Tu cita ha sido cancelada exitosamente. Si necesitas reagendar, hazlo desde el menu principal.'
            );

            setTimeout(async () => {
                await this.cargarCitas();
                this.cdr.detectChanges();
            }, 300);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al cancelar tu cita.';

            if (error.error && error.error.error) {
                mensajeError = error.error.error;
            } else if (error.error && typeof error.error === 'string') {
                mensajeError = error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }

            this.showError('Error al Cancelar', mensajeError);
            this.cerrarModalConfirmacionCancelar();
        } finally {
            this.cargandoCancelar = false;
            this.cdr.detectChanges();
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