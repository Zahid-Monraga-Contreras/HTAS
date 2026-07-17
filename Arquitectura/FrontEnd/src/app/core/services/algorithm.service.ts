import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AnalisisRequest {
  edad: number;
  sistolica: number;
  diastolica: number;
  tomaMedicamento: number;
  cedulaMedico?: string;
  pdf: File;
}

export interface AnalisisCompletoRequest {
  edad: number;
  sistolica: number;
  diastolica: number;
  tomaMedicamento: number;
  cedulaMedico?: string;
  cedula: File;
  diagnostico: File;
}

export interface AnalisisResponse {
  success: boolean;
  data: {
    exitoso: boolean;
    folio_expediente_db: number;
    cedula_pdf_valida: boolean;
    diagnostico_pdf_valido: boolean;
    prediccion_crisis: number;
    probabilidad_porcentual: number;
    nivel_riesgo_clinico: string;
    protocolo_sugerido: string;
    motor_inferencia_usado: string;
    valores_pdf: any[];
    sistolica_usada: number;
    diastolica_usada: number;
    valores_usados: string;
    doctorId?: number;
    doctorNombre?: string;
  };
  mensaje: string;
}

export interface EstadoResponse {
  success: boolean;
  data: {
    scriptExist: boolean;
    scriptPath: string;
    pythonPath: string;
  };
  servidor: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlgorithmService {

  private baseUrl = environment.algorithmApi || 'http://localhost:3000/api/algorithm';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene el token de autenticación del localStorage
   */
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Crea los headers con el token de autenticación
   */
  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * Verifica el estado del sistema
   */
  verificarEstado(): Observable<EstadoResponse> {
    return this.http.get<EstadoResponse>(`${this.baseUrl}/estado`);
  }

  /**
   * Analiza un paciente con un solo PDF (diagnóstico)
   */
  analizarConPDF(request: AnalisisRequest): Observable<AnalisisResponse> {
    const formData = new FormData();

    formData.append('edad', request.edad.toString());
    formData.append('sistolica', request.sistolica.toString());
    formData.append('diastolica', request.diastolica.toString());
    formData.append('tomaMedicamento', request.tomaMedicamento.toString());

    if (request.cedulaMedico) {
      formData.append('cedulaMedico', request.cedulaMedico);
    }

    formData.append('pdf', request.pdf, request.pdf.name);

    const headers = this.getHeaders();

    return this.http.post<AnalisisResponse>(
      `${this.baseUrl}/analizar`,
      formData,
      { headers }
    );
  }

  /**
   * Analiza un paciente con dos PDFs (cédula + diagnóstico)
   */
  analizarConMultiplesPDFs(request: AnalisisCompletoRequest): Observable<AnalisisResponse> {
    const formData = new FormData();

    formData.append('edad', request.edad.toString());
    formData.append('sistolica', request.sistolica.toString());
    formData.append('diastolica', request.diastolica.toString());
    formData.append('tomaMedicamento', request.tomaMedicamento.toString());

    if (request.cedulaMedico) {
      formData.append('cedulaMedico', request.cedulaMedico);
    }

    formData.append('cedula', request.cedula, request.cedula.name);
    formData.append('diagnostico', request.diagnostico, request.diagnostico.name);

    const headers = this.getHeaders();

    return this.http.post<AnalisisResponse>(
      `${this.baseUrl}/analizar-completo`,
      formData,
      { headers }
    );
  }

  /**
   * Verifica si el token es válido
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}