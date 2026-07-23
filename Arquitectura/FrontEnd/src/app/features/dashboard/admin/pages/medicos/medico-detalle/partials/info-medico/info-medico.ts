import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
    selector: 'app-info-medico',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './info-medico.html',
    styleUrls: ['./info-medico.css']
})
export class InfoMedicoComponent implements OnInit, OnDestroy {
    @Input() usuarioSeleccionado: any = null;
    @Input() isSaving = false;
    @Input() estadisticas: any = null;
    @Output() volver = new EventEmitter<void>();
    @Output() guardarCambios = new EventEmitter<void>();
    @Output() cambioDatos = new EventEmitter<void>();

    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private fpNacimientoInstance: any = null;

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => this.inicializarCalendarioNacimiento(), 300);
        }
    }

    ngOnDestroy() {
        if (this.fpNacimientoInstance) {
            try { this.fpNacimientoInstance.destroy(); } catch (e) { }
            this.fpNacimientoInstance = null;
        }
    }

    inicializarCalendarioNacimiento() {
        if (!isPlatformBrowser(this.platformId) || !this.usuarioSeleccionado) return;

        if (this.fpNacimientoInstance) {
            try { this.fpNacimientoInstance.destroy(); } catch (e) { }
            this.fpNacimientoInstance = null;
        }

        const elemento = document.querySelector('#fechaNacimientoMedicoInput') as HTMLInputElement;
        if (!elemento) return;

        const config: any = {
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
                    this.cambioDatos.emit();
                    this.cdr.detectChanges();
                }
            }
        };

        try {
            this.fpNacimientoInstance = flatpickr('#fechaNacimientoMedicoInput', config);
        } catch (error) {
            console.error('Error al inicializar Flatpickr:', error);
        }
    }

    getEstadoMedico(): { texto: string; clase: string; icono: string } {
        if (!this.usuarioSeleccionado) {
            return { texto: 'Sin datos', clase: 'estado-sin-datos', icono: 'bi-question-circle' };
        }

        if (this.usuarioSeleccionado.activo === false) {
            return { texto: 'Inactivo', clase: 'estado-inactivo', icono: 'bi-x-circle-fill' };
        }

        if (this.estadisticas && this.estadisticas.citasPendientes > 0) {
            return { texto: 'Con citas pendientes', clase: 'estado-ocupado', icono: 'bi-clock-fill' };
        }

        return { texto: 'Activo disponible', clase: 'estado-activo', icono: 'bi-check-circle-fill' };
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

    tieneUbicacionCompleta(): boolean {
        const u = this.usuarioSeleccionado;
        if (!u) return false;
        return !!(u.domicilio && u.localidad && u.municipio && u.estado && u.codigoPostal);
    }

    onVolver() {
        this.volver.emit();
    }

    onGuardarCambios() {
        this.guardarCambios.emit();
    }
}