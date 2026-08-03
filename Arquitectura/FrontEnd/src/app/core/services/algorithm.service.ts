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
  idPaciente: number;
  idDoctor?: number;
  pdf: File;
}

export interface AnalisisCompletoRequest {
  edad: number;
  sistolica: number;
  diastolica: number;
  tomaMedicamento: number;
  cedulaMedico?: string;
  idPaciente: number;
  idDoctor?: number;
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
    ruta_pdf_cedula?: string;
    ruta_pdf_diagnostico?: string;
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

export interface UltimoExpedienteResponse {
  success: boolean;
  data: {
    folio: number;
    fecha_consulta: string;
    id_paciente: number;
    nombre_paciente: string;
    ap_paterno_paciente: string;
    ap_materno_paciente: string;
    edad: number;
    sistolica: number;
    diastolica: number;
    presion_pdf_sistolica: number;
    presion_pdf_diastolica: number;
    prediccion_crisis: number;
    probabilidad_porcentual: number;
    nivel_riesgo: string;
    motor_utilizado: string;
    tiene_pdf_cedula: boolean;
    tiene_pdf_diagnostico: boolean;
    pdf_cedula_base64: string | null;
    pdf_diagnostico_base64: string | null;
  };
}

export interface PdfResponse {
  folio: number;
  fecha_consulta: string;
  cedula_medico: string;
  edad: number;
  sistolica: number;
  diastolica: number;
  nivel_riesgo: string;
  tiene_pdf_cedula: boolean;
  tiene_pdf_diagnostico: boolean;
  pdf_cedula_base64: string | null;
  pdf_diagnostico_base64: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AlgorithmService {

  private baseUrl = environment.algorithmApi || 'http://localhost:3000/api/algorithm';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene el token de autenticacion del localStorage
   */
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Crea los headers con el token de autenticacion
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
   * Analiza un paciente con un solo PDF (diagnostico)
   */
  analizarConPDF(request: AnalisisRequest): Observable<AnalisisResponse> {
    const formData = new FormData();

    formData.append('edad', request.edad.toString());
    formData.append('sistolica', request.sistolica.toString());
    formData.append('diastolica', request.diastolica.toString());
    formData.append('tomaMedicamento', request.tomaMedicamento.toString());
    formData.append('idPaciente', request.idPaciente.toString());

    if (request.idDoctor) {
      formData.append('idDoctor', request.idDoctor.toString());
    }

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
   * Analiza un paciente con dos PDFs (cedula + diagnostico)
   */
  analizarConMultiplesPDFs(request: AnalisisCompletoRequest): Observable<AnalisisResponse> {
    const formData = new FormData();

    formData.append('edad', request.edad.toString());
    formData.append('sistolica', request.sistolica.toString());
    formData.append('diastolica', request.diastolica.toString());
    formData.append('tomaMedicamento', request.tomaMedicamento.toString());
    formData.append('idPaciente', request.idPaciente.toString());

    if (request.idDoctor) {
      formData.append('idDoctor', request.idDoctor.toString());
    }

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
   * Obtiene el ultimo expediente de un paciente
   */
  obtenerUltimoExpediente(idPaciente: number): Observable<UltimoExpedienteResponse> {
    const headers = this.getHeaders();
    return this.http.get<UltimoExpedienteResponse>(
      `${this.baseUrl}/ultimo-expediente/${idPaciente}`,
      { headers }
    );
  }

  /**
   * Obtiene el PDF de un expediente por su folio
   */
  obtenerPDFExpediente(folio: number): Observable<Blob> {
    const headers = this.getHeaders();
    return this.http.get(
      `${this.baseUrl}/pdf/${folio}`,
      { headers, responseType: 'blob' }
    );
  }

  /**
   * Verifica si el token es valido
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}