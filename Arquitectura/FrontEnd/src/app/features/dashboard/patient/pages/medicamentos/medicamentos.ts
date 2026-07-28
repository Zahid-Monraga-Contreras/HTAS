import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-patient-medicamentos',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './medicamentos.html',
    styleUrls: ['./medicamentos.css']
})
export class PatientMedicamentos {
    medicamentos = [
        { id: 1, nombre: 'Paracetamol', dosis: '500mg', frecuencia: 'Cada 8 horas', cantidad: 30 },
        { id: 2, nombre: 'Ibuprofeno', dosis: '400mg', frecuencia: 'Cada 12 horas', cantidad: 20 }
    ];

    constructor() { }
}