import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
    selector: 'app-info-tratamiento',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './info-tratamiento.html',
    styleUrls: ['./info-tratamiento.css']
})
export class InfoTratamiento implements OnInit, OnDestroy {
    @Input() tratamientoSeleccionado: any = null;
    @Input() pacienteInfo: any = null;
    @Input() medicamentoInfo: any = null;
    @Input() isSaving = false;
    @Output() guardar = new EventEmitter<void>();
    @Output() volver = new EventEmitter<void>();
    @Output() tratamientoChange = new EventEmitter<any>();

    private usersService = inject(Users);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    private fpInicio: any = null;
    private fpFin: any = null;

    // Notificaciones Toast
    mostrarToast = false;
    mensajeToast = '';
    tipoToast: 'success' | 'error' | 'warning' = 'success';
    private toastTimeout: any = null;

    ngOnInit() {
        setTimeout(() => {
            this.inicializarCalendario();
        }, 100);
    }

    ngOnDestroy() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        if (this.fpInicio) {
            try { this.fpInicio.destroy(); } catch (e) { }
            this.fpInicio = null;
        }
        if (this.fpFin) {
            try { this.fpFin.destroy(); } catch (e) { }
            this.fpFin = null;
        }
    }

    inicializarCalendario() {
        if (!isPlatformBrowser(this.platformId)) return;

        const elementoInicio = document.querySelector('#fechaInicioInput');
        const elementoFin = document.querySelector('#fechaFinInput');

        if (!elementoInicio || !elementoFin) {
            setTimeout(() => this.inicializarCalendario(), 200);
            return;
        }

        try {
            const hoy = new Date();
            const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

            if (this.fpInicio) {
                try { this.fpInicio.destroy(); } catch (e) { }
                this.fpInicio = null;
            }
            if (this.fpFin) {
                try { this.fpFin.destroy(); } catch (e) { }
                this.fpFin = null;
            }

            this.fpInicio = flatpickr('#fechaInicioInput', {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: this.tratamientoSeleccionado?.fechainicio || undefined,
                minDate: "today",
                maxDate: fechaMaxima,
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.tratamientoSeleccionado) {
                        this.tratamientoSeleccionado.fechainicio = dateStr;
                        this.tratamientoChange.emit(this.tratamientoSeleccionado);
                        this.cdr.detectChanges();
                    }
                }
            });

            this.fpFin = flatpickr('#fechaFinInput', {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: this.tratamientoSeleccionado?.fechafin || undefined,
                minDate: "today",
                maxDate: fechaMaxima,
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.tratamientoSeleccionado) {
                        this.tratamientoSeleccionado.fechafin = dateStr;
                        this.tratamientoChange.emit(this.tratamientoSeleccionado);
                        this.cdr.detectChanges();
                    }
                }
            });
        } catch (error) {
            console.error('Error al inicializar calendarios:', error);
        }
    }

    getEstadoTratamiento(): { texto: string; clase: string; icono: string } {
        if (!this.tratamientoSeleccionado) {
            return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
        }

        if (this.tratamientoSeleccionado.activo === false) {
            return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
        }

        const hoy = new Date();
        const fechaFin = new Date(this.tratamientoSeleccionado.fechafin);

        if (fechaFin < hoy) {
            return { texto: 'Finalizado', clase: 'estado-finalizado', icono: 'bi-check-circle-fill' };
        }

        return { texto: 'Activo', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
    }

    getFrecuenciaTexto(): string {
        const horas = this.tratamientoSeleccionado?.frecuenciahoras;
        if (!horas) return 'Sin frecuencia';

        if (horas === 24) return 'Cada 24 horas (1 vez al día)';
        if (horas === 12) return 'Cada 12 horas (2 veces al día)';
        if (horas === 8) return 'Cada 8 horas (3 veces al día)';
        if (horas === 6) return 'Cada 6 horas (4 veces al día)';
        if (horas === 4) return 'Cada 4 horas (6 veces al día)';
        return `Cada ${horas} horas`;
    }

    getDuracionDias(): number | null {
        if (!this.tratamientoSeleccionado?.fechainicio || !this.tratamientoSeleccionado?.fechafin) return null;
        const inicio = new Date(this.tratamientoSeleccionado.fechainicio);
        const fin = new Date(this.tratamientoSeleccionado.fechafin);
        const diffTime = fin.getTime() - inicio.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getDiasRestantes(): number | null {
        if (!this.tratamientoSeleccionado?.fechafin) return null;
        const hoy = new Date();
        const fin = new Date(this.tratamientoSeleccionado.fechafin);
        const diffTime = fin.getTime() - hoy.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }

    getDiasRestantesTexto(): string {
        const dias = this.getDiasRestantes();
        if (dias === null) return 'Sin fecha de fin';
        if (dias > 0) return `${dias} días restantes`;
        if (dias === 0) return 'Finaliza hoy';
        return 'Finalizado';
    }

    validarFechas(): { valido: boolean; mensaje: string } {
        const inicio = this.tratamientoSeleccionado?.fechainicio;
        const fin = this.tratamientoSeleccionado?.fechafin;

        if (!inicio || !fin) {
            return { valido: false, mensaje: 'Las fechas de inicio y fin son obligatorias' };
        }

        const fechaInicio = new Date(inicio);
        const fechaFin = new Date(fin);

        if (fechaInicio > fechaFin) {
            return { valido: false, mensaje: 'La fecha de inicio no puede ser mayor a la fecha de fin' };
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fechaInicio < hoy) {
            return { valido: false, mensaje: 'La fecha de inicio no puede ser en el pasado' };
        }

        return { valido: true, mensaje: '' };
    }

    onGuardar() {
        const validacion = this.validarFechas();
        if (!validacion.valido) {
            this.lanzarNotificacion(validacion.mensaje, 'warning');
            return;
        }
        this.guardar.emit();
    }

    onVolver() {
        this.volver.emit();
    }

    lanzarNotificacion(mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
        this.mensajeToast = mensaje;
        this.tipoToast = tipo;
        this.mostrarToast = true;
        this.cdr.detectChanges();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.mostrarToast = false;
            this.cdr.detectChanges();
        }, 4000);
    }
}