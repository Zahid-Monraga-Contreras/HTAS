const axios = require('axios');

// Endpoint para analizar los datos de presión arterial con LLM
const analizarPresion = async (req, res) => {
    // Recibimos los datos del paciente desde Angular
    const { presionSistolica, presionDiastolica, pulso } = req.body;

    // Creamos un prompt estructurado y profesional para la IA médica
    const prompt = `
    Actúa como un asistente médico automatizado experto en cardiología y riesgo cardiovascular. 
    Analiza con extremo rigor los siguientes signos vitales del paciente de manera aislada:
    - Presión Sistólica: ${presionSistolica} mmHg
    - Presión Diastólica: ${presionDiastolica} mmHg
    - Pulso / Frecuencia Cardíaca: ${pulso} lpm

    Basándote en las directrices internacionales (AHA/ACC), clasifica las métricas y genera un informe estructurado estrictamente en formato JSON.
    El texto debe ser profesional, empático y directo.

    Estructura requerida del JSON:
    {
      "estado": "Normal, Elevada, Hipertensión Estadio 1, Hipertensión Estadio 2 o Crisis de Hipertensión",
      "riesgo": "Bajo, Moderado o Alto",
      "alerta": "Un mensaje claro sobre qué valores específicos (${presionSistolica}/${presionDiastolica} o pulso de ${pulso}) requieren atención inmediata o cuidado especial.",
      "seguimiento": "Indicaciones precisas de monitoreo (ej. medir 2 veces al día, bitácora semanal o acudir a urgencias).",
      "recomendacion": "Pautas de estilo de vida, reducción de sodio o técnicas de relajación inmediatas según el estado.",
      "accionMedica": "Instrucción de consulta médica (ej. 'Consulte a su médico de cabecera en las próximas semanas' o 'Busque atención médica de emergencia inmediatamente')."
    }
    Devuelve ÚNICAMENTE el objeto JSON limpio. No incluyas explicaciones, ni introducciones, ni bloques decorativos fuera del JSON.
    `;

    try {
        console.log("=== Nueva petición de análisis recibida (Vía HTTP Directo) ===");
        console.log(`Métricas -> Sistólica: ${presionSistolica}, Diastólica: ${presionDiastolica}, Pulso: ${pulso}`);

        // 🌐 Leemos la variable de entorno de Render, y si no responde, usamos la fija de respaldo
        const BASE_URL = process.env.URL_OLLAMA || 'https://gave-subduing-lecturer.ngrok-free.dev';

        // 🚀 PETICIÓN DIRECTA POR AXIOS: Sin usar la librería de ollama que causaba el conflicto
        const respuestaOllama = await axios.post(`${BASE_URL}/api/chat`, {
            model: 'qwen2.5-coder:1.5b',
            messages: [{ role: 'user', content: prompt }],
            options: {
                temperature: 0.1 // Ultra bajo para consistencia médica
            },
            stream: false // Para recibir el texto completo de un solo golpe
        }, {
            headers: {
                'ngrok-skip-browser-warning': 'true' // Bypass al mensaje gris de ngrok
            }
        });

        let resultadoTexto = respuestaOllama.data.message.content.trim();
        
        // FILTRO ANTI-MARKDOWN
        if (resultadoTexto.startsWith('```')) {
            resultadoTexto = resultadoTexto
                .replace(/^```json/, '')
                .replace(/^```/, '')
                .replace(/```$/, '')
                .trim();
        }

        const resultadoJson = JSON.parse(resultadoTexto);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(resultadoJson);

    } catch (error) {
        console.error("Error en la conexión directa HTTP con Ollama:", error.message);
        return res.status(500).json({ 
            error: "No se pudo procesar el análisis de presión arterial en este momento." 
        });
    }
};

module.exports = { analizarPresion };