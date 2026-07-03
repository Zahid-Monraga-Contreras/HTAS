import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Definimos la estructura extendida profesional de la IA
export interface AnalisisIA {
  estado: string;
  riesgo: string;
  alerta: string;
  seguimiento: string;
  recomendacion: string;
  accionMedica: string;
}

@Injectable({
  providedIn: 'root'
})
export class BloodPressure {
  private apiUrl = `${environment.iaApi}/analizar-presion`;

  constructor(private http: HttpClient) { }

  enviarLectura(sistolica: number, diastolica: number, pulso: number): Observable<AnalisisIA> {
    const body = {
      presionSistolica: sistolica,
      presionDiastolica: diastolica,
      pulso
    };
    return this.http.post<AnalisisIA>(this.apiUrl, body);
  }
}