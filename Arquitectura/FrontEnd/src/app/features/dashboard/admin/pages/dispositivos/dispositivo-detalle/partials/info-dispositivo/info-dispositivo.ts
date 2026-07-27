import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DispositivoInfo {
    iddispositivo?: number;
    nombre?: string;
    direccionmac?: string;
    activo?: boolean;
    idpaciente?: number | null;
    idPacienteAsociado?: number | null;
    nombrepaciente?: string;
    appaternopaciente?: string;
    apmaternopaciente?: string;
    paciente?: any;
}

@Component({
    selector: 'app-info-dispositivo',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './info-dispositivo.html',
    styleUrls: ['./info-dispositivo.css']
})
export class InfoDispositivo implements OnChanges {
    @Input() dispositivo: DispositivoInfo | null = null;
    @Input() pacientesLista: any[] = [];
    @Input() esPacienteOAcompanante: boolean = false;
    @Input() isSaving: boolean = false;

    @Output() guardar = new EventEmitter<void>();
    @Output() volver = new EventEmitter<void>();
    @Output() asignarPaciente = new EventEmitter<any>();
    @Output() desasignarPaciente = new EventEmitter<void>();
    @Output() toggleActivo = new EventEmitter<void>();

    filtroPaciente: string = '';
    mostrarDropdown: boolean = false;

    get pacientesFiltrados() {
        if (!this.filtroPaciente) return this.pacientesLista;
        const term = this.filtroPaciente.toLowerCase();
        return this.pacientesLista.filter(p => {
            const nombreCompleto = this.obtenerNombreCompleto(p).toLowerCase();
            return nombreCompleto.includes(term);
        });
    }

    obtenerNombreCompleto(paciente: any): string {
        if (!paciente) return '';
        const nombre = paciente.nombre || '';
        const apPaterno = paciente.appaterno || paciente.apPaterno || '';
        const apMaterno = paciente.apmaterno || paciente.apMaterno || '';
        return `${nombre} ${apPaterno} ${apMaterno}`.trim();
    }

    obtenerIdPaciente(): number | null {
        return this.dispositivo?.idpaciente ||
            this.dispositivo?.idPacienteAsociado ||
            null;
    }

    getUbicacionPaciente(): string {
        const p = this.dispositivo?.paciente;
        if (!p) return 'Sin ubicación registrada';
        const partes = [p.domicilio, p.localidad, p.municipio, p.estado].filter(Boolean);
        return partes.length ? partes.join(', ') : 'Sin ubicación completa';
    }

    pacienteTieneUbicacion(): boolean {
        const p = this.dispositivo?.paciente;
        if (!p) return false;
        return !!(p.domicilio && p.localidad && p.municipio && p.estado);
    }

    onFiltroPacienteChange() {
        if (this.filtroPaciente.length > 0) {
            this.mostrarDropdown = true;
        }
    }

    ocultarDropdown() {
        setTimeout(() => {
            this.mostrarDropdown = false;
        }, 200);
    }

    onAsignarPaciente(p: any) {
        this.asignarPaciente.emit(p);
        this.filtroPaciente = this.obtenerNombreCompleto(p);
        this.mostrarDropdown = false;
    }

    onDesasignarPaciente() {
        this.desasignarPaciente.emit();
        this.filtroPaciente = '';
    }

    onToggleActivo() {
        this.toggleActivo.emit();
    }

    onGuardar() {
        this.guardar.emit();
    }

    onVolver() {
        this.volver.emit();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['dispositivo'] && this.dispositivo) {
            if (this.dispositivo.nombrepaciente) {
                this.filtroPaciente = this.obtenerNombreCompleto({
                    nombre: this.dispositivo.nombrepaciente,
                    appaterno: this.dispositivo.appaternopaciente,
                    apmaterno: this.dispositivo.apmaternopaciente
                });
            }
        }
    }
}