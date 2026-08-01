import { Component, Input, Output, EventEmitter, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
    selector: 'app-info-acompanante',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './info-acompanante.html',
    styleUrls: ['./info-acompanante.css']
})
export class InfoAcompanante implements OnDestroy {
    @Input() usuarioSeleccionado: any = null;
    @Input() isSaving = false;
    @Output() guardarCambios = new EventEmitter<void>();
    @Output() volver = new EventEmitter<void>();

    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private usersService = inject(Users);

    private fpNacimientoInstance: any = null;
    private fpAsignacionInstance: any = null;

    estadisticas: {
        totalVisitas: number;
        visitasCompletadas: number;
        visitasPendientes: number;
        visitasCanceladas: number;
        ultimaVisita: string | null;
        proximaVisita: string | null;
    } | null = null;

    visitasAcompanante: any[] = [];

    // Variables para almacenar las fechas formateadas
    fechaNacimientoDisplay: string = '';
    fechaAsignacionDisplay: string = '';

    ngOnDestroy() {
        if (this.fpNacimientoInstance) {
            try { this.fpNacimientoInstance.destroy(); } catch (e) { }
            this.fpNacimientoInstance = null;
        }
        if (this.fpAsignacionInstance) {
            try { this.fpAsignacionInstance.destroy(); } catch (e) { }
            this.fpAsignacionInstance = null;
        }
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.actualizarFechasDisplay();
            this.inicializarCalendarios();
        }, 500);
    }

    actualizarFechasDisplay() {
        if (this.usuarioSeleccionado) {
            this.fechaNacimientoDisplay = this.formatearFechaParaMostrar(this.usuarioSeleccionado.fechaNacimiento);
            this.fechaAsignacionDisplay = this.formatearFechaParaMostrar(this.usuarioSeleccionado.fechaAsignacion);
            this.cdr.detectChanges();
        }
    }

    formatearFechaParaInput(fecha: string): string {
        if (!fecha) return '';
        if (fecha === 'null' || fecha === 'undefined') return '';

        try {
            if (fecha.includes('T')) {
                const d = new Date(fecha);
                if (!isNaN(d.getTime())) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }

            if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                return fecha;
            }

            if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
                const partes = fecha.split('/');
                return `${partes[2]}-${partes[1]}-${partes[0]}`;
            }

            const d = new Date(fecha);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            return fecha;
        } catch (error) {
            console.warn('Error al formatear fecha:', fecha, error);
            return fecha;
        }
    }

    formatearFechaParaMostrar(fecha: string): string {
        if (!fecha) return 'No registrada';

        try {
            const d = new Date(fecha);
            if (!isNaN(d.getTime())) {
                const dia = String(d.getDate()).padStart(2, '0');
                const mes = String(d.getMonth() + 1).padStart(2, '0');
                const anio = d.getFullYear();
                return `${dia}/${mes}/${anio}`;
            }
            return fecha;
        } catch (error) {
            return fecha;
        }
    }

    get fechaAsignacionFormateada(): string {
        if (!this.usuarioSeleccionado?.fechaAsignacion) return 'No registrada';
        return this.formatearFechaParaMostrar(this.usuarioSeleccionado.fechaAsignacion);
    }

    get fechaNacimientoFormateada(): string {
        if (!this.usuarioSeleccionado?.fechaNacimiento) return 'No registrada';
        return this.formatearFechaParaMostrar(this.usuarioSeleccionado.fechaNacimiento);
    }

    onFechaNacimientoChange(event: any) {
        const value = event.target.value;
        if (this.usuarioSeleccionado) {
            const fechaFormateada = this.formatearFechaParaInput(value);
            if (fechaFormateada) {
                this.usuarioSeleccionado.fechaNacimiento = fechaFormateada;
                this.fechaNacimientoDisplay = this.formatearFechaParaMostrar(fechaFormateada);
                this.cdr.detectChanges();
            }
        }
    }

    onFechaAsignacionChange(event: any) {
        const value = event.target.value;
        if (this.usuarioSeleccionado) {
            const fechaFormateada = this.formatearFechaParaInput(value);
            if (fechaFormateada) {
                this.usuarioSeleccionado.fechaAsignacion = fechaFormateada;
                this.fechaAsignacionDisplay = this.formatearFechaParaMostrar(fechaFormateada);
                this.cdr.detectChanges();
            }
        }
    }

    inicializarCalendarios() {
        if (!isPlatformBrowser(this.platformId)) return;

        if (this.fpNacimientoInstance) {
            try { this.fpNacimientoInstance.destroy(); } catch (e) { }
            this.fpNacimientoInstance = null;
        }
        if (this.fpAsignacionInstance) {
            try { this.fpAsignacionInstance.destroy(); } catch (e) { }
            this.fpAsignacionInstance = null;
        }

        const nacimientoEl = document.querySelector('#fechaNacimientoInput') as HTMLInputElement;
        if (nacimientoEl) {
            const fechaNacimiento = this.usuarioSeleccionado?.fechaNacimiento
                ? this.formatearFechaParaInput(this.usuarioSeleccionado.fechaNacimiento)
                : null;

            const configNacimiento: any = {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: fechaNacimiento,
                maxDate: "today",
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.usuarioSeleccionado) {
                        this.usuarioSeleccionado.fechaNacimiento = dateStr;
                        this.fechaNacimientoDisplay = this.formatearFechaParaMostrar(dateStr);
                        this.cdr.detectChanges();
                    }
                }
            };
            this.fpNacimientoInstance = flatpickr('#fechaNacimientoInput', configNacimiento);
        }

        const asignacionEl = document.querySelector('#fechaInput') as HTMLInputElement;
        if (asignacionEl) {
            let fechaAsignacion = 'today';
            if (this.usuarioSeleccionado?.fechaAsignacion) {
                const fechaFormateada = this.formatearFechaParaInput(this.usuarioSeleccionado.fechaAsignacion);
                if (fechaFormateada) {
                    fechaAsignacion = fechaFormateada;
                }
            }

            const hoy = new Date();
            const fechaMaximaAsignacion = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

            const configAsignacion: any = {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: fechaAsignacion,
                minDate: "today",
                maxDate: fechaMaximaAsignacion,
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.usuarioSeleccionado) {
                        this.usuarioSeleccionado.fechaAsignacion = dateStr;
                        this.fechaAsignacionDisplay = this.formatearFechaParaMostrar(dateStr);
                        this.cdr.detectChanges();
                    }
                }
            };
            this.fpAsignacionInstance = flatpickr('#fechaInput', configAsignacion);
        }
    }

    getEstadoAcompanante(): { texto: string; clase: string; icono: string } {
        if (!this.usuarioSeleccionado) {
            return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
        }

        if (this.usuarioSeleccionado.activo === false) {
            return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
        }

        if (this.estadisticas && this.estadisticas.visitasPendientes > 0) {
            return { texto: `${this.estadisticas.visitasPendientes} visitas pendientes`, clase: 'estado-pendiente', icono: 'bi-clock-fill' };
        }

        if (this.estadisticas && this.estadisticas.totalVisitas > 0) {
            return { texto: 'Activo con historial', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
        }

        return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
    }

    tieneUbicacionCompleta(): boolean {
        const u = this.usuarioSeleccionado;
        if (!u) return false;
        return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
    }

    getUbicacionFormateada(): string {
        const u = this.usuarioSeleccionado;
        if (!u) return '';
        const partes = [
            u.domicilio,
            u.localidad,
            u.municipio,
            u.estado,
            u.codigoPostal ? `CP ${u.codigoPostal}` : ''
        ].filter(Boolean);
        return partes.length ? partes.join(', ') : 'Sin ubicacion registrada';
    }

    formatearCURP() {
        if (this.usuarioSeleccionado && this.usuarioSeleccionado.curp) {
            this.usuarioSeleccionado.curp = this.usuarioSeleccionado.curp.toUpperCase().trim();
            this.cdr.detectChanges();
        }
    }

    formatearCodigoPostal() {
        if (this.usuarioSeleccionado && this.usuarioSeleccionado.codigoPostal) {
            const cp = this.usuarioSeleccionado.codigoPostal.replace(/\D/g, '').slice(0, 5);
            this.usuarioSeleccionado.codigoPostal = cp;
            this.cdr.detectChanges();
        }
    }

    capitalizarTexto(texto: string): string {
        if (!texto) return '';
        return texto.split(' ').map(palabra =>
            palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
        ).join(' ');
    }

    formatearCampoTexto(campo: string) {
        if (this.usuarioSeleccionado && this.usuarioSeleccionado[campo]) {
            this.usuarioSeleccionado[campo] = this.capitalizarTexto(this.usuarioSeleccionado[campo]);
            this.cdr.detectChanges();
        }
    }

    onGuardar() {
        this.guardarCambios.emit();
    }

    onVolver() {
        this.volver.emit();
    }
}