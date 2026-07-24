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
            this.inicializarCalendarios();
        }, 500);
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
            const configNacimiento: any = {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: this.usuarioSeleccionado?.fechaNacimiento || null,
                maxDate: "today",
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.usuarioSeleccionado) {
                        this.usuarioSeleccionado.fechaNacimiento = dateStr;
                        this.cdr.detectChanges();
                    }
                }
            };
            this.fpNacimientoInstance = flatpickr('#fechaNacimientoInput', configNacimiento);
        }

        const asignacionEl = document.querySelector('#fechaInput') as HTMLInputElement;
        if (asignacionEl) {
            const hoy = new Date();
            const fechaMaximaAsignacion = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

            const configAsignacion: any = {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: this.usuarioSeleccionado?.fechaAsignacion || "today",
                minDate: "today",
                maxDate: fechaMaximaAsignacion,
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.usuarioSeleccionado) {
                        this.usuarioSeleccionado.fechaAsignacion = dateStr;
                        this.cdr.detectChanges();
                    }
                }
            };
            this.fpAsignacionInstance = flatpickr('#fechaInput', configAsignacion);
        }
    }

    // --- ESTADO DEL ACOMPAÑANTE ---
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

    // --- UBICACIÓN ---
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
        return partes.length ? partes.join(', ') : 'Sin ubicación registrada';
    }

    // --- FORMATEO DE CAMPOS ---
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