// src/services/pythonService.js
//
// VERSION HTTP: llama al servicio Python (FastAPI) desplegado por separado
// (ej. Render), en vez de lanzar un subproceso local con spawn/child_process.
// Esto es OBLIGATORIO para producción en Vercel: Vercel no puede ejecutar
// "python script.py" como subproceso.
//
// Requiere la variable de entorno PYTHON_API_URL con la URL completa del
// servicio, ej: https://htas-python.onrender.com  (SIN slash final, y con
// https://, no una ruta relativa como "/python-api").

const axios = require('axios');

// Fallback a la URL real de Render por si PYTHON_API_URL no está
// configurada en el entorno (evita que el servicio quede sin URL).
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'https://htas-1wv5.onrender.com';

class PythonService {
    constructor() {
        if (!PYTHON_API_URL) {
            console.warn('[PythonService] ADVERTENCIA: PYTHON_API_URL no esta configurada.');
        }
        this.client = axios.create({
            baseURL: PYTHON_API_URL,
            timeout: 60000, // 60s, el analisis con PDFs puede tardar
            headers: { 'Content-Type': 'application/json' }
        });
    }

    /**
     * Traduce el envoltorio {exitoso, data, error} que devuelve el
     * servicio Python al valor que los controllers de Node esperan.
     * - exitoso === false  -> lanza Error(error)
     * - data !== undefined -> resuelve con ese valor (puede ser null)
     * - si no                -> resuelve el objeto completo
     */
    _unwrap(resultado) {
        if (!resultado) {
            throw new Error('Respuesta vacia del servicio Python');
        }
        if (resultado.exitoso === false) {
            throw new Error(resultado.error || 'Error en el servicio Python');
        }
        if (resultado.data !== undefined) {
            return resultado.data;
        }
        return resultado;
    }

    _manejarErrorHttp(error, contexto) {
        if (error.response) {
            // El servicio Python respondio con un error HTTP (4xx/5xx)
            const detalle = error.response.data?.error
                || error.response.data?.detail
                || JSON.stringify(error.response.data);
            console.error(`[PythonService] ${contexto} - Error HTTP ${error.response.status}: ${detalle}`);
            throw new Error(detalle);
        } else if (error.request) {
            // La peticion se hizo pero no hubo respuesta (servicio caido, timeout, DNS, etc.)
            console.error(`[PythonService] ${contexto} - Sin respuesta del servicio Python: ${error.message}`);
            throw new Error(`No se pudo contactar al servicio Python: ${error.message}`);
        } else {
            console.error(`[PythonService] ${contexto} - Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Analiza un paciente (con o sin PDFs) llamando al endpoint
     * POST /api/algorithm/analizar del servicio Python.
     */
    async analizarPaciente(datosPaciente) {
        const payload = {
            accion: 'analizar_paciente',
            id_paciente: datosPaciente.idPaciente || null,
            id_doctor: datosPaciente.idDoctor || null,
            edad: datosPaciente.edad,
            sistolica: datosPaciente.sistolica,
            diastolica: datosPaciente.diastolica,
            toma_medicamento: datosPaciente.tomaMedicamento || 0,
            cedula_medico: datosPaciente.cedulaMedico || '',
            cedula_pdf_base64: datosPaciente.cedulaPdfBase64 || '',
            diagnostico_pdf_base64: datosPaciente.diagnosticoPdfBase64 || ''
        };

        console.log(`[PythonService] POST /api/algorithm/analizar (paciente ${payload.id_paciente})`);

        try {
            const { data } = await this.client.post('/api/algorithm/analizar', payload);
            return this._unwrap(data);
        } catch (error) {
            this._manejarErrorHttp(error, 'analizarPaciente');
        }
    }

    /**
     * Obtiene el ultimo expediente de un paciente.
     */
    async obtenerUltimoExpedientePaciente(idPaciente) {
        console.log(`[PythonService] GET /api/algorithm/ultimo-expediente/${idPaciente}`);

        try {
            const { data } = await this.client.get(`/api/algorithm/ultimo-expediente/${idPaciente}`);
            return this._unwrap(data);
        } catch (error) {
            this._manejarErrorHttp(error, 'obtenerUltimoExpedientePaciente');
        }
    }

    /**
     * Obtiene los PDFs de un expediente por folio.
     */
    async obtenerPdfPorFolio(folio) {
        console.log(`[PythonService] Obteniendo PDF por folio: ${folio}`);

        try {
            const { data } = await this.client.post('/api/algorithm/analizar', {
                accion: 'obtener_pdf_por_folio',
                folio
            });
            return this._unwrap(data);
        } catch (error) {
            this._manejarErrorHttp(error, 'obtenerPdfPorFolio');
        }
    }

    /**
     * Obtiene el ultimo analisis de un medico por su cedula.
     */
    async obtenerUltimoAnalisis(cedulaMedico) {
        console.log(`[PythonService] Obteniendo ultimo analisis para cedula: ${cedulaMedico}`);

        try {
            const { data } = await this.client.post('/api/algorithm/analizar', {
                accion: 'obtener_ultimo_analisis',
                cedula_medico: cedulaMedico
            });
            return this._unwrap(data);
        } catch (error) {
            this._manejarErrorHttp(error, 'obtenerUltimoAnalisis');
        }
    }

    /**
     * Ejecuta una accion personalizada (utilidad de depuracion).
     */
    async ejecutarAccionPersonalizada(payload) {
        console.log(`[PythonService] Ejecutando accion personalizada: ${payload.accion}`);

        try {
            const { data } = await this.client.post('/api/algorithm/analizar', payload);
            return this._unwrap(data);
        } catch (error) {
            this._manejarErrorHttp(error, 'ejecutarAccionPersonalizada');
        }
    }

    /**
     * Verifica el estado del servicio Python.
     */
    async verificarEstado() {
        try {
            const { data } = await this.client.get('/api/algorithm/estado');
            return this._unwrap(data);
        } catch (error) {
            // Para /estado no queremos tumbar la peticion si el servicio esta
            // caido: mejor informar el estado real en vez de lanzar 500.
            console.error('[PythonService] Error verificando estado:', error.message);
            return {
                scriptExist: false,
                error: error.message,
                pythonApiUrl: PYTHON_API_URL || 'NO CONFIGURADA'
            };
        }
    }
}

module.exports = new PythonService();