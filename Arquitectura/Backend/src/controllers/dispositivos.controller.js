const db = require("../db/database");

const dispositivosController = {
    // ==========================================================================
    // OBTENER TODOS LOS DISPOSITIVOS - CORREGIDO
    // ==========================================================================
    getDispositivos: async (req, res) => {
        const { paciente, activo, busqueda } = req.query;

        try {
            let queryText = `
                SELECT 
                    d.*, 
                    u.nombre AS nombrepaciente, 
                    u.appaterno AS appaternopaciente,
                    u.apmaterno AS apmaternopaciente,
                    u.correo AS correopaciente,
                    u.telefono AS telefonopaciente
                FROM dispositivos d
                LEFT JOIN usuarios u ON d.idpacienteasociado = u.idusuario
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            if (paciente) {
                queryText += ` AND d.idpacienteasociado = $${paramCount}`;
                params.push(paciente);
                paramCount++;
            }

            if (activo !== undefined && activo !== '') {
                queryText += ` AND d.activo = $${paramCount}`;
                params.push(activo === 'true' || activo === true);
                paramCount++;
            }

            if (busqueda) {
                queryText += ` AND (d.nombre ILIKE $${paramCount} OR d.direccionmac ILIKE $${paramCount})`;
                params.push(`%${busqueda}%`);
                paramCount++;
            }

            queryText += ` ORDER BY d.iddispositivo DESC`;

            const result = await db.query(queryText, params);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener dispositivos:", error);
            res.status(500).json({
                error: "Error al obtener la lista de dispositivos"
            });
        }
    },

    // ==========================================================================
    // OBTENER DISPOSITIVO POR ID
    // ==========================================================================
    getDispositivoById: async (req, res) => {
        const { id } = req.params;

        try {
            const queryText = `
                SELECT 
                    d.*, 
                    u.nombre AS nombrepaciente, 
                    u.appaterno AS appaternopaciente,
                    u.apmaterno AS apmaternopaciente,
                    u.correo AS correopaciente,
                    u.telefono AS telefonopaciente,
                    u.fechanacimiento AS fechanacimientopaciente,
                    u.curp AS curppaciente,
                    u.domicilio AS domiciliopaciente,
                    u.localidad AS localidadpaciente,
                    u.municipio AS municipiopaciente,
                    u.estado AS estadopaciente
                FROM dispositivos d
                LEFT JOIN usuarios u ON d.idpacienteasociado = u.idusuario
                WHERE d.iddispositivo = $1
            `;

            const result = await db.query(queryText, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Dispositivo no encontrado"
                });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener dispositivo:", error);
            res.status(500).json({
                error: "Error al obtener el dispositivo"
            });
        }
    },

    // ==========================================================================
    // OBTENER DISPOSITIVOS POR PACIENTE
    // ==========================================================================
    getDispositivosByPaciente: async (req, res) => {
        const { idPaciente } = req.params;

        try {
            const queryText = `
                SELECT 
                    d.*
                FROM dispositivos d
                WHERE d.idpacienteasociado = $1
                ORDER BY d.nombre ASC
            `;

            const result = await db.query(queryText, [idPaciente]);
            res.json(result.rows);
        } catch (error) {
            console.error("Error al obtener dispositivos del paciente:", error);
            res.status(500).json({
                error: "Error al obtener los dispositivos del paciente"
            });
        }
    },

    // ==========================================================================
    // CREAR DISPOSITIVO
    // ==========================================================================
    crearDispositivo: async (req, res) => {
        const { nombre, direccionMac, idPacienteAsociado } = req.body;
        const macNormalizada = direccionMac ? direccionMac.trim().toUpperCase() : "";

        if (!nombre || nombre.trim() === "") {
            return res.status(400).json({
                error: "El nombre del dispositivo es obligatorio"
            });
        }

        if (!direccionMac || direccionMac.trim() === "") {
            return res.status(400).json({
                error: "La dirección MAC del dispositivo es obligatoria"
            });
        }

        // Validación básica de formato MAC
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(macNormalizada)) {
            return res.status(400).json({
                error: "Formato de MAC address inválido. Ejemplo: AA:BB:CC:DD:EE:FF"
            });
        }

        try {
            // Verificar si el paciente existe (si se asignó uno)
            if (idPacienteAsociado) {
                const pacienteExists = await db.query(
                    `SELECT u.idusuario FROM usuarios u 
                     JOIN pacientes p ON u.idusuario = p.idusuario 
                     WHERE u.idusuario = $1 AND u.activo = true AND u.deleted_at IS NULL`,
                    [idPacienteAsociado]
                );

                if (pacienteExists.rows.length === 0) {
                    return res.status(404).json({
                        error: "Paciente no encontrado o inactivo"
                    });
                }
            }

            const macExists = await db.query(
                `SELECT iddispositivo FROM dispositivos WHERE direccionmac = $1`,
                [macNormalizada]
            );

            if (macExists.rows.length > 0) {
                return res.status(409).json({
                    error: "Ya existe un dispositivo registrado con esta dirección MAC"
                });
            }

            const result = await db.query(
                `INSERT INTO dispositivos (nombre, direccionmac, idpacienteasociado) 
                VALUES ($1, $2, $3) RETURNING *`,
                [nombre.trim(), macNormalizada, idPacienteAsociado || null]
            );

            res.status(201).json({
                message: "Dispositivo vinculado con éxito",
                dispositivo: result.rows[0],
            });
        } catch (error) {
            console.error("Error al vincular dispositivo:", error);
            res.status(500).json({
                error: "Error al registrar dispositivo. Verifique que la identificación (MAC) sea única.",
            });
        }
    },

    // ==========================================================================
    // ACTUALIZAR DISPOSITIVO
    // ==========================================================================
    actualizarDispositivo: async (req, res) => {
        const { id } = req.params;
        const { nombre, direccionMac, idPacienteAsociado, activo } = req.body;
        const macNormalizada = direccionMac ? direccionMac.trim().toUpperCase() : "";

        try {
            const dispositivoExists = await db.query(
                `SELECT iddispositivo FROM dispositivos WHERE iddispositivo = $1`,
                [id]
            );

            if (dispositivoExists.rows.length === 0) {
                return res.status(404).json({
                    error: "Dispositivo no encontrado"
                });
            }

            if (macNormalizada) {
                const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
                if (!macRegex.test(macNormalizada)) {
                    return res.status(400).json({
                        error: "Formato de MAC address inválido. Ejemplo: AA:BB:CC:DD:EE:FF"
                    });
                }

                const macExists = await db.query(
                    `SELECT iddispositivo FROM dispositivos 
                     WHERE direccionmac = $1 AND iddispositivo != $2`,
                    [macNormalizada, id]
                );

                if (macExists.rows.length > 0) {
                    return res.status(409).json({
                        error: "Ya existe otro dispositivo con esta dirección MAC"
                    });
                }
            }

            // Construir query dinámicamente
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (nombre !== undefined) {
                updates.push(`nombre = $${paramCount}`);
                values.push(nombre.trim());
                paramCount++;
            }

            if (direccionMac !== undefined) {
                updates.push(`direccionmac = $${paramCount}`);
                values.push(macNormalizada);
                paramCount++;
            }

            if (idPacienteAsociado !== undefined) {
                updates.push(`idpacienteasociado = $${paramCount}`);
                values.push(idPacienteAsociado || null);
                paramCount++;
            }

            if (activo !== undefined) {
                updates.push(`activo = $${paramCount}`);
                values.push(activo);
                paramCount++;
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);

            if (updates.length === 1) {
                return res.status(400).json({
                    error: "No se proporcionaron campos para actualizar"
                });
            }

            values.push(id);
            const queryText = `
                UPDATE dispositivos 
                SET ${updates.join(', ')}
                WHERE iddispositivo = $${paramCount}
                RETURNING *
            `;

            const result = await db.query(queryText, values);

            res.json({
                message: "Dispositivo actualizado con éxito",
                dispositivo: result.rows[0],
            });
        } catch (error) {
            console.error("Error al actualizar dispositivo:", error);
            res.status(500).json({
                error: "Error al actualizar los datos del dispositivo"
            });
        }
    },

    // ==========================================================================
    // ELIMINAR DISPOSITIVO
    // ==========================================================================
    eliminarDispositivo: async (req, res) => {
        const { id } = req.params;

        try {
            const dispositivoExists = await db.query(
                `SELECT iddispositivo, nombre FROM dispositivos WHERE iddispositivo = $1`,
                [id]
            );

            if (dispositivoExists.rows.length === 0) {
                return res.status(404).json({
                    error: "Dispositivo no encontrado"
                });
            }

            // Verificar si tiene mediciones asociadas
            const medicionesAsociadas = await db.query(
                `SELECT COUNT(*) as total FROM mediciones_presion WHERE iddispositivo = $1`,
                [id]
            );

            const totalMediciones = parseInt(medicionesAsociadas.rows[0].total);

            if (totalMediciones > 0) {
                return res.status(400).json({
                    error: `No se puede eliminar el dispositivo porque tiene ${totalMediciones} medición(es) asociada(s).`,
                    sugerencia: "Considere desactivar el dispositivo en lugar de eliminarlo"
                });
            }

            const result = await db.query(
                `DELETE FROM dispositivos WHERE iddispositivo = $1 RETURNING *`,
                [id]
            );

            res.json({
                message: `Dispositivo eliminado correctamente`,
                dispositivo: result.rows[0]
            });
        } catch (error) {
            console.error("Error al eliminar dispositivo:", error);
            res.status(500).json({
                error: "Error al eliminar dispositivo de la base de datos"
            });
        }
    },

    // ==========================================================================
    // DESACTIVAR DISPOSITIVO
    // ==========================================================================
    desactivarDispositivo: async (req, res) => {
        const { id } = req.params;

        try {
            const result = await db.query(
                `UPDATE dispositivos 
                SET activo = false, updated_at = CURRENT_TIMESTAMP
                WHERE iddispositivo = $1 
                RETURNING *`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Dispositivo no encontrado"
                });
            }

            res.json({
                message: "Dispositivo desactivado correctamente",
                dispositivo: result.rows[0]
            });
        } catch (error) {
            console.error("Error al desactivar dispositivo:", error);
            res.status(500).json({
                error: "Error al desactivar el dispositivo"
            });
        }
    },

    // ==========================================================================
    // ACTIVAR DISPOSITIVO
    // ==========================================================================
    activarDispositivo: async (req, res) => {
        const { id } = req.params;

        try {
            const result = await db.query(
                `UPDATE dispositivos 
                SET activo = true, updated_at = CURRENT_TIMESTAMP
                WHERE iddispositivo = $1 
                RETURNING *`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Dispositivo no encontrado"
                });
            }

            res.json({
                message: "Dispositivo activado correctamente",
                dispositivo: result.rows[0]
            });
        } catch (error) {
            console.error("Error al activar dispositivo:", error);
            res.status(500).json({
                error: "Error al activar el dispositivo"
            });
        }
    },

    // ==========================================================================
    // SINCRONIZAR DISPOSITIVO
    // ==========================================================================
    sincronizarDispositivo: async (req, res) => {
        const { id } = req.params;

        try {
            const result = await db.query(
                `UPDATE dispositivos 
                SET ultimasincronizacion = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE iddispositivo = $1 AND activo = true
                RETURNING *`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Dispositivo no encontrado o inactivo"
                });
            }

            res.json({
                message: "Dispositivo sincronizado correctamente",
                dispositivo: result.rows[0],
                fechasincronizacion: result.rows[0].ultimasincronizacion
            });
        } catch (error) {
            console.error("Error al sincronizar dispositivo:", error);
            res.status(500).json({
                error: "Error al sincronizar el dispositivo"
            });
        }
    },

    // ==========================================================================
    // OBTENER ESTADÍSTICAS DE DISPOSITIVOS
    // ==========================================================================
    getEstadisticasDispositivos: async (req, res) => {
        try {
            const queryText = `
                SELECT 
                    COUNT(*) AS totaldispositivos,
                    COUNT(CASE WHEN activo = true THEN 1 END) AS dispositivosactivos,
                    COUNT(CASE WHEN activo = false THEN 1 END) AS dispositivosinactivos,
                    COUNT(DISTINCT idpacienteasociado) AS pacientescondispositivos,
                    COUNT(CASE WHEN idpacienteasociado IS NULL THEN 1 END) AS dispositivossinasignar
                FROM dispositivos
            `;

            const result = await db.query(queryText);
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error al obtener estadísticas:", error);
            res.status(500).json({
                error: "Error al obtener estadísticas de dispositivos"
            });
        }
    }
};

module.exports = dispositivosController;