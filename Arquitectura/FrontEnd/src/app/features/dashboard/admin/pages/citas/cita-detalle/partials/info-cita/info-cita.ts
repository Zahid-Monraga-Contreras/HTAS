import { Component, Input, Output, EventEmitter, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
    selector: 'app-info-cita',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './info-cita.html',
    styleUrls: ['./info-cita.css']
})
export class InfoCita implements OnDestroy {
    @Input() citaSeleccionada: any = null;
    @Input() isSaving = false;
    @Output() guardarCambios = new EventEmitter<void>();
    @Output() volver = new EventEmitter<void>();
    @Output() marcarCompletada = new EventEmitter<void>();
    @Output() cancelarCita = new EventEmitter<void>();

    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    estadosCita = ['Programada', 'Confirmada', 'Completada', 'Cancelada', 'No Asistió'];
    modalidades = ['Presencial', 'Virtual'];

    estadosConColor = [
        { value: 'Programada', color: '#FFA726' },
        { value: 'Confirmada', color: '#66BB6A' },
        { value: 'Completada', color: '#42A5F5' },
        { value: 'Cancelada', color: '#EF5350' },
        { value: 'No Asistió', color: '#AB47BC' }
    ];

    private fpFechaInstance: any = null;
    private fpHoraInstance: any = null;

    ngOnDestroy() {
        this.destruirCalendarios();
    }

    ngAfterViewInit() {
        setTimeout(() => {
            if (this.citaSeleccionada) {
                this.inicializarCalendario();
            }
        }, 500);
    }

    getEstadoColor(estado: string): string {
        const found = this.estadosConColor.find(e => e.value === estado);
        return found ? found.color : '#78909C';
    }

    esCitaHoy(): boolean {
        if (!this.citaSeleccionada?.fechacita) return false;
        const hoy = new Date().toISOString().split('T')[0];
        return this.citaSeleccionada.fechacita === hoy;
    }

    esCitaFutura(): boolean {
        if (!this.citaSeleccionada?.fechacita) return false;
        const hoy = new Date().toISOString().split('T')[0];
        return this.citaSeleccionada.fechacita > hoy;
    }

    esCitaVencida(): boolean {
        if (!this.citaSeleccionada?.fechacita) return false;
        if (this.citaSeleccionada.estado === 'Cancelada' ||
            this.citaSeleccionada.estado === 'Completada' ||
            this.citaSeleccionada.estado === 'No Asistió') return false;
        const hoy = new Date().toISOString().split('T')[0];
        return this.citaSeleccionada.fechacita < hoy;
    }

    inicializarCalendario() {
        if (!isPlatformBrowser(this.platformId) || !this.citaSeleccionada) return;

        this.destruirCalendarios();

        setTimeout(() => {
            const configFecha: any = {
                locale: Spanish,
                dateFormat: "Y-m-d",
                defaultDate: this.citaSeleccionada?.fechacita || null,
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.citaSeleccionada) {
                        this.citaSeleccionada.fechacita = dateStr;
                        this.cdr.detectChanges();
                    }
                }
            };

            const fechaElement = document.querySelector('#fechaCitaInput') as HTMLInputElement;
            if (fechaElement) {
                this.fpFechaInstance = flatpickr('#fechaCitaInput', configFecha);
            }

            const configHora: any = {
                locale: Spanish,
                enableTime: true,
                noCalendar: true,
                dateFormat: "H:i",
                time_24hr: true,
                defaultDate: this.citaSeleccionada?.horacita || null,
                appendTo: document.body,
                static: false,
                disableMobile: true,
                onChange: (selectedDates: any, dateStr: string) => {
                    if (this.citaSeleccionada) {
                        this.citaSeleccionada.horacita = dateStr;
                        this.cdr.detectChanges();
                    }
                }
            };

            const horaElement = document.querySelector('#horaCitaInput') as HTMLInputElement;
            if (horaElement) {
                this.fpHoraInstance = flatpickr('#horaCitaInput', configHora);
            }

        }, 100);
    }

    destruirCalendarios() {
        if (this.fpFechaInstance) {
            try { this.fpFechaInstance.destroy(); } catch (e) { }
            this.fpFechaInstance = null;
        }
        if (this.fpHoraInstance) {
            try { this.fpHoraInstance.destroy(); } catch (e) { }
            this.fpHoraInstance = null;
        }
    }

    onGuardar() {
        this.guardarCambios.emit();
    }

    onVolver() {
        this.volver.emit();
    }

    onMarcarCompletada() {
        this.marcarCompletada.emit();
    }

    onCancelarCita() {
        this.cancelarCita.emit();
    }
}