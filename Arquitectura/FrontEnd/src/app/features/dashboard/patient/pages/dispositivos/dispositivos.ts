import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-patient-dispositivos',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dispositivos.html',
    styleUrls: ['./dispositivos.css']
})
export class PatientDispositivos {
    dispositivos = [
        { id: 1, nombre: 'Monitor de Presión', modelo: 'BP-2000', estado: 'Activo', ultimaLectura: '120/80' },
        { id: 2, nombre: 'Glucómetro', modelo: 'G-100', estado: 'En mantenimiento', ultimaLectura: '95 mg/dL' }
    ];

    constructor() { }
}