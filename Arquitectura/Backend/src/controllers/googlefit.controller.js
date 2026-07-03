const db = require("../db/database");
const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
);

const googleFitController = {
    googleFitAuth: (req, res) => {
        const { userId } = req.query; // Angular debe enviar el ID del usuario
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: [
                "https://www.googleapis.com/auth/fitness.blood_pressure.read",
                "https://www.googleapis.com/auth/fitness.heart_rate.read",
            ],
            state: userId, // Esto vuelve en el callback para saber quién es
            prompt: "consent",
        });
        res.json({ url });
    },

    googleFitCallback: async (req, res) => {
        const { code, state } = req.query; // state es el userId que enviamos
        try {
            const { tokens } = await oauth2Client.getToken(code);

            // Guardar tokens en la BD
            await db.query(
                "UPDATE USUARIOS SET GoogleFitToken = $1 WHERE IdUsuario = $2",
                [JSON.stringify(tokens), state],
            );

            res.redirect("http://localhost:4200/dispositivos/editar/6?status=success");
        } catch (error) {
            console.error("Error en callback:", error);
            res.redirect("http://localhost:4200/dispositivos/editar/6?status=error");
        }
    },

    googleFitData: async (req, res) => {
        const { idPaciente } = req.params;

        // 1. Obtén el token guardado de la base de datos
        const result = await db.query(
            "SELECT GoogleFitToken FROM USUARIOS WHERE IdUsuario = $1",
            [idPaciente],
        );
        const token = JSON.parse(result.rows[0].googlefittoken);

        // 2. Configura el cliente con el token obtenido
        oauth2Client.setCredentials(token);

        // 3. Pide los datos a la API de Fitness
        const fitness = google.fitness({ version: "v1", auth: oauth2Client });

        const response = await fitness.users.dataset.aggregate({
            userId: "me",
            requestBody: {
                aggregateBy: [{ dataTypeName: "com.google.blood_pressure" }],
                startTimeMillis: Date.now() - 7 * 24 * 60 * 60 * 1000, // Datos de la última semana
                endTimeMillis: Date.now(),
            },
        });

        // 4. Envía los datos al Frontend
        res.json(response.data.bucket);
    },
};

module.exports = googleFitController;