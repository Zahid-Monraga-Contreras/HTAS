import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PatientMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface Tratamiento {
    idtratamiento: number;
    nombrepaciente: string;
    appaternopaciente: string;
    apmaternopaciente: string;
    nombredoctor: string;
    appaternodoctor: string;
    nombremedicamento: string;
    dosis: string;
    frecuenciahoras: number;
    fechainicio: string;
    fechafin: string;
    notasinstrucciones: string;
    activo: boolean;
    especialidaddoctor: string;
    diasrestantes: number;
}

interface RegistroToma {
    id: number;
    idTratamiento: number;
    fechaProgramada: string;
    fechaRealizada?: string;
    estado: 'Pendiente' | 'Tomada' | 'Omitida' | 'Retrasada' | 'Eliminada';
    notas?: string;
    idAcompanante?: number;
    nombreAcompanante?: string;
    fechaFormateada?: string;
    horaFormateada?: string;
}

@Component({
    selector: 'app-patient-tratamientos',
    standalone: true,
    imports: [CommonModule, FormsModule, PatientMenu],
    templateUrl: './tratamientos.html',
    styleUrls: ['./tratamientos.css']
})
export class PatientTratamientos implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    patientId: number | null = null;
    patientName: string = '';
    patientFullName: string = '';
    userEmail: string = '';

    tratamientos: Tratamiento[] = [];
    tratamientosFiltrados: Tratamiento[] = [];
    filterEstado: string = 'todos';

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0,
        vencidos: 0
    };

    mostrarModalDetalle = false;
    tratamientoSeleccionado: Tratamiento | null = null;

    mostrarModalConfirmacion = false;
    modalConfirmacion = {
        titulo: '',
        mensaje: '',
        icono: '',
        accion: ''
    };
    tratamientoParaAccion: Tratamiento | null = null;

    searchTerm: string = '';

    // Variables para el registro de tomas
    registrosTomas: RegistroToma[] = [];
    estadisticasTomas: any = null;
    cargandoTomas = false;
    generandoTomas = false;
    eliminandoTomas = false;
    mostrarModalTomas = false;

    // Notificaciones Toast
    mostrarToast = false;
    mensajeToast = '';
    tipoToast: 'success' | 'error' | 'warning' = 'success';
    private toastTimeout: any = null;

    // Modal de confirmación para tomas
    mostrarModalConfirmacionTomas = false;
    modalConfirmacionMensaje = '';
    modalConfirmacionAccion: (() => void) | null = null;

    // Modal para eliminar toma individual - SOLO PARA ADMIN
    mostrarModalEliminarToma = false;
    tomaAEliminar: number | null = null;

    // Modal para eliminar todas las tomas - SOLO PARA ADMIN
    mostrarModalEliminarTodas = false;

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
                await this.cargarTratamientos();
            } else if (this.userEmail) {
                await this.cargarTratamientosPorEmail();
            }

        } catch (error) {
            console.error('Error al cargar tratamientos:', error);
        } finally {
            this.isLoading = false;
            this.cdr.markForCheck();
        }
    }

    ngOnDestroy() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
    }

    private async cargarTratamientos() {
        try {
            if (!this.patientId) return;

            const response = await firstValueFrom(
                this.usersService.getTratamientosByPaciente(this.patientId)
            );

            if (response && Array.isArray(response)) {
                this.tratamientos = response.map((t: any) => ({
                    idtratamiento: t.idtratamiento,
                    nombrepaciente: t.nombrepaciente || this.patientName,
                    appaternopaciente: t.appaternopaciente || '',
                    apmaternopaciente: t.apmaternopaciente || '',
                    nombredoctor: t.nombredoctor || 'No asignado',
                    appaternodoctor: t.appaternodoctor || '',
                    nombremedicamento: t.nombremedicamento || 'Sin medicamento',
                    dosis: t.dosis || '',
                    frecuenciahoras: t.frecuenciahoras || 0,
                    fechainicio: t.fechainicio,
                    fechafin: t.fechafin,
                    notasinstrucciones: t.notasinstrucciones || '',
                    activo: t.activo !== false,
                    especialidaddoctor: t.especialidaddoctor || '',
                    diasrestantes: t.diasrestantes || 0
                }));

                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
            }
        } catch (error) {
            console.error('Error al cargar tratamientos:', error);
            this.tratamientos = [];
        }
    }

    private async cargarTratamientosPorEmail() {
        try {
            const allUsers = await firstValueFrom(
                this.usersService.getUsuariosBackend()
            );

            if (Array.isArray(allUsers) && allUsers.length > 0) {
                const foundUser = allUsers.find((u: any) =>
                    u.correo?.toLowerCase() === this.userEmail.toLowerCase()
                );

                if (foundUser) {
                    this.patientId = foundUser.idusuario || foundUser.id || null;
                    this.patientName = foundUser.nombre || this.patientName;
                    this.patientFullName = `${foundUser.nombre || ''} ${foundUser.apPaterno || ''} ${foundUser.apMaterno || ''}`.trim() || this.patientName;
                    await this.cargarTratamientos();
                }
            }
        } catch (error) {
            console.error('Error al cargar tratamientos por email:', error);
        }
    }

    private calcularEstadisticas() {
        const ahora = new Date();
        this.estadisticas.total = this.tratamientos.length;
        this.estadisticas.activos = this.tratamientos.filter(t =>
            t.activo === true
        ).length;
        this.estadisticas.inactivos = this.tratamientos.filter(t =>
            t.activo === false
        ).length;
        this.estadisticas.vencidos = this.tratamientos.filter(t => {
            if (!t.activo) return false;
            const fechaFin = new Date(t.fechafin);
            return fechaFin < ahora;
        }).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todos') {
            this.tratamientosFiltrados = [...this.tratamientos];
        } else if (estado === 'activos') {
            this.tratamientosFiltrados = this.tratamientos.filter(t => t.activo === true);
        } else if (estado === 'inactivos') {
            this.tratamientosFiltrados = this.tratamientos.filter(t => t.activo === false);
        } else if (estado === 'vencidos') {
            const ahora = new Date();
            this.tratamientosFiltrados = this.tratamientos.filter(t => {
                if (!t.activo) return false;
                const fechaFin = new Date(t.fechafin);
                return fechaFin < ahora;
            });
        }
        this.cdr.markForCheck();
    }

    get tratamientosPaginados() {
        const busqueda = this.searchTerm.toLowerCase().trim();
        if (!busqueda) return this.tratamientosFiltrados;

        return this.tratamientosFiltrados.filter(t =>
            t.nombrepaciente.toLowerCase().includes(busqueda) ||
            t.nombremedicamento.toLowerCase().includes(busqueda) ||
            t.nombredoctor.toLowerCase().includes(busqueda) ||
            t.appaternodoctor.toLowerCase().includes(busqueda) ||
            t.dosis.toLowerCase().includes(busqueda)
        );
    }

    verDetalle(tratamiento: Tratamiento) {
        this.tratamientoSeleccionado = tratamiento;
        this.mostrarModalDetalle = true;
        document.body.style.overflow = 'hidden';
        this.cargarTomas(tratamiento.idtratamiento);
    }

    cerrarModalDetalle() {
        this.mostrarModalDetalle = false;
        this.tratamientoSeleccionado = null;
        this.registrosTomas = [];
        this.estadisticasTomas = null;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    // ==========================================
    // METODOS PARA EL REGISTRO DE TOMAS
    // ==========================================

    async cargarTomas(idTratamiento: number) {
        try {
            this.cargandoTomas = true;
            this.cdr.markForCheck();

            const [tomas, estadisticas] = await Promise.all([
                firstValueFrom(this.usersService.getTomasByTratamiento(idTratamiento)),
                firstValueFrom(this.usersService.getEstadisticasTomas(idTratamiento))
            ]);

            if (tomas && Array.isArray(tomas)) {
                this.registrosTomas = tomas.map((t: any) => ({
                    ...t,
                    fechaFormateada: this.formatearFecha(t.fechaProgramada),
                    horaFormateada: this.formatearHora(t.fechaProgramada)
                }));
            }

            if (estadisticas) {
                this.estadisticasTomas = estadisticas;
            }

            this.cdr.markForCheck();
        } catch (error) {
            console.error('Error al cargar tomas:', error);
            this.lanzarNotificacion('Error al cargar las tomas', 'error');
        } finally {
            this.cargandoTomas = false;
            this.cdr.markForCheck();
        }
    }

    formatearHora(fecha: string): string {
        if (!fecha) return 'S/H';
        try {
            const d = new Date(fecha);
            const horas = d.getHours().toString().padStart(2, '0');
            const minutos = d.getMinutes().toString().padStart(2, '0');
            return `${horas}:${minutos}`;
        } catch {
            return 'S/H';
        }
    }

    // Verifica si el tratamiento ya tiene tomas generadas
    tieneTomasGeneradas(): boolean {
        return this.registrosTomas && this.registrosTomas.length > 0;
    }

    // Verifica si el boton de generar tomas debe estar deshabilitado
    isBotonGenerarDisabled(): boolean {
        if (this.generandoTomas) return true;
        if (this.tieneTomasGeneradas()) return true;
        if (!this.tratamientoSeleccionado) return true;
        if (!this.tratamientoSeleccionado.activo) return true;
        return false;
    }

    // Obtiene el mensaje del boton de generar tomas
    getMensajeBotonGenerar(): string {
        if (this.generandoTomas) {
            return 'Generando...';
        }
        if (this.tieneTomasGeneradas()) {
            return 'Tomas ya generadas';
        }
        return 'Generar Tomas';
    }

    async generarTomas() {
        if (!this.tratamientoSeleccionado) return;

        if (this.tieneTomasGeneradas()) {
            this.lanzarNotificacion('Este tratamiento ya tiene tomas generadas.', 'warning');
            return;
        }

        this.generandoTomas = true;
        this.cdr.markForCheck();

        try {
            const data = {
                idTratamiento: this.tratamientoSeleccionado.idtratamiento,
                fechaInicio: this.tratamientoSeleccionado.fechainicio,
                fechaFin: this.tratamientoSeleccionado.fechafin,
                frecuenciaHoras: this.tratamientoSeleccionado.frecuenciahoras
            };

            const response = await firstValueFrom(
                this.usersService.generarTomasProgramadas(data)
            );

            this.lanzarNotificacion(
                `${response.totalGeneradas} tomas generadas exitosamente`,
                'success'
            );

            await this.cargarTomas(this.tratamientoSeleccionado.idtratamiento);

        } catch (error) {
            console.error('Error al generar tomas:', error);
            this.lanzarNotificacion('Error al generar las tomas', 'error');
        } finally {
            this.generandoTomas = false;
            this.cdr.markForCheck();
        }
    }

    async actualizarEstadoToma(event: { id: number; estado: string }) {
        try {
            await firstValueFrom(
                this.usersService.actualizarEstadoToma(event.id, event.estado)
            );

            this.lanzarNotificacion(
                `Toma actualizada a ${event.estado}`,
                'success'
            );

            await this.cargarTomas(this.tratamientoSeleccionado!.idtratamiento);

        } catch (error) {
            console.error('Error al actualizar toma:', error);
            this.lanzarNotificacion('Error al actualizar la toma', 'error');
        }
    }

    // ==========================================
    // METODOS DE UTILIDAD PARA TOMAS
    // ==========================================

    getEstadoColor(estado: string): string {
        const colores: { [key: string]: string } = {
            'Tomada': '#10b981',
            'Pendiente': '#f59e0b',
            'Omitida': '#ef4444',
            'Retrasada': '#f97316',
            'Eliminada': '#6c757d'
        };
        return colores[estado] || '#6c757d';
    }

    getEstadoIcono(estado: string): string {
        const iconos: { [key: string]: string } = {
            'Tomada': 'bi-check-circle-fill',
            'Pendiente': 'bi-clock-fill',
            'Omitida': 'bi-x-circle-fill',
            'Retrasada': 'bi-exclamation-triangle-fill',
            'Eliminada': 'bi-trash-fill'
        };
        return iconos[estado] || 'bi-question-circle';
    }

    getCantidadTomasActivas(): number {
        if (!this.registrosTomas) return 0;
        return this.registrosTomas.filter(t => t.estado !== 'Eliminada').length;
    }

    tieneTomasActivas(): boolean {
        if (!this.registrosTomas || this.registrosTomas.length === 0) {
            return false;
        }
        return this.registrosTomas.some(t => t.estado !== 'Eliminada');
    }

    // ==========================================
    // METODOS DE UTILIDAD GENERALES
    // ==========================================

    getEstadoClass(activo: boolean): string {
        return activo ? 'estado-activo' : 'estado-inactivo';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    getEstadoIcon(activo: boolean): string {
        return activo ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    formatearFechaCompleta(fecha: string): string {
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

    getDiasRestantes(fechaFin: string): string {
        if (!fechaFin) return 'Sin fecha';
        try {
            const fin = new Date(fechaFin);
            const ahora = new Date();
            const diff = fin.getTime() - ahora.getTime();
            const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (dias < 0) return 'Vencido';
            if (dias === 0) return 'Hoy finaliza';
            return `${dias} dias restantes`;
        } catch {
            return '';
        }
    }

    getDiasClass(fechaFin: string): string {
        if (!fechaFin) return '';
        try {
            const fin = new Date(fechaFin);
            const ahora = new Date();
            const diff = fin.getTime() - ahora.getTime();
            const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (dias < 0) return 'dias-vencido';
            if (dias <= 3) return 'dias-urgente';
            return 'dias-normal';
        } catch {
            return '';
        }
    }

    // ==========================================
    // METODOS DE CONFIRMACION GENERAL
    // ==========================================

    mostrarConfirmacion(titulo: string, mensaje: string, icono: string, tratamiento: Tratamiento) {
        this.tratamientoParaAccion = tratamiento;
        this.modalConfirmacion = {
            titulo: titulo,
            mensaje: mensaje,
            icono: icono,
            accion: ''
        };
        this.mostrarModalConfirmacion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    cerrarModalConfirmacion() {
        this.mostrarModalConfirmacion = false;
        this.tratamientoParaAccion = null;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    async toggleEstado() {
        if (!this.tratamientoParaAccion) return;

        try {
            const id = this.tratamientoParaAccion.idtratamiento;
            const nuevoEstado = !this.tratamientoParaAccion.activo;

            await firstValueFrom(
                this.usersService.toggleEstadoTratamiento(id, nuevoEstado)
            );

            this.tratamientoParaAccion.activo = nuevoEstado;
            this.calcularEstadisticas();
            this.aplicarFiltro(this.filterEstado);

            this.cerrarModalConfirmacion();

        } catch (error) {
            console.error('Error al cambiar estado:', error);
        }
    }

    // ==========================================
    // METODOS PARA NOTIFICACIONES TOAST
    // ==========================================

    lanzarNotificacion(mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
        this.mensajeToast = mensaje;
        this.tipoToast = tipo;
        this.mostrarToast = true;
        this.cdr.markForCheck();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.mostrarToast = false;
            this.cdr.markForCheck();
        }, 4000);
    }
}