/**
 * Interfaces relacionadas con el algoritmo de predicción de crisis hipertensiva.
 * Consolidado a partir de AlgorithmService y Users (métodos de algoritmo).
 */

/** Petición de análisis con un solo PDF (diagnóstico) */
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

/** Petición de análisis con dos PDFs (cédula profesional + diagnóstico) */
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

/** Contenido de `data` dentro de una respuesta de análisis */
export interface AnalisisData {
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
}

/** Respuesta al analizar (con uno o varios PDFs) */
export interface AnalisisResponse {
    success: boolean;
    data: AnalisisData;
    mensaje: string;
}

/** Estado del microservicio/script de análisis (Python) */
export interface EstadoResponse {
    success: boolean;
    data: {
        scriptExist: boolean;
        scriptPath: string;
        pythonPath: string;
    };
    servidor: string;
    timestamp?: string;
}

/** Datos del último expediente clínico generado para un paciente */
export interface UltimoExpedienteData {
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
}

export interface UltimoExpedienteResponse {
    success: boolean;
    data: UltimoExpedienteData | null;
}

/** Datos de PDF asociados a un expediente por folio */
export interface PdfData {
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

export interface PdfResponse {
    success: boolean;
    data: PdfData;
}

/** Último análisis registrado para un médico (por cédula profesional) */
export interface UltimoAnalisisData {
    folio: number;
    fecha_consulta: string;
    cedula_medico: string;
    edad: number;
    sistolica: number;
    diastolica: number;
    presion_pdf_sistolica: number;
    presion_pdf_diastolica: number;
    prediccion_crisis: number;
    probabilidad_porcentual: number;
    nivel_riesgo: string;
    motor_utilizado: string;
    pdf_cedula_valido: boolean;
    pdf_diagnostico_valido: boolean;
    tiene_pdf_cedula: boolean;
    tiene_pdf_diagnostico: boolean;
    pdf_cedula_base64: string | null;
    pdf_diagnostico_base64: string | null;
}

export interface UltimoAnalisisResponse {
    success: boolean;
    data: UltimoAnalisisData | null;
    mensaje?: string;
}