// controllers/htas.controller.js
const axios = require('axios');

exports.evaluarCrisisHTAS = async (req, res) => {
    try {
        // 1. Recibes los datos que vienen del frontend
        const { edad, sistolica, diastolica, tomaMedicamento } = req.body;

        // 2. Mapeas los datos al formato exacto que espera FastAPI (con mayúsculas)
        const datosParaPython = {
            Edad: parseInt(edad),
            Sistolica: parseInt(sistolica),
            Diastolica: parseInt(diastolica),
            Toma_Medicamento: parseInt(tomaMedicamento)
        };

        // 🌐 MODIFICADO: Cambiamos el endpoint fijo por la variable de entorno de Render
        const IA_SERVER_URL = process.env.URL_IA || 'http://127.0.0.1:8000';

        // 3. Petición al servidor de FastAPI en la nube
        const respuestaPython = await axios.post(`${IA_SERVER_URL}/predecir_crisis`, datosParaPython);

        // 4. (Opcional) Aquí puedes meter lógica para guardar en tu base de datos
        // Ej: await Paciente.guardarHistorial(...)

        // 5. Envías la respuesta final estructurada al cliente
        return res.status(200).json({
            success: true,
            mensaje: "Evaluación de crisis hipertensiva completada con éxito.",
            resultado: respuestaPython.data
        });

    } catch (error) {
        // Si FastAPI regresa el error clínico (400), lo atrapamos y se lo pasamos al cliente
        if (error.response) {
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data.detail
            });
        }

        console.error("Error al conectar con el servidor de IA (Python) en la nube:", error.message);
        return res.status(500).json({
            success: false,
            error: "No se pudo establecer conexión con el módulo de Inteligencia Artificial."
        });
    }
};