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

export interface Expediente {
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
}