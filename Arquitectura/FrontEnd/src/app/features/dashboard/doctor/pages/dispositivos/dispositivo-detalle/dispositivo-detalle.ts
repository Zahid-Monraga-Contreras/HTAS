import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
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

interface Medicion {
    idmedicion: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    fechahoralectura: string;
    metodoclasificacion?: string;
    clasificacionpresion?: string;
}

@Component({
    selector: 'app-doctor-dispositivo-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, DoctorMenu],
    templateUrl: './dispositivo-detalle.html',
    styleUrls: ['./dispositivo-detalle.css']
})
export class DoctorDispositivoDetalle implements OnInit {
    private usersService = inject(Users);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    dispositivoId: number | null = null;
    dispositivo: any = null;
    cargandoAccion = false;

    // Mediciones
    mediciones: any[] = [];
    cargandoMediciones = false;
    filtroFecha: string = '';

    // Getter para usar en el template (evita ExpressionChangedAfterItHasBeenCheckedError)
    get medicionesFiltradas(): any[] {
        return this.mediciones;
    }

    // Modal de medicion
    mostrarModalMedicion = false;
    medicionActual: Medicion | null = null;
    obteniendoMedicion = false;
    medicionError = '';
    medicionLogs: string[] = [];
    medicionCompletada = false;

    // Notificaciones
    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    // Modal de confirmacion
    mostrarModalConfirmacion = false;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        accion: ''
    };
    cargandoEliminar = false;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.route.params.subscribe(params => {
            this.dispositivoId = +params['id'];
            if (this.dispositivoId) {
                this.cargarDispositivo(this.dispositivoId);
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

    async cargarDispositivo(id: number) {
        this.isLoading = true;
        try {
            const dispositivos = await firstValueFrom(this.usersService.getDispositivos());

            if (Array.isArray(dispositivos)) {
                const encontrado = dispositivos.find(d => {
                    const dispositivoId = d.iddispositivo || d.IdDispositivo || d.id;
                    return dispositivoId === id;
                });

                if (encontrado) {
                    // Construir el objeto primero
                    const dispositivoData = {
                        ...encontrado,
                        iddispositivo: encontrado.iddispositivo || encontrado.IdDispositivo || encontrado.id,
                        nombre: encontrado.nombre || 'Dispositivo sin nombre',
                        direccionmac: encontrado.direccionmac || encontrado.direccionMac || 'No especificada',
                        idpacienteasociado: encontrado.idpacienteasociado || encontrado.idPacienteAsociado,
                        activo: encontrado.activo !== false,
                        ultimasincronizacion: encontrado.ultimasincronizacion || null,
                        nombrepaciente: this.obtenerNombrePaciente(encontrado),
                        appaternopaciente: encontrado.appaternopaciente || ''
                    };

                    // Asignar todo de una vez
                    this.dispositivo = dispositivoData;
                    this.cdr.detectChanges();

                    // Cargar mediciones después de tener el dispositivo
                    if (this.dispositivo.idpacienteasociado) {
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
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private obtenerNombrePaciente(dispositivo: any): string {
        const nombre = dispositivo.nombrepaciente || dispositivo.nombrePaciente || '';
        const apPaterno = dispositivo.appaternopaciente || dispositivo.apPaternoPaciente || '';
        const apMaterno = dispositivo.apmaternopaciente || dispositivo.apMaternoPaciente || '';

        if (nombre || apPaterno || apMaterno) {
            return `${nombre} ${apPaterno} ${apMaterno}`.trim();
        }
        return 'Sin asignar';
    }

    // ==========================================
    // MEDICIONES
    // ==========================================

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
                    sistolica: m.sistolica || m.Sistolica,
                    diastolica: m.diastolica || m.Diastolica,
                    pulso: m.pulso || m.Pulso,
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

    // Función para formatear fechas desde el backend (maneja múltiples formatos)
    private formatearFechaDesdeBackend(fecha: any): string {
        if (!fecha) return 'Sin fecha';

        try {
            if (typeof fecha === 'string') {
                const fechaObj = new Date(fecha);
                if (!isNaN(fechaObj.getTime())) {
                    return this.formatearFechaCompleta(fechaObj);
                }

                const partes = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
                if (partes) {
                    const dia = partes[1];
                    const mes = partes[2];
                    const anio = partes[3];
                    const horas = partes[4];
                    const minutos = partes[5];
                    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
                }

                return fecha;
            }

            if (fecha instanceof Date) {
                return this.formatearFechaCompleta(fecha);
            }

            return 'Sin fecha';
        } catch (error) {
            console.error('Error al formatear fecha:', error);
            return 'Sin fecha';
        }
    }

    private formatearFechaCompleta(fecha: Date): string {
        if (!fecha || isNaN(fecha.getTime())) return 'Sin fecha';

        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        const anio = fecha.getFullYear();
        const horas = String(fecha.getHours()).padStart(2, '0');
        const minutos = String(fecha.getMinutes()).padStart(2, '0');

        return `${dia} de ${mes} ${anio} ${horas}:${minutos}`;
    }

    async tomarMedicion() {
        if (!this.dispositivo || !this.dispositivo.idpacienteasociado) {
            this.showError('Error', 'El dispositivo no esta asignado a un paciente');
            return;
        }

        this.obteniendoMedicion = true;
        this.medicionError = '';
        this.medicionActual = null;
        this.medicionLogs = [];
        this.medicionCompletada = false;
        this.mostrarModalMedicion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();

        this.agregarLog('Iniciando escaneo de dispositivos Bluetooth...');
        this.agregarLog('Asegurate de que el tensiometro este ENCENDIDO');
        this.agregarLog('Presiona START en el tensiometro si es necesario');

        try {
            const response = await firstValueFrom(
                this.usersService.obtenerMedicionTensiometro(this.dispositivo.idpacienteasociado)
            );

            if (response && response.success && response.medicion) {
                const medicion = response.medicion;

                let fechaFormateada = this.formatearFechaDesdeBackend(
                    medicion.fechahoralectura || medicion.FechaHoraLectura
                );

                this.medicionActual = {
                    idmedicion: medicion.idmedicion || medicion.IdMedicion || 0,
                    sistolica: medicion.sistolica || medicion.Sistolica || 0,
                    diastolica: medicion.diastolica || medicion.Diastolica || 0,
                    pulso: medicion.pulso || medicion.Pulso || 0,
                    fechahoralectura: fechaFormateada || this.formatearFechaAhora(),
                    metodoclasificacion: medicion.metodoclasificacion || medicion.MetodoSincronizacion || 'Bluetooth',
                    clasificacionpresion: medicion.clasificacionpresion || this.calcularClasificacion(
                        medicion.sistolica || medicion.Sistolica || 0,
                        medicion.diastolica || medicion.Diastolica || 0
                    )
                };

                this.medicionCompletada = true;
                this.agregarLog('Medicion completada exitosamente');
                this.agregarLog(`Sistolica: ${this.medicionActual.sistolica} mmHg`);
                this.agregarLog(`Diastolica: ${this.medicionActual.diastolica} mmHg`);
                this.agregarLog(`Pulso: ${this.medicionActual.pulso} bpm`);
                this.agregarLog(`Clasificacion: ${this.medicionActual.clasificacionpresion}`);

                this.showSuccess('Exito', 'Medicion obtenida correctamente');

                // Recargar mediciones
                if (this.dispositivo.idpacienteasociado) {
                    await this.cargarMediciones(this.dispositivo.idpacienteasociado);
                }
            } else {
                this.medicionError = response?.error || 'No se pudo obtener la medicion';
                this.agregarLog(`Error: ${this.medicionError}`);
                this.showError('Error', this.medicionError);
            }

        } catch (error: any) {
            console.error('Error al tomar medicion:', error);
            this.medicionError = error.error?.error || error.message || 'Error al obtener la medicion';
            this.agregarLog(`Error: ${this.medicionError}`);
            this.showError('Error', this.medicionError);
        } finally {
            this.obteniendoMedicion = false;
            this.cdr.detectChanges();
        }
    }

    private agregarLog(mensaje: string) {
        this.medicionLogs.push(mensaje);
        this.cdr.detectChanges();
    }

    private formatearFechaAhora(): string {
        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, '0');
        const mes = String(ahora.getMonth() + 1).padStart(2, '0');
        const anio = ahora.getFullYear();
        const horas = String(ahora.getHours()).padStart(2, '0');
        const minutos = String(ahora.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
    }

    private calcularClasificacion(sistolica: number, diastolica: number): string {
        if (sistolica < 120 && diastolica < 80) return 'Normal';
        if (sistolica >= 120 && sistolica <= 129 && diastolica < 80) return 'Elevada';
        if ((sistolica >= 130 && sistolica <= 139) || (diastolica >= 80 && diastolica <= 89)) return 'Hipertension Grado 1';
        if (sistolica >= 140 || diastolica >= 90) return 'Hipertension Grado 2';
        return 'Crisis Hipertensiva';
    }

    cerrarModalMedicion() {
        this.mostrarModalMedicion = false;
        this.medicionActual = null;
        this.medicionError = '';
        this.medicionLogs = [];
        this.medicionCompletada = false;
        document.body.style.overflow = '';
        this.cdr.detectChanges();
    }

    // ==========================================
    // ACCIONES DEL DISPOSITIVO
    // ==========================================

    async sincronizarDispositivo() {
        if (!this.dispositivoId) return;

        this.cargandoAccion = true;
        this.cdr.detectChanges();

        try {
            await firstValueFrom(
                this.usersService.sincronizarDispositivo(this.dispositivoId)
            );

            this.showSuccess('Exito', 'Dispositivo sincronizado correctamente');
            await this.cargarDispositivo(this.dispositivoId);

        } catch (error) {
            console.error('Error al sincronizar dispositivo:', error);
            this.showError('Error', 'Error al sincronizar el dispositivo');
        } finally {
            this.cargandoAccion = false;
            this.cdr.detectChanges();
        }
    }

    async toggleEstado() {
        if (!this.dispositivoId || !this.dispositivo) return;

        this.cargandoAccion = true;
        this.cdr.detectChanges();

        try {
            const nuevoEstado = !this.dispositivo.activo;

            if (nuevoEstado) {
                await firstValueFrom(
                    this.usersService.activarDispositivo(this.dispositivoId)
                );
                this.showSuccess('Exito', 'Dispositivo activado correctamente');
            } else {
                await firstValueFrom(
                    this.usersService.desactivarDispositivo(this.dispositivoId)
                );
                this.showSuccess('Exito', 'Dispositivo desactivado correctamente');
            }

            await this.cargarDispositivo(this.dispositivoId);

        } catch (error) {
            console.error('Error al cambiar estado:', error);
            this.showError('Error', 'Error al cambiar el estado del dispositivo');
        } finally {
            this.cargandoAccion = false;
            this.cdr.detectChanges();
        }
    }

    mostrarConfirmacionEliminar() {
        this.modalConfirmacion = {
            titulo: 'Eliminar Dispositivo',
            mensaje: 'Esta seguro de que desea eliminar este dispositivo? Esta accion no se puede deshacer.',
            accion: 'eliminar'
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        document.body.style.overflow = '';
        this.cdr.detectChanges();
    }

    async ejecutarEliminarDispositivo() {
        this.cargandoEliminar = true;
        this.cdr.detectChanges();

        try {
            const id = this.dispositivo.iddispositivo || this.dispositivo.id;

            await firstValueFrom(this.usersService.eliminarDispositivo(id));

            this.cerrarModalConfirmacion();
            this.showSuccess(
                'Dispositivo Eliminado',
                'El dispositivo ha sido eliminado exitosamente.'
            );

            setTimeout(() => {
                this.router.navigate(['/doctor/dispositivos']);
            }, 1000);

        } catch (error: any) {
            let mensajeError = 'Ocurrio un error al eliminar el dispositivo.';
            if (error.error?.error) {
                mensajeError = error.error.error;
            } else if (error.message) {
                mensajeError = error.message;
            }
            this.showError('Error al Eliminar', mensajeError);
            this.cerrarModalConfirmacion();
        } finally {
            this.cargandoEliminar = false;
            this.cdr.detectChanges();
        }
    }

    volver() {
        this.router.navigate(['/doctor/dispositivos']);
    }

    // ==========================================
    // METODOS DE UTILIDAD PARA FECHAS EN EL HTML
    // ==========================================

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

            const partes = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (partes) {
                return `${partes[1]}/${partes[2]}/${partes[3]}`;
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

            const partes = fecha.match(/(\d{2}):(\d{2})/);
            if (partes) {
                return `${partes[1]}:${partes[2]}`;
            }

            return '';
        } catch {
            return '';
        }
    }

    formatearFechaCompletaModal(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const fechaObj = new Date(fecha);
            if (!isNaN(fechaObj.getTime())) {
                const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
                const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const dia = fechaObj.getDate();
                const mes = meses[fechaObj.getMonth()];
                const anio = fechaObj.getFullYear();
                const horas = String(fechaObj.getHours()).padStart(2, '0');
                const minutos = String(fechaObj.getMinutes()).padStart(2, '0');
                return `${dia} de ${mes} ${anio} ${horas}:${minutos}`;
            }
            return fecha;
        } catch {
            return fecha;
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

    getClasificacionDescripcion(clasificacion: string): string {
        if (!clasificacion) return '';
        if (clasificacion === 'Normal') return 'Presion arterial normal';
        if (clasificacion === 'Elevada') return 'Presion arterial elevada';
        if (clasificacion === 'Hipertension Grado 1') return 'Hipertension grado 1';
        if (clasificacion === 'Hipertension Grado 2') return 'Hipertension grado 2';
        return 'Crisis hipertensiva';
    }
}