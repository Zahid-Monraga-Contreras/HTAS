const db = require("../db/database");

const medicamentosController = {
    // Obtener todos los medicamentos con opciones de filtrado
    getMedicamentos: async (req, res) => {
        const { busqueda, laboratorio, activo } = req.query;

        try {
            let query = `
                SELECT 
                    m.*,
                    COUNT(t.IdTratamiento) AS TotalTratamientos,
                    COUNT(CASE WHEN t.Activo = true THEN 1 END) AS TratamientosActivos
                FROM MEDICAMENTOS m
                LEFT JOIN TRATAMIENTOS t ON m.IdMedicamento = t.IdMedicamento
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            // Búsqueda por nombre comercial o sustancia activa
            if (busqueda) {
                query += ` AND (m.NombreComercial ILIKE $${paramCount} OR m.SustanciaActiva ILIKE $${paramCount})`;
                params.push(`%${busqueda}%`);
                paramCount++;
            }

            // Filtro por laboratorio
            if (laboratorio) {
                query += ` AND m.Laboratorio ILIKE $${paramCount}`;
                params.push(`%${laboratorio}%`);
                paramCount++;
            }

            query += ` GROUP BY m.IdMedicamento ORDER BY m.NombreComercial ASC`;

            const result = await db.query(query, params);
            return res.json(result.rows);
        } catch (error) {
            console.error("❌ Error al obtener medicamentos:", error);
            return res.status(500).json({
                error: "Error al obtener la lista de medicamentos"
            });
        }
    },

    // Obtener un medicamento específico por ID
    getMedicamentoById: async (req, res) => {
        const { id } = req.params;

        try {
            const query = `
                SELECT 
                    m.*,
                    COUNT(t.IdTratamiento) AS TotalTratamientos,
                    COUNT(CASE WHEN t.Activo = true THEN 1 END) AS TratamientosActivos,
                    json_agg(DISTINCT jsonb_build_object(
                        'IdTratamiento', t.IdTratamiento,
                        'Paciente', u.Nombre || ' ' || u.ApPaterno,
                        'Activo', t.Activo,
                        'FechaInicio', t.FechaInicio,
                        'FechaFin', t.FechaFin
                    )) FILTER (WHERE t.IdTratamiento IS NOT NULL) AS TratamientosRelacionados
                FROM MEDICAMENTOS m
                LEFT JOIN TRATAMIENTOS t ON m.IdMedicamento = t.IdMedicamento
                LEFT JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                WHERE m.IdMedicamento = $1
                GROUP BY m.IdMedicamento
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Medicamento no encontrado"
                });
            }

            return res.json(result.rows[0]);
        } catch (error) {
            console.error("❌ Error al obtener medicamento:", error);
            return res.status(500).json({
                error: "Error al obtener el medicamento"
            });
        }
    },

    // Crear un nuevo medicamento
    crearMedicamento: async (req, res) => {
        // Flexibilidad de mapeo: Soportamos tanto camelCase como minúsculas puras del Frontend
        const nombreComercial = req.body.nombreComercial || req.body.nombrecomercial;
        const sustanciaActiva = req.body.sustanciaActiva || req.body.sustanciaactiva;
        const presentacion = req.body.presentacion;
        const concentracion = req.body.concentracion;
        const laboratorio = req.body.laboratorio;
        const indicacionesGenerales = req.body.indicacionesGenerales || req.body.indicacionesgenerales;

        // Validación de seguridad para evitar inserciones vacías o nulas inesperadas
        if (!nombreComercial || nombreComercial.trim() === "") {
            return res.status(400).json({
                error: "El campo Nombre Comercial es obligatorio."
            });
        }

        if (!presentacion || presentacion.trim() === "") {
            return res.status(400).json({
                error: "El campo Presentación es obligatorio."
            });
        }

        try {
            // Verificar si ya existe un medicamento con el mismo nombre comercial
            const existe = await db.query(
                `SELECT IdMedicamento FROM MEDICAMENTOS 
                 WHERE NombreComercial ILIKE $1`,
                [nombreComercial.trim()]
            );

            if (existe.rows.length > 0) {
                return res.status(409).json({
                    error: "Ya existe un medicamento con este nombre comercial"
                });
            }

            const result = await db.query(
                `INSERT INTO MEDICAMENTOS (
                    NombreComercial, 
                    SustanciaActiva, 
                    Presentacion, 
                    Concentracion, 
                    Laboratorio, 
                    IndicacionesGenerales
                ) VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING *`,
                [
                    nombreComercial.trim(),
                    sustanciaActiva || null,
                    presentacion.trim(),
                    concentracion || null,
                    laboratorio || null,
                    indicacionesGenerales || null,
                ]
            );

            return res.status(201).json({
                message: "Medicamento creado con éxito",
                medicamento: result.rows[0],
            });
        } catch (error) {
            console.error("❌ Error al crear medicamento:", error);
            return res.status(500).json({
                error: "Error interno en el servidor al registrar el medicamento",
            });
        }
    },

    // Actualizar un medicamento existente
    actualizarMedicamento: async (req, res) => {
        const { id } = req.params;

        const nombreComercial = req.body.nombreComercial || req.body.nombrecomercial;
        const sustanciaActiva = req.body.sustanciaActiva || req.body.sustanciaactiva;
        const presentacion = req.body.presentacion;
        const concentracion = req.body.concentracion;
        const laboratorio = req.body.laboratorio;
        const indicacionesGenerales = req.body.indicacionesGenerales || req.body.indicacionesgenerales;

        if (!nombreComercial || nombreComercial.trim() === "") {
            return res.status(400).json({
                error: "El nombre comercial no puede estar vacío durante la actualización.",
            });
        }

        if (!presentacion || presentacion.trim() === "") {
            return res.status(400).json({
                error: "La presentación no puede estar vacía durante la actualización.",
            });
        }

        try {
            // Verificar si el medicamento existe
            const medicamentoExistente = await db.query(
                `SELECT IdMedicamento FROM MEDICAMENTOS WHERE IdMedicamento = $1`,
                [id]
            );

            if (medicamentoExistente.rows.length === 0) {
                return res.status(404).json({
                    error: "El medicamento solicitado no existe."
                });
            }

            // Verificar si el nuevo nombre ya está en uso por otro medicamento
            const nombreEnUso = await db.query(
                `SELECT IdMedicamento FROM MEDICAMENTOS 
                 WHERE NombreComercial ILIKE $1 AND IdMedicamento != $2`,
                [nombreComercial.trim(), id]
            );

            if (nombreEnUso.rows.length > 0) {
                return res.status(409).json({
                    error: "Ya existe otro medicamento con este nombre comercial"
                });
            }

            const result = await db.query(
                `UPDATE MEDICAMENTOS 
                SET 
                    NombreComercial = $1, 
                    SustanciaActiva = $2, 
                    Presentacion = $3, 
                    Concentracion = $4, 
                    Laboratorio = $5, 
                    IndicacionesGenerales = $6
                WHERE IdMedicamento = $7 
                RETURNING *`,
                [
                    nombreComercial.trim(),
                    sustanciaActiva || null,
                    presentacion.trim(),
                    concentracion || null,
                    laboratorio || null,
                    indicacionesGenerales || null,
                    id,
                ]
            );

            return res.json({
                message: "Medicamento actualizado con éxito",
                medicamento: result.rows[0],
            });
        } catch (error) {
            console.error("❌ Error crítico al actualizar medicamento:", error);
            return res.status(500).json({
                error: "Error interno en el servidor al actualizar el medicamento",
            });
        }
    },

    // Eliminar un medicamento (con verificación de dependencias)
    eliminarMedicamento: async (req, res) => {
        const { id } = req.params;
        console.log(`-> Petición de eliminación para ID: ${id}`);

        try {
            // Verificar si el medicamento existe
            const medicamentoExistente = await db.query(
                `SELECT IdMedicamento, NombreComercial FROM MEDICAMENTOS WHERE IdMedicamento = $1`,
                [id]
            );

            if (medicamentoExistente.rows.length === 0) {
                return res.status(404).json({
                    error: "Medicamento no encontrado para eliminar."
                });
            }

            // Verificar si tiene tratamientos asociados
            const tratamientosAsociados = await db.query(
                `SELECT COUNT(*) as total FROM TRATAMIENTOS WHERE IdMedicamento = $1`,
                [id]
            );

            const totalTratamientos = parseInt(tratamientosAsociados.rows[0].total);

            if (totalTratamientos > 0) {
                // Opcional: Mostrar cuántos tratamientos están asociados
                const tratamientosDetalle = await db.query(
                    `SELECT 
                        t.IdTratamiento,
                        u.Nombre || ' ' || u.ApPaterno AS Paciente,
                        t.Activo,
                        t.FechaInicio,
                        t.FechaFin
                    FROM TRATAMIENTOS t
                    JOIN USUARIOS u ON t.IdPaciente = u.IdUsuario
                    WHERE t.IdMedicamento = $1
                    LIMIT 5`,
                    [id]
                );

                return res.status(400).json({
                    error: `No se puede eliminar el medicamento porque está asociado a ${totalTratamientos} tratamiento(s).`,
                    tratamientos: tratamientosDetalle.rows,
                    totalTratamientos: totalTratamientos
                });
            }

            // Si no tiene dependencias, proceder con la eliminación
            const result = await db.query(
                "DELETE FROM MEDICAMENTOS WHERE IdMedicamento = $1 RETURNING *",
                [id]
            );

            return res.json({
                message: `Medicamento "${medicamentoExistente.rows[0].nombrecomercial}" eliminado correctamente`,
                medicamento: result.rows[0]
            });
        } catch (error) {
            console.error("❌ Error crítico al eliminar medicamento:", error);
            return res.status(500).json({
                error: "Error interno al eliminar el medicamento"
            });
        }
    },

    // Buscar medicamentos por nombre o sustancia activa (autocomplete)
    buscarMedicamentos: async (req, res) => {
        const { termino, limite } = req.query;

        if (!termino || termino.trim().length < 2) {
            return res.status(400).json({
                error: "El término de búsqueda debe tener al menos 2 caracteres"
            });
        }

        try {
            const query = `
                SELECT 
                    IdMedicamento,
                    NombreComercial,
                    SustanciaActiva,
                    Presentacion,
                    Concentracion,
                    Laboratorio,
                    CASE 
                        WHEN NombreComercial ILIKE $1 THEN 1
                        WHEN SustanciaActiva ILIKE $1 THEN 2
                        ELSE 3
                    END AS Relevancia
                FROM MEDICAMENTOS
                WHERE NombreComercial ILIKE $1 
                   OR SustanciaActiva ILIKE $1
                ORDER BY Relevancia, NombreComercial
                LIMIT $2
            `;

            const limitValue = limite && !isNaN(limite) ? parseInt(limite) : 10;
            const result = await db.query(query, [`%${termino.trim()}%`, limitValue]);

            return res.json(result.rows);
        } catch (error) {
            console.error("❌ Error al buscar medicamentos:", error);
            return res.status(500).json({
                error: "Error al buscar medicamentos"
            });
        }
    },

    // Obtener medicamentos más recetados
    getMedicamentosMasRecetados: async (req, res) => {
        const { limite } = req.query;

        try {
            const query = `
                SELECT 
                    m.IdMedicamento,
                    m.NombreComercial,
                    m.SustanciaActiva,
                    m.Laboratorio,
                    m.Presentacion,
                    COUNT(t.IdTratamiento) AS TotalRecetas,
                    COUNT(CASE WHEN t.Activo = true THEN 1 END) AS RecetasActivas
                FROM MEDICAMENTOS m
                JOIN TRATAMIENTOS t ON m.IdMedicamento = t.IdMedicamento
                GROUP BY m.IdMedicamento
                ORDER BY TotalRecetas DESC
                LIMIT $1
            `;

            const limitValue = limite && !isNaN(limite) ? parseInt(limite) : 10;
            const result = await db.query(query, [limitValue]);

            return res.json(result.rows);
        } catch (error) {
            console.error("❌ Error al obtener medicamentos más recetados:", error);
            return res.status(500).json({
                error: "Error al obtener los medicamentos más recetados"
            });
        }
    },

    // Obtener estadísticas de medicamentos
    getEstadisticasMedicamentos: async (req, res) => {
        try {
            const query = `
                SELECT 
                    COUNT(*) AS TotalMedicamentos,
                    COUNT(DISTINCT Laboratorio) AS TotalLaboratorios,
                    COUNT(DISTINCT SustanciaActiva) AS TotalSustanciasActivas,
                    COUNT(DISTINCT Presentacion) AS TotalPresentaciones,
                    (
                        SELECT Laboratorio 
                        FROM MEDICAMENTOS 
                        GROUP BY Laboratorio 
                        ORDER BY COUNT(*) DESC 
                        LIMIT 1
                    ) AS LaboratorioMasComun,
                    (
                        SELECT SustanciaActiva 
                        FROM MEDICAMENTOS 
                        WHERE SustanciaActiva IS NOT NULL
                        GROUP BY SustanciaActiva 
                        ORDER BY COUNT(*) DESC 
                        LIMIT 1
                    ) AS SustanciaMasComun,
                    (
                        SELECT COUNT(*) 
                        FROM MEDICAMENTOS 
                        WHERE Laboratorio IS NULL
                    ) AS MedicamentosSinLaboratorio
                FROM MEDICAMENTOS
            `;

            const result = await db.query(query);
            return res.json(result.rows[0]);
        } catch (error) {
            console.error("❌ Error al obtener estadísticas:", error);
            return res.status(500).json({
                error: "Error al obtener estadísticas de medicamentos"
            });
        }
    },

    // Actualización parcial de un medicamento (solo algunos campos)
    actualizarParcialMedicamento: async (req, res) => {
        const { id } = req.params;
        const campos = req.body;

        if (!campos || Object.keys(campos).length === 0) {
            return res.status(400).json({
                error: "Se requiere al menos un campo para actualizar"
            });
        }

        try {
            // Verificar si el medicamento existe
            const medicamentoExistente = await db.query(
                `SELECT IdMedicamento FROM MEDICAMENTOS WHERE IdMedicamento = $1`,
                [id]
            );

            if (medicamentoExistente.rows.length === 0) {
                return res.status(404).json({
                    error: "Medicamento no encontrado"
                });
            }

            // Construir la query dinámicamente
            const camposPermitidos = [
                'nombreComercial', 'nombrecomercial',
                'sustanciaActiva', 'sustanciaactiva',
                'presentacion',
                'concentracion',
                'laboratorio',
                'indicacionesGenerales', 'indicacionesgenerales'
            ];

            const updates = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(campos)) {
                const keyNormalized = key.toLowerCase();
                if (camposPermitidos.some(p => p.toLowerCase() === keyNormalized)) {
                    const dbField = keyNormalized === 'nombrecomercial' ? 'NombreComercial' :
                        keyNormalized === 'sustanciaactiva' ? 'SustanciaActiva' :
                            keyNormalized === 'indicacionesgenerales' ? 'IndicacionesGenerales' :
                                key.charAt(0).toUpperCase() + key.slice(1);

                    updates.push(`${dbField} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: "No se proporcionaron campos válidos para actualizar"
                });
            }

            values.push(id);
            const query = `
                UPDATE MEDICAMENTOS 
                SET ${updates.join(', ')}
                WHERE IdMedicamento = $${paramCount}
                RETURNING *
            `;

            const result = await db.query(query, values);

            return res.json({
                message: "Medicamento actualizado parcialmente",
                medicamento: result.rows[0]
            });
        } catch (error) {
            console.error("❌ Error en actualización parcial:", error);
            return res.status(500).json({
                error: "Error al actualizar el medicamento"
            });
        }
    },

    // ==========================================================================
    // OBTENER ESTADÍSTICAS DE UN MEDICAMENTO ESPECÍFICO
    // ==========================================================================
    getEstadisticasMedicamento: async (req, res) => {
        const { idMedicamento } = req.params;

        try {
            const query = `
            SELECT 
                COUNT(DISTINCT t.IdTratamiento) AS "totalTratamientos",
                COUNT(DISTINCT CASE WHEN t.Activo = true THEN t.IdTratamiento END) AS "tratamientosActivos",
                COUNT(DISTINCT t.IdPaciente) AS "pacientesActivos",
                MAX(t.FechaInicio) AS "ultimoUso"
            FROM TRATAMIENTOS t
            WHERE t.IdMedicamento = $1
        `;

            const result = await db.query(query, [idMedicamento]);

            // Si no hay tratamientos, devolver ceros
            if (!result.rows[0] || !result.rows[0].totalTratamientos) {
                return res.json({
                    totalTratamientos: 0,
                    tratamientosActivos: 0,
                    pacientesActivos: 0,
                    ultimoUso: null
                });
            }

            return res.json(result.rows[0]);
        } catch (error) {
            console.error("❌ Error al obtener estadísticas del medicamento:", error);
            return res.status(500).json({
                error: "Error al obtener estadísticas del medicamento"
            });
        }
    }
};

module.exports = medicamentosController;