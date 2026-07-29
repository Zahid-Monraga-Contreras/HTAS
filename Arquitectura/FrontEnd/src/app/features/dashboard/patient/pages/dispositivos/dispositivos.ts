import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PatientMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface Dispositivo {
    iddispositivo: number;
    nombre: string;
    direccionmac: string;
    idpacienteasociado: number | null;
    activo: boolean;
    ultimasincronizacion: string;
    nombrepaciente?: string;
    appaternopaciente?: string;
}

interface Medicion {
    idmedicion: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    fechahoralectura: string;
    metodoclasificacion?: string;
    clasificacionpresion?: string;
    fechahoralectura_raw?: string;
}

@Component({
    selector: 'app-patient-dispositivos',
    standalone: true,
    imports: [CommonModule, FormsModule, PatientMenu],
    templateUrl: './dispositivos.html',
    styleUrls: ['./dispositivos.css']
})
export class PatientDispositivos implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    patientId: number | null = null;
    patientName: string = '';
    patientFullName: string = '';
    userEmail: string = '';

    dispositivos: Dispositivo[] = [];
    dispositivosFiltrados: Dispositivo[] = [];
    filterEstado: string = 'todos';

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0
    };

    mostrarModalDetalle = false;
    dispositivoSeleccionado: Dispositivo | null = null;

    mostrarModalNuevoDispositivo = false;
    nuevoDispositivo: {
        nombre: string;
        direccionMac: string;
        idPacienteAsociado: number | null;
    } = {
            nombre: '',
            direccionMac: '',
            idPacienteAsociado: null
        };
    guardandoDispositivo = false;

    mostrarModalMedicion = false;
    medicionActual: Medicion | null = null;
    obteniendoMedicion = false;
    medicionError = '';

    // Mensajes del script Python en tiempo real
    medicionLogs: string[] = [];
    medicionCompletada = false;

    searchTerm: string = '';

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

            if (this.patientId) {
                await this.cargarDispositivos();
            }

        } catch (error) {
            console.error('Error al cargar dispositivos:', error);
        } finally {
            this.isLoading = false;
            this.cdr.markForCheck();
        }
    }

    private async cargarDispositivos() {
        try {
            if (!this.patientId) return;

            const response = await firstValueFrom(
                this.usersService.getDispositivosByPaciente(this.patientId)
            );

            if (response && Array.isArray(response)) {
                this.dispositivos = response.map((d: any) => ({
                    iddispositivo: d.iddispositivo,
                    nombre: d.nombre || 'Dispositivo sin nombre',
                    direccionmac: d.direccionmac || 'No especificada',
                    idpacienteasociado: d.idpacienteasociado,
                    activo: d.activo !== false,
                    ultimasincronizacion: d.ultimasincronizacion || null,
                    nombrepaciente: d.nombrepaciente || this.patientName,
                    appaternopaciente: d.appaternopaciente || ''
                }));

                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
                this.cdr.markForCheck();
            }
        } catch (error) {
            console.error('Error al cargar dispositivos:', error);
            this.dispositivos = [];
        }
    }

    private calcularEstadisticas() {
        this.estadisticas.total = this.dispositivos.length;
        this.estadisticas.activos = this.dispositivos.filter(d =>
            d.activo === true
        ).length;
        this.estadisticas.inactivos = this.dispositivos.filter(d =>
            d.activo === false
        ).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todos') {
            this.dispositivosFiltrados = [...this.dispositivos];
        } else if (estado === 'activos') {
            this.dispositivosFiltrados = this.dispositivos.filter(d => d.activo === true);
        } else if (estado === 'inactivos') {
            this.dispositivosFiltrados = this.dispositivos.filter(d => d.activo === false);
        }
        this.cdr.markForCheck();
    }

    get dispositivosPaginados() {
        const busqueda = this.searchTerm.toLowerCase().trim();
        if (!busqueda) return this.dispositivosFiltrados;

        return this.dispositivosFiltrados.filter(d =>
            d.nombre.toLowerCase().includes(busqueda) ||
            d.direccionmac.toLowerCase().includes(busqueda)
        );
    }

    verDetalle(dispositivo: Dispositivo) {
        this.dispositivoSeleccionado = dispositivo;
        this.mostrarModalDetalle = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    cerrarModalDetalle() {
        this.mostrarModalDetalle = false;
        this.dispositivoSeleccionado = null;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    abrirModalNuevoDispositivo() {
        this.nuevoDispositivo = {
            nombre: '',
            direccionMac: '',
            idPacienteAsociado: this.patientId
        };
        this.mostrarModalNuevoDispositivo = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    cerrarModalNuevoDispositivo() {
        this.mostrarModalNuevoDispositivo = false;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    async guardarDispositivo() {
        if (!this.nuevoDispositivo.nombre.trim() || !this.nuevoDispositivo.direccionMac.trim()) {
            this.mostrarNotificacion('Error', 'Por favor completa todos los campos', 'error');
            return;
        }

        this.guardandoDispositivo = true;
        this.cdr.markForCheck();

        try {
            const datos = {
                nombre: this.nuevoDispositivo.nombre.trim(),
                direccionMac: this.nuevoDispositivo.direccionMac.trim().toUpperCase(),
                idPacienteAsociado: this.patientId
            };

            await firstValueFrom(
                this.usersService.crearDispositivo(datos)
            );

            this.mostrarNotificacion('Exito', 'Dispositivo vinculado correctamente', 'success');
            this.cerrarModalNuevoDispositivo();
            await this.cargarDispositivos();

        } catch (error: any) {
            console.error('Error al guardar dispositivo:', error);
            let mensaje = 'Error al vincular el dispositivo';
            if (error.error && error.error.error) {
                mensaje = error.error.error;
            }
            this.mostrarNotificacion('Error', mensaje, 'error');
        } finally {
            this.guardandoDispositivo = false;
            this.cdr.markForCheck();
        }
    }

    async sincronizarDispositivo(id: number) {
        try {
            await firstValueFrom(
                this.usersService.sincronizarDispositivo(id)
            );

            this.mostrarNotificacion('Exito', 'Dispositivo sincronizado correctamente', 'success');
            await this.cargarDispositivos();

        } catch (error) {
            console.error('Error al sincronizar dispositivo:', error);
            this.mostrarNotificacion('Error', 'Error al sincronizar el dispositivo', 'error');
        }
    }

    async toggleEstadoDispositivo(dispositivo: Dispositivo) {
        try {
            const nuevoEstado = !dispositivo.activo;

            if (nuevoEstado) {
                await firstValueFrom(
                    this.usersService.activarDispositivo(dispositivo.iddispositivo)
                );
                this.mostrarNotificacion('Exito', 'Dispositivo activado correctamente', 'success');
            } else {
                await firstValueFrom(
                    this.usersService.desactivarDispositivo(dispositivo.iddispositivo)
                );
                this.mostrarNotificacion('Exito', 'Dispositivo desactivado correctamente', 'success');
            }

            await this.cargarDispositivos();

        } catch (error) {
            console.error('Error al cambiar estado:', error);
            this.mostrarNotificacion('Error', 'Error al cambiar el estado del dispositivo', 'error');
        }
    }

    async tomarMedicion() {
        if (!this.patientId) {
            this.mostrarNotificacion('Error', 'No se pudo identificar al paciente', 'error');
            return;
        }

        // Reiniciar el estado de la medición
        this.obteniendoMedicion = true;
        this.medicionError = '';
        this.medicionActual = null;
        this.medicionLogs = [];
        this.medicionCompletada = false;
        this.mostrarModalMedicion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();

        // Simular logs en tiempo real (para dar feedback al usuario)
        this.agregarLog('Iniciando escaneo de dispositivos Bluetooth...');
        this.agregarLog('Asegurate de que el tensiometro este ENCENDIDO');
        this.agregarLog('Presiona START en el tensiometro si es necesario');

        try {
            const response = await firstValueFrom(
                this.usersService.obtenerMedicionTensiometro(this.patientId)
            );

            // Agregar logs adicionales de la respuesta
            if (response && response.logs) {
                for (const log of response.logs) {
                    this.agregarLog(log);
                }
            }

            if (response && response.success && response.medicion) {
                // Procesar la medición recibida
                const medicion = response.medicion;

                // Asegurar que la fecha sea correcta
                let fechaFormateada = medicion.fechahoralectura || medicion.FechaHoraLectura;
                if (fechaFormateada) {
                    // Si la fecha viene en formato ISO, convertirla a formato legible
                    try {
                        const fecha = new Date(fechaFormateada);
                        if (!isNaN(fecha.getTime())) {
                            const dia = String(fecha.getDate()).padStart(2, '0');
                            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                            const anio = fecha.getFullYear();
                            const horas = String(fecha.getHours()).padStart(2, '0');
                            const minutos = String(fecha.getMinutes()).padStart(2, '0');
                            const segundos = String(fecha.getSeconds()).padStart(2, '0');
                            fechaFormateada = `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
                        }
                    } catch (e) {
                        // Si falla, mantener la fecha original
                    }
                }

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

                this.mostrarNotificacion('Exito', 'Medicion obtenida correctamente', 'success');
            } else {
                this.medicionError = response?.error || 'No se pudo obtener la medicion';
                this.agregarLog(`Error: ${this.medicionError}`);
                this.mostrarNotificacion('Error', this.medicionError, 'error');
            }

        } catch (error: any) {
            console.error('Error al tomar medicion:', error);
            this.medicionError = error.error?.error || error.message || 'Error al obtener la medicion';
            this.agregarLog(`Error: ${this.medicionError}`);
            this.mostrarNotificacion('Error', this.medicionError, 'error');
        } finally {
            this.obteniendoMedicion = false;
            this.cdr.markForCheck();
        }
    }

    private agregarLog(mensaje: string) {
        this.medicionLogs.push(mensaje);
        this.cdr.markForCheck();
    }

    private formatearFechaAhora(): string {
        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, '0');
        const mes = String(ahora.getMonth() + 1).padStart(2, '0');
        const anio = ahora.getFullYear();
        const horas = String(ahora.getHours()).padStart(2, '0');
        const minutos = String(ahora.getMinutes()).padStart(2, '0');
        const segundos = String(ahora.getSeconds()).padStart(2, '0');
        return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
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
        this.cdr.markForCheck();
    }

    // ==========================================
    // NOTIFICACIONES TOAST
    // ==========================================
    mostrarToast = false;
    mensajeToast = '';
    tipoToast: 'success' | 'error' | 'warning' = 'success';
    private toastTimeout: any = null;

    mostrarNotificacion(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
        this.mensajeToast = `${titulo}: ${mensaje}`;
        this.tipoToast = tipo;
        this.mostrarToast = true;
        this.cdr.markForCheck();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.mostrarToast = false;
            this.cdr.markForCheck();
        }, 4000);
    }

    // ==========================================
    // METODOS DE UTILIDAD
    // ==========================================

    formatearFecha(fecha: string): string {
        if (!fecha) return 'No sincronizado';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
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