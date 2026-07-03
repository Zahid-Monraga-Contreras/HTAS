import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment'; // Asegúrate de que la ruta a tu environment sea correcta

// 1. Definimos la estructura de los datos que enviaremos desde el formulario
export interface DatosPaciente {
  edad: number;
  sistolica: number;
  diastolica: number;
  tomaMedicamento: number; // 0 = No, 1 = Sí
}

// 2. Definimos la estructura de la respuesta que nos devolverá el backend
export interface RespuestaHTAS {
  success: boolean;
  mensaje: string;
  resultado: {
    crisis_detectada: number; // 0 o 1
    probabilidad_riesgo: string; // Ej: "85.50%"
    alerta_clinica: string; // Ej: "ALTA: Riesgo de crisis."
  };
}

@Injectable({
  providedIn: 'root'
})
export class Htas {

  // Usamos la URL que definimos en el environment apuntando a /evaluar
  private apiUrl = `${environment.htasApi}/evaluar`;

  constructor(private http: HttpClient) { }

  /**
   * Envía los datos del paciente a Node.js para evaluar riesgo de crisis hipertensiva
   * @param datos Objeto con edad, sistólica, diastólica y toma de medicamento
   */
  evaluarCrisis(datos: DatosPaciente): Observable<RespuestaHTAS> {
    return this.http.post<RespuestaHTAS>(this.apiUrl, datos);
  }
}