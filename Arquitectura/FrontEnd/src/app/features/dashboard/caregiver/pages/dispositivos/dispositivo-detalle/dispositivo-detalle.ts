import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../../template/menu/menu";
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
    selector: 'app-caregiver-dispositivo-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, CaregiverMenu],
    templateUrl: './dispositivo-detalle.html',
    styleUrls: ['./dispositivo-detalle.css']
})
export class CaregiverDispositivoDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    dispositivoId: number | null = null;
    dispositivo: any = null;
    caregiverId: number | null = null;
    tieneAcceso: boolean = false;
    solicitudEnviada: boolean = false;

    mediciones: any[] = [];
    cargandoMediciones = false;
    filtroFecha: string = '';

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    private pacientesMap: Map<number, any> = new Map();

    // Modal de solicitud
    mostrarModalSolicitud: boolean = false;
    pacienteSolicitado: any = null;
    parentesco: string = '';
    notasSolicitud: string = '';
    enviandoSolicitud: boolean = false;

    parentescos = [
        'Padre', 'Madre', 'Hermano', 'Hermana', 'Tio', 'Tia',
        'Primo', 'Prima', 'Abuelo', 'Abuela', 'Conyuge', 'Otro'
    ];

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        const storedUser = localStorage.getItem('user_htas');
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            this.caregiverId = userData.idusuario || userData.uid || null;
        }

        this.route.params.subscribe(params => {
            this.dispositivoId = +params['id'];
            if (this.dispositivoId) {
                this.cargarDatosIniciales();
            }
        });
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
        this.isLoading = true;
        try {
            await this.cargarPacientes();
            if (this.dispositivoId) {
                await this.cargarDispositivo(this.dispositivoId);
            }
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            this.showError('Error', 'No se pudieron cargar los datos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarPacientes() {
        try {
            const usuarios = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(usuarios)) {
                const pacientes = usuarios.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );

                this.pacientesMap.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesMap.set(id, p);
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
        }
    }

    async cargarDispositivo(id: number) {
        try {
            const dispositivos = await firstValueFrom(this.usersService.getDispositivos());

            if (Array.isArray(dispositivos)) {
                const encontrado = dispositivos.find(d => {
                    const dispositivoId = d.iddispositivo || d.IdDispositivo || d.id;
                    return dispositivoId === id;
                });

                if (encontrado) {
                    const idPaciente = encontrado.idpacienteasociado || encontrado.idPacienteAsociado;
                    let nombrePaciente = 'Sin asignar';

                    let tieneAccesoPaciente = false;
                    if (idPaciente) {
                        try {
                            const pacientesAsignados = await firstValueFrom(
                                this.usersService.getPacientesAsignados(this.caregiverId!)
                            );
                            if (Array.isArray(pacientesAsignados)) {
                                tieneAccesoPaciente = pacientesAsignados.some(p =>
                                    (p.idusuario || p.id) === idPaciente
                                );
                            }
                        } catch (error) {
                            console.error('Error al verificar acceso:', error);
                        }
                    }

                    if (idPaciente && this.pacientesMap.has(idPaciente)) {
                        const paciente = this.pacientesMap.get(idPaciente);
                        const nombre = paciente.nombre || '';
                        const apPaterno = paciente.apPaterno || '';
                        const apMaterno = paciente.apMaterno || '';
                        nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        if (!nombrePaciente) {
                            nombrePaciente = paciente.correo || 'Sin asignar';
                        }
                    }

                    this.dispositivo = {
                        ...encontrado,
                        iddispositivo: encontrado.iddispositivo || encontrado.IdDispositivo || encontrado.id,
                        nombre: encontrado.nombre || 'Dispositivo sin nombre',
                        direccionmac: encontrado.direccionmac || encontrado.direccionMac || 'No especificada',
                        idpacienteasociado: idPaciente,
                        activo: encontrado.activo !== false,
                        ultimasincronizacion: encontrado.ultimasincronizacion || null,
                        nombrepaciente: nombrePaciente,
                        tieneAcceso: tieneAccesoPaciente,
                        correoPaciente: idPaciente && this.pacientesMap.has(idPaciente) ? this.pacientesMap.get(idPaciente).correo : ''
                    };

                    this.tieneAcceso = tieneAccesoPaciente;

                    if (!this.tieneAcceso) {
                        await this.verificarSolicitudesPendientes(idPaciente);
                    }

                    if (this.tieneAcceso && this.dispositivo.idpacienteasociado) {
                        await this.cargarMediciones(this.dispositivo.idpacienteasociado);
                    }
                } else {
                    this.showError('Error', 'Dispositivo no encontrado');
                }
            } else {
                this.showError('Error', 'No se pudieron cargar los dispositivos');
            }

        } catch (error) {
            console.error('Error al cargar dispositivo:', error);
            this.showError('Error', 'No se pudo cargar la informacion del dispositivo.');
        }
    }

    private async verificarSolicitudesPendientes(idPaciente: number) {
        try {
            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId!)
            );
            if (Array.isArray(solicitudes)) {
                const pendiente = solicitudes.some(s =>
                    s.idpaciente === idPaciente && s.estado === 'pendiente'
                );
                this.solicitudEnviada = pendiente;
            }
        } catch (error) {
            console.error('Error al verificar solicitudes pendientes:', error);
        }
    }

    async cargarMediciones(idPaciente: number) {
        this.cargandoMediciones = true;
        this.cdr.detectChanges();

        try {
            const data = await firstValueFrom(
                this.usersService.getMedicionesPaciente(idPaciente, 20)
            );

            if (data && data.mediciones) {
                this.mediciones = data.mediciones.map((m: any) => ({
                    ...m,
                    idmedicion: m.idmedicion || m.IdMedicion,
                    sistolica: m.sistolica || m.Sistolica || 0,
                    diastolica: m.diastolica || m.Diastolica || 0,
                    pulso: m.pulso || m.Pulso || 0,
                    fechahoralectura: this.formatearFechaDesdeBackend(m.fechahoralectura || m.FechaHoraLectura),
                    clasificacionpresion: m.clasificacionpresion || m.ClasificacionPresion || this.calcularClasificacion(
                        m.sistolica || m.Sistolica || 0,
                        m.diastolica || m.Diastolica || 0
                    )
                }));
                this.cdr.detectChanges();
            }
        } catch (error) {
            console.error('Error al cargar mediciones:', error);
        } finally {
            this.cargandoMediciones = false;
            this.cdr.detectChanges();
        }
    }

    private formatearFechaDesdeBackend(fecha: any): string {
        if (!fecha) return 'Sin fecha';
        try {
            if (typeof fecha === 'string') {
                const fechaObj = new Date(fecha);
                if (!isNaN(fechaObj.getTime())) {
                    return this.formatearFechaCompleta(fechaObj);
                }
                return fecha;
            }
            if (fecha instanceof Date) {
                return this.formatearFechaCompleta(fecha);
            }
            return 'Sin fecha';
        } catch {
            return 'Sin fecha';
        }
    }

    private formatearFechaCompleta(fecha: Date): string {
        if (!fecha || isNaN(fecha.getTime())) return 'Sin fecha';
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        const anio = fecha.getFullYear();
        const horas = String(fecha.getHours()).padStart(2, '0');
        const minutos = String(fecha.getMinutes()).padStart(2, '0');
        return `${dia} de ${mes} ${anio} ${horas}:${minutos}`;
    }

    private calcularClasificacion(sistolica: number, diastolica: number): string {
        if (sistolica < 120 && diastolica < 80) return 'Normal';
        if (sistolica >= 120 && sistolica <= 129 && diastolica < 80) return 'Elevada';
        if ((sistolica >= 130 && sistolica <= 139) || (diastolica >= 80 && diastolica <= 89)) return 'Hipertension Grado 1';
        if (sistolica >= 140 || diastolica >= 90) return 'Hipertension Grado 2';
        return 'Crisis Hipertensiva';
    }

    // ============================================
    // SOLICITAR ACCESO
    // ============================================
    solicitarAcceso() {
        if (this.solicitudEnviada) {
            this.showWarning('Solicitud pendiente',
                'Ya tienes una solicitud pendiente para este paciente. Espera la aprobacion del administrador.');
            return;
        }

        if (!this.dispositivo || !this.dispositivo.idpacienteasociado) {
            this.showError('Error', 'No se puede solicitar acceso sin un paciente asociado');
            return;
        }

        const idPaciente = this.dispositivo.idpacienteasociado;
        const pacienteData = this.pacientesMap.get(idPaciente);

        if (!pacienteData) {
            this.showError('Error', 'No se encontro informacion del paciente');
            return;
        }

        const nombre = pacienteData.nombre || '';
        const apPaterno = pacienteData.apPaterno || '';
        const apMaterno = pacienteData.apMaterno || '';
        const nombreCompleto = `${nombre} ${apPaterno} ${apMaterno}`.trim() || 'Paciente';

        this.pacienteSolicitado = {
            idpaciente: idPaciente,
            nombrePaciente: nombreCompleto,
            correo: pacienteData.correo || ''
        };

        this.parentesco = '';
        this.notasSolicitud = '';
        this.mostrarModalSolicitud = true;
        this.cdr.detectChanges();
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.pacienteSolicitado = null;
        this.parentesco = '';
        this.notasSolicitud = '';
        this.enviandoSolicitud = false;
    }

    async enviarSolicitud() {
        if (!this.parentesco) {
            this.showWarning('Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            const paciente = this.pacienteSolicitado;
            const correoPaciente = paciente.correo || '';

            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: correoPaciente,
                    parentesco: this.parentesco,
                    notas: this.notasSolicitud
                })
            );

            this.showSuccess('Solicitud enviada',
                'Tu solicitud ha sido enviada. Espera la aprobacion del administrador.');

            this.solicitudEnviada = true;
            this.cerrarModalSolicitud();

        } catch (error: any) {
            if (error.error?.error === 'Ya tienes una solicitud pendiente para este paciente') {
                this.showWarning('Solicitud pendiente',
                    'Ya tienes una solicitud pendiente para este paciente. Espera la aprobacion.');
                this.solicitudEnviada = true;
            } else {
                const mensaje = error.error?.error || 'Error al enviar la solicitud';
                this.showError('Error', mensaje);
            }
        } finally {
            this.enviandoSolicitud = false;
        }
    }

    volver() {
        this.router.navigate(['/caregiver/dispositivos']);
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const fechaObj = new Date(fecha);
            if (!isNaN(fechaObj.getTime())) {
                const dia = String(fechaObj.getDate()).padStart(2, '0');
                const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
                const anio = fechaObj.getFullYear();
                return `${dia}/${mes}/${anio}`;
            }
            return fecha;
        } catch {
            return fecha;
        }
    }

    formatearHoraHistorial(fecha: string): string {
        if (!fecha) return '';
        try {
            const fechaObj = new Date(fecha);
            if (!isNaN(fechaObj.getTime())) {
                const horas = String(fechaObj.getHours()).padStart(2, '0');
                const minutos = String(fechaObj.getMinutes()).padStart(2, '0');
                return `${horas}:${minutos}`;
            }
            return '';
        } catch {
            return '';
        }
    }

    formatearFechaUltimaSincronizacion(fecha: string): string {
        if (!fecha) return 'No sincronizado';
        try {
            const d = new Date(fecha);
            if (!isNaN(d.getTime())) {
                const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
            }
            return fecha;
        } catch {
            return fecha;
        }
    }

    getEstadoClass(activo: boolean): string {
        return activo ? 'estado-activo' : 'estado-inactivo';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    getEstadoIcon(activo: boolean): string {
        return activo ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
    }

    getClasificacionColor(clasificacion: string): string {
        if (!clasificacion) return '';
        const clasificacionLower = clasificacion.toLowerCase();
        if (clasificacionLower === 'normal') return 'clasificacion-normal';
        if (clasificacionLower.includes('elevada')) return 'clasificacion-elevada';
        if (clasificacionLower.includes('grado 1')) return 'clasificacion-grado1';
        if (clasificacionLower.includes('grado 2')) return 'clasificacion-grado2';
        return 'clasificacion-crisis';
    }
}