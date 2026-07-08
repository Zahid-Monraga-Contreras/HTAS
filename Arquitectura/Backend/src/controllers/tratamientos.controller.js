const db = require("../db/database");

const tratamientosController = {
    getTratamientos: async (req, res) => {
        try {
            // Traemos el tratamiento junto con información completa del paciente y médico
            const queryText = `
                SELECT 
                    t.*,
                    -- Información del Paciente (desde USUARIOS)
                    u.Nombre AS NombrePaciente, 
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    u.Correo AS CorreoPaciente,
                    u.Telefono AS TelefonoPaciente,
                    u.FechaNacimiento AS FechaNacimientoPaciente,
                    u.CURP AS CURPPaciente,
                    u.Genero AS GeneroPaciente,
                    u.Domicilio AS DomicilioPaciente,
                    u.CodigoPostal AS CodigoPostalPaciente,
                    u.Localidad AS LocalidadPaciente,
                    u.Municipio AS MunicipioPaciente,
                    u.Estado AS EstadoPaciente,
                    
                    -- Datos específicos del paciente (desde PACIENTES)
                    p.NSS AS NSSPaciente,
                    p.TipoSangre AS TipoSangrePaciente,
                    p.Peso AS PesoPaciente,
                    p.Altura AS AlturaPaciente,
                    p.AntecedentesFamiliares AS AntecedentesFamiliaresPaciente,
                    
                    -- Información del Doctor (desde USUARIOS)
                    ud.Nombre AS NombreDoctor,
                    ud.ApPaterno AS ApPaternoDoctor,
                    ud.ApMaterno AS ApMaternoDoctor,
                    ud.Correo AS CorreoDoctor,
                    ud.Telefono AS TelefonoDoctor,
                    
                    -- Datos específicos del doctor (desde DOCTORES)
                    d.Cedula AS CedulaDoctor,
                    d.Especialidad AS EspecialidadDoctor,
                    d.DireccionClinica AS DireccionClinicaDoctor,
                    d.TipoSangre AS TipoSangreDoctor,
                    d.Peso AS PesoDoctor,
                    d.Altura AS AlturaDoctor,
                    d.AntecedentesFamiliares AS AntecedentesFamiliaresDoctor,
                    
                    -- Información del Medicamento
                    m.NombreComercial AS NombreMedicamento,
                    m.SustanciaActiva AS SustanciaActiva,
                    m.Presentacion AS PresentacionMedicamento,
                    m.Concentracion AS ConcentracionMedicamento,
                    m.Laboratorio AS LaboratorioMedicamento,
                    m.IndicacionesGenerales AS IndicacionesMedicamento
                    
                FROM TRATAMIENTOS t
                JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                JOIN PACIENTES p ON t.IdPaciente = p.IdUsuario
                LEFT JOIN DOCTORES d ON t.IdDoctor = d.IdUsuario
                LEFT JOIN USUARIOS ud ON d.IdUsuario = ud.IdUsuario
                JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
                WHERE u.deleted_at IS NULL
                ORDER BY t.IdTratamiento DESC
            `;
            const result = await db.query(queryText);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener tratamientos:", error);
            res.status(500).json({ error: "Error al obtener la lista de tratamientos" });
        }
    },

    // Obtener un tratamiento específico por ID
    getTratamientoById: async (req, res) => {
        const { id } = req.params;
        try {
            const queryText = `
                SELECT 
                    t.*,
                    u.Nombre AS NombrePaciente, 
                    u.ApPaterno AS ApPaternoPaciente,
                    u.ApMaterno AS ApMaternoPaciente,
                    u.Correo AS CorreoPaciente,
                    u.Telefono AS TelefonoPaciente,
                    u.FechaNacimiento AS FechaNacimientoPaciente,
                    u.CURP AS CURPPaciente,
                    u.Genero AS GeneroPaciente,
                    u.Domicilio AS DomicilioPaciente,
                    u.CodigoPostal AS CodigoPostalPaciente,
                    u.Localidad AS LocalidadPaciente,
                    u.Municipio AS MunicipioPaciente,
                    u.Estado AS EstadoPaciente,
                    p.NSS AS NSSPaciente,
                    p.TipoSangre AS TipoSangrePaciente,
                    p.Peso AS PesoPaciente,
                    p.Altura AS AlturaPaciente,
                    p.AntecedentesFamiliares AS AntecedentesFamiliaresPaciente,
                    ud.Nombre AS NombreDoctor,
                    ud.ApPaterno AS ApPaternoDoctor,
                    ud.ApMaterno AS ApMaternoDoctor,
                    d.Cedula AS CedulaDoctor,
                    d.Especialidad AS EspecialidadDoctor,
                    d.DireccionClinica AS DireccionClinicaDoctor,
                    m.NombreComercial AS NombreMedicamento,
                    m.SustanciaActiva AS SustanciaActiva,
                    m.Presentacion AS PresentacionMedicamento,
                    m.Concentracion AS ConcentracionMedicamento,
                    m.Laboratorio AS LaboratorioMedicamento,
                    m.IndicacionesGenerales AS IndicacionesMedicamento
                FROM TRATAMIENTOS t
                JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                JOIN PACIENTES p ON t.IdPaciente = p.IdUsuario
                LEFT JOIN DOCTORES d ON t.IdDoctor = d.IdUsuario
                LEFT JOIN USUARIOS ud ON d.IdUsuario = ud.IdUsuario
                JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
                WHERE t.IdTratamiento = $1 AND u.deleted_at IS NULL
            `;
            const result = await db.query(queryText, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener tratamiento:", error);
            res.status(500).json({ error: "Error al obtener el tratamiento" });
        }
    },

    // Obtener tratamientos por paciente
    getTratamientosByPaciente: async (req, res) => {
        const { idPaciente } = req.params;
        try {
            const queryText = `
                SELECT 
                    t.*,
                    u.Nombre AS NombrePaciente, 
                    u.ApPaterno AS ApPaternoPaciente,
                    ud.Nombre AS NombreDoctor,
                    ud.ApPaterno AS ApPaternoDoctor,
                    d.Especialidad AS EspecialidadDoctor,
                    m.NombreComercial AS NombreMedicamento,
                    m.SustanciaActiva AS SustanciaActiva,
                    m.Presentacion AS PresentacionMedicamento,
                    m.Concentracion AS ConcentracionMedicamento,
                    m.Laboratorio AS LaboratorioMedicamento
                FROM TRATAMIENTOS t
                JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                LEFT JOIN DOCTORES d ON t.IdDoctor = d.IdUsuario
                LEFT JOIN USUARIOS ud ON d.IdUsuario = ud.IdUsuario
                JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
                WHERE t.IdPaciente = $1 AND u.deleted_at IS NULL
                ORDER BY t.FechaInicio DESC
            `;
            const result = await db.query(queryText, [idPaciente]);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener tratamientos del paciente:", error);
            res.status(500).json({ error: "Error al obtener los tratamientos del paciente" });
        }
    },

    // Obtener tratamientos activos por paciente
    getTratamientosActivosByPaciente: async (req, res) => {
        const { idPaciente } = req.params;
        try {
            const queryText = `
                SELECT 
                    t.*,
                    u.Nombre AS NombrePaciente, 
                    u.ApPaterno AS ApPaternoPaciente,
                    ud.Nombre AS NombreDoctor,
                    ud.ApPaterno AS ApPaternoDoctor,
                    d.Especialidad AS EspecialidadDoctor,
                    m.NombreComercial AS NombreMedicamento,
                    m.SustanciaActiva AS SustanciaActiva,
                    m.Presentacion AS PresentacionMedicamento,
                    m.Concentracion AS ConcentracionMedicamento,
                    m.Laboratorio AS LaboratorioMedicamento,
                    -- Calcular días restantes del tratamiento
                    (t.FechaFin - CURRENT_DATE) AS DiasRestantes
                FROM TRATAMIENTOS t
                JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                LEFT JOIN DOCTORES d ON t.IdDoctor = d.IdUsuario
                LEFT JOIN USUARIOS ud ON d.IdUsuario = ud.IdUsuario
                JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
                WHERE t.IdPaciente = $1 
                    AND t.Activo = true 
                    AND t.FechaFin >= CURRENT_DATE
                    AND u.deleted_at IS NULL
                ORDER BY t.FechaFin ASC
            `;
            const result = await db.query(queryText, [idPaciente]);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener tratamientos activos del paciente:", error);
            res.status(500).json({ error: "Error al obtener los tratamientos activos" });
        }
    },

    crearTratamiento: async (req, res) => {
        const {
            idPaciente,
            idDoctor,
            idMedicamento,
            dosis,
            frecuenciaHoras,
            fechaInicio,
            fechaFin,
            notasInstrucciones,
            activo,
        } = req.body;

        // Validaciones básicas
        if (!idPaciente || !idMedicamento || !dosis || !frecuenciaHoras || !fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: "Faltan campos obligatorios: idPaciente, idMedicamento, dosis, frecuenciaHoras, fechaInicio, fechaFin"
            });
        }

        try {
            // Verificar que el paciente existe y está activo
            const pacienteExists = await db.query(
                `SELECT u.IdUsuario, u.Nombre, u.ApPaterno 
                 FROM USUARIOS u 
                 JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario 
                 WHERE u.IdUsuario = $1 AND u.Activo = true AND u.deleted_at IS NULL`,
                [idPaciente]
            );

            if (pacienteExists.rows.length === 0) {
                return res.status(404).json({ error: "Paciente no encontrado o inactivo" });
            }

            // Verificar que el medicamento existe
            const medicamentoExists = await db.query(
                `SELECT IdMedicamento FROM MEDICAMENTOS WHERE IdMedicamento = $1`,
                [idMedicamento]
            );

            if (medicamentoExists.rows.length === 0) {
                return res.status(404).json({ error: "Medicamento no encontrado" });
            }

            // Si se proporciona idDoctor, verificar que existe y es doctor
            if (idDoctor) {
                const doctorExists = await db.query(
                    `SELECT u.IdUsuario FROM USUARIOS u 
                     JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario 
                     WHERE u.IdUsuario = $1 AND u.Activo = true AND u.deleted_at IS NULL`,
                    [idDoctor]
                );

                if (doctorExists.rows.length === 0) {
                    return res.status(404).json({ error: "Doctor no encontrado o inactivo" });
                }
            }

            // Validar fechas
            if (new Date(fechaInicio) > new Date(fechaFin)) {
                return res.status(400).json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin" });
            }

            const result = await db.query(
                `INSERT INTO TRATAMIENTOS (
                    IdPaciente, 
                    IdDoctor, 
                    IdMedicamento, 
                    Dosis, 
                    FrecuenciaHoras, 
                    FechaInicio, 
                    FechaFin, 
                    NotasInstrucciones, 
                    Activo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    idPaciente,
                    idDoctor || null,
                    idMedicamento,
                    dosis,
                    frecuenciaHoras,
                    fechaInicio,
                    fechaFin,
                    notasInstrucciones || null,
                    activo !== undefined ? activo : true,
                ]
            );

            // Obtener el tratamiento completo con los datos del paciente para la respuesta
            const tratamientoCompleto = await db.query(
                `SELECT 
                    t.*,
                    u.Nombre AS NombrePaciente, 
                    u.ApPaterno AS ApPaternoPaciente,
                    ud.Nombre AS NombreDoctor,
                    ud.ApPaterno AS ApPaternoDoctor,
                    m.NombreComercial AS NombreMedicamento
                FROM TRATAMIENTOS t
                JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                LEFT JOIN DOCTORES d ON t.IdDoctor = d.IdUsuario
                LEFT JOIN USUARIOS ud ON d.IdUsuario = ud.IdUsuario
                JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
                WHERE t.IdTratamiento = $1`,
                [result.rows[0].idtratamiento]
            );

            res.status(201).json({
                message: "Tratamiento creado con éxito",
                tratamiento: tratamientoCompleto.rows[0],
            });
        } catch (error) {
            console.error("Error al crear tratamiento:", error);
            res.status(500).json({ error: "Error al registrar el tratamiento" });
        }
    },

    actualizarTratamiento: async (req, res) => {
        const { id } = req.params;
        const {
            idPaciente,
            idDoctor,
            idMedicamento,
            dosis,
            frecuenciaHoras,
            fechaInicio,
            fechaFin,
            notasInstrucciones,
            activo,
        } = req.body;

        try {
            // Verificar que el tratamiento existe
            const tratamientoExists = await db.query(
                `SELECT IdTratamiento FROM TRATAMIENTOS WHERE IdTratamiento = $1`,
                [id]
            );

            if (tratamientoExists.rows.length === 0) {
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            }

            // Validar fechas si se proporcionan
            if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
                return res.status(400).json({ error: "La fecha de inicio no puede ser mayor a la fecha de fin" });
            }

            const result = await db.query(
                `UPDATE TRATAMIENTOS 
                SET 
                    IdPaciente = COALESCE($1, IdPaciente),
                    IdDoctor = $2,
                    IdMedicamento = COALESCE($3, IdMedicamento),
                    Dosis = COALESCE($4, Dosis),
                    FrecuenciaHoras = COALESCE($5, FrecuenciaHoras),
                    FechaInicio = COALESCE($6, FechaInicio),
                    FechaFin = COALESCE($7, FechaFin),
                    NotasInstrucciones = COALESCE($8, NotasInstrucciones),
                    Activo = COALESCE($9, Activo),
                    updated_at = CURRENT_TIMESTAMP
                WHERE IdTratamiento = $10 
                RETURNING *`,
                [
                    idPaciente || null,
                    idDoctor !== undefined ? idDoctor : null,
                    idMedicamento || null,
                    dosis || null,
                    frecuenciaHoras || null,
                    fechaInicio || null,
                    fechaFin || null,
                    notasInstrucciones || null,
                    activo !== undefined ? activo : null,
                    id,
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            }

            // Obtener el tratamiento actualizado con datos completos
            const tratamientoCompleto = await db.query(
                `SELECT 
                    t.*,
                    u.Nombre AS NombrePaciente, 
                    u.ApPaterno AS ApPaternoPaciente,
                    ud.Nombre AS NombreDoctor,
                    ud.ApPaterno AS ApPaternoDoctor,
                    m.NombreComercial AS NombreMedicamento
                FROM TRATAMIENTOS t
                JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                LEFT JOIN DOCTORES d ON t.IdDoctor = d.IdUsuario
                LEFT JOIN USUARIOS ud ON d.IdUsuario = ud.IdUsuario
                JOIN MEDICAMENTOS m ON t.IdMedicamento = m.IdMedicamento
                WHERE t.IdTratamiento = $1`,
                [id]
            );

            res.json({
                message: "Tratamiento actualizado con éxito",
                tratamiento: tratamientoCompleto.rows[0],
            });
        } catch (error) {
            console.error("Error al actualizar tratamiento:", error);
            res.status(500).json({ error: "Error al actualizar el tratamiento" });
        }
    },

    // Actualizar solo el estado del tratamiento (activo/inactivo)
    toggleEstadoTratamiento: async (req, res) => {
        const { id } = req.params;
        const { activo } = req.body;

        try {
            const result = await db.query(
                `UPDATE TRATAMIENTOS 
                SET Activo = $1, updated_at = CURRENT_TIMESTAMP
                WHERE IdTratamiento = $2 
                RETURNING *`,
                [activo, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            }

            res.json({
                message: `Tratamiento ${activo ? 'activado' : 'desactivado'} con éxito`,
                tratamiento: result.rows[0],
            });
        } catch (error) {
            console.error("Error al cambiar estado del tratamiento:", error);
            res.status(500).json({ error: "Error al cambiar el estado del tratamiento" });
        }
    },

    eliminarTratamiento: async (req, res) => {
        const { id } = req.params;
        try {
            // Primero verificar si tiene registros de toma asociados
            const tomasAsociadas = await db.query(
                `SELECT COUNT(*) FROM REGISTRO_TOMAS WHERE IdTratamiento = $1`,
                [id]
            );

            if (parseInt(tomasAsociadas.rows[0].count) > 0) {
                return res.status(400).json({
                    error: "No se puede eliminar el tratamiento porque tiene registros de toma asociados. Considere desactivarlo en lugar de eliminarlo."
                });
            }

            const result = await db.query(
                "DELETE FROM TRATAMIENTOS WHERE IdTratamiento = $1 RETURNING *",
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Tratamiento no encontrado" });
            }

            res.json({
                message: "Tratamiento eliminado correctamente",
                tratamiento: result.rows[0]
            });
        } catch (error) {
            console.error("Error al eliminar tratamiento:", error);
            res.status(500).json({
                error: "No se puede eliminar el tratamiento debido a restricciones de integridad"
            });
        }
    },

    // Método para obtener estadísticas de tratamientos
    getEstadisticasTratamientos: async (req, res) => {
        try {
            const queryText = `
                SELECT 
                    COUNT(*) AS TotalTratamientos,
                    COUNT(CASE WHEN Activo = true THEN 1 END) AS TratamientosActivos,
                    COUNT(CASE WHEN Activo = false THEN 1 END) AS TratamientosInactivos,
                    COUNT(CASE WHEN FechaFin < CURRENT_DATE AND Activo = true THEN 1 END) AS TratamientosVencidos,
                    AVG(FrecuenciaHoras) AS PromedioFrecuenciaHoras,
                    (
                        SELECT m.NombreComercial 
                        FROM TRATAMIENTOS t2 
                        JOIN MEDICAMENTOS m ON t2.IdMedicamento = m.IdMedicamento 
                        GROUP BY m.NombreComercial 
                        ORDER BY COUNT(*) DESC 
                        LIMIT 1
                    ) AS MedicamentoMasRecetado
                FROM TRATAMIENTOS
                WHERE IdPaciente IN (SELECT IdUsuario FROM USUARIOS WHERE deleted_at IS NULL)
            `;
            const result = await db.query(queryText);
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener estadísticas:", error);
            res.status(500).json({ error: "Error al obtener estadísticas de tratamientos" });
        }
    },

    // ==========================================================================
    // OBTENER TRATAMIENTOS POR MEDICAMENTO
    // ==========================================================================
    getTratamientosByMedicamento: async (req, res) => {
        const { idMedicamento } = req.params;

        try {
            const query = `
            SELECT 
                t.IdTratamiento AS id,
                u.Nombre || ' ' || u.ApPaterno AS paciente,
                u.IdUsuario AS "idPaciente",
                t.FechaInicio AS "fechaInicio",
                t.FechaFin AS "fechaFin",
                t.Activo AS activo,
                t.Dosis AS dosis,
                t.IdMedicamento AS "idMedicamento"
            FROM TRATAMIENTOS t
            JOIN USUARIOS u ON u.IdUsuario = t.IdPaciente
            WHERE t.IdMedicamento = $1
            ORDER BY t.FechaInicio DESC
        `;

            const result = await db.query(query, [idMedicamento]);
            return res.json(result.rows);
        } catch (error) {
            console.error("❌ Error al obtener tratamientos por medicamento:", error);
            return res.status(500).json({
                error: "Error al obtener tratamientos del medicamento"
            });
        }
    }
};

module.exports = tratamientosController;