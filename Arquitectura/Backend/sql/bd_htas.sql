-- Habilitar extensión para seguridad de contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. TABLA NÚCLEO: USUARIOS (ACTUALIZADA)
-- ============================================
CREATE TABLE USUARIOS (
    IdUsuario SERIAL PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL,
    ApPaterno VARCHAR(50) NOT NULL,
    ApMaterno VARCHAR(50),
    Correo VARCHAR(60) UNIQUE NOT NULL,
    Contrasenia TEXT NOT NULL, 
    Telefono BIGINT,

-- Nuevos campos de datos personales
FechaNacimiento DATE,
CURP VARCHAR(18) UNIQUE,
Genero VARCHAR(20) CHECK (
    Genero IN (
        'Masculino',
        'Femenino',
        'Otro',
        'No especificado'
    )
),

-- Nuevos campos de ubicación
Domicilio TEXT,
CodigoPostal VARCHAR(10),
Localidad VARCHAR(60), -- Ej: Córdoba, Yanga
Municipio VARCHAR(60), -- Ej: Córdoba
Estado VARCHAR(40), -- Ej: Veracruz

-- Campos existentes
Rol VARCHAR(20) CHECK (Rol IN ('Paciente', 'Doctor', 'Acompañante', 'Admin')),
    PinVerificacion VARCHAR(6),
    PinVerificado BOOLEAN DEFAULT FALSE,
    IntentosFallidos INT DEFAULT 0,
    BloqueadoHasta TIMESTAMP DEFAULT NULL,
    Activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Agregar columna GoogleFitToken
ALTER TABLE USUARIOS ADD COLUMN GoogleFitToken JSONB;

-- ============================================
-- 2. TABLA: DOCTORES
-- ============================================
CREATE TABLE DOCTORES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS (IdUsuario) ON DELETE CASCADE,
    Cedula VARCHAR(20) UNIQUE NOT NULL,
    ArchivoCedulaPDF TEXT NOT NULL,
    Especialidad VARCHAR(60) NOT NULL,
    DireccionClinica VARCHAR(100),
    TipoSangre VARCHAR(5) CHECK (
        TipoSangre IN (
            'O+',
            'O-',
            'A+',
            'A-',
            'B+',
            'B-',
            'AB+',
            'AB-'
        )
    ),
    Peso NUMERIC(5, 2), -- En kg (ejemplo: 78.50)
    Altura NUMERIC(3, 2), -- En metros (ejemplo: 1.75)
    AntecedentesFamiliares TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT  
    d . IdUsuario , 
    u . Nombre , 
    u . ApPaterno , 
    u . ApMaterno , 
    u . Correo , 
    d . Cedula , 
    d . Especialidad , 
    d . TipoSangre , 
    d . Peso , 
    d . Altura 
FROM  DOCTORES d 
JOIN  USUARIOS u  ON  d . IdUsuario  =  u . IdUsuario 
WHERE  u . Activo  =  true  AND  u . deleted_at  IS  NULL ; 

-- ============================================
-- 3. TABLA: PACIENTES
-- ============================================
CREATE TABLE PACIENTES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS (IdUsuario) ON DELETE CASCADE,
    NSS VARCHAR(11) UNIQUE, -- Número de Seguridad Social
    TipoSangre VARCHAR(5) CHECK (
        TipoSangre IN (
            'O+',
            'O-',
            'A+',
            'A-',
            'B+',
            'B-',
            'AB+',
            'AB-'
        )
    ),
    Peso NUMERIC(5, 2), -- En kg (ejemplo: 78.50)
    Altura NUMERIC(3, 2), -- En metros (ejemplo: 1.75)
    AntecedentesFamiliares TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT*FROM PACIENTES;

-- Verificar el estado del usuario
SELECT 
    IdUsuario,
    Nombre,
    ApPaterno,
    ApMaterno,
    Correo,
    Activo,
    deleted_at
FROM USUARIOS 
WHERE IdUsuario = 1;

-- Ver todos los pacientes
SELECT 
    p.IdUsuario,
    u.Nombre,
    u.ApPaterno,
    u.ApMaterno,
    u.Correo,
    p.NSS,
    p.TipoSangre,
    p.Peso,
    p.Altura,
    p.AntecedentesFamiliares
FROM PACIENTES p
JOIN USUARIOS u ON p.IdUsuario = u.IdUsuario
WHERE u.Activo = true AND u.deleted_at IS NULL;

SELECT * FROM PACIENTES WHERE IdUsuario = 1;

-- ============================================
-- 4. TABLA: ACOMPANANTES (ACTUALIZADA)
-- ============================================
CREATE TABLE ACOMPANANTES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS (IdUsuario) ON DELETE CASCADE,
    -- FechaNacimiento eliminada porque ahora está en USUARIOS
    FechaAsignacion DATE NOT NULL,
    IdPacienteAsociado INT REFERENCES PACIENTES (IdUsuario) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alter para permitir NULL en FechaAsignacion
ALTER TABLE ACOMPANANTES ALTER COLUMN FechaAsignacion DROP NOT NULL;

-- Ver todos los acompañantes
SELECT 
    a.IdUsuario,
    u.Nombre,
    u.ApPaterno,
    u.ApMaterno,
    u.Correo,
    a.FechaAsignacion,
    a.IdPacienteAsociado,
    pu.Nombre AS NombrePaciente,
    pu.ApPaterno AS ApPaternoPaciente
FROM ACOMPANANTES a
JOIN USUARIOS u ON a.IdUsuario = u.IdUsuario
LEFT JOIN USUARIOS pu ON a.IdPacienteAsociado = pu.IdUsuario
WHERE u.Activo = true AND u.deleted_at IS NULL;

SELECT IdUsuario, Nombre, Activo, deleted_at 
FROM USUARIOS 
WHERE IdUsuario = 1;

-- Ver la estructura exacta de PACIENTES
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pacientes'
ORDER BY ordinal_position;

-- ============================================
-- 5. TABLA: ADMINISTRADORES
-- ============================================
CREATE TABLE ADMINISTRADORES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS (IdUsuario) ON DELETE CASCADE,
    NivelPermiso VARCHAR(20) DEFAULT 'Soporte' CHECK (
        NivelPermiso IN (
            'SuperAdmin',
            'Soporte',
            'Moderador'
        )
    ),
    AreaResponsabilidad VARCHAR(50) DEFAULT 'General', -- Ej: 'Sistemas', 'Atención Médica', 'Auditoría'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. TABLA: SESIONES (Soporte Multisesión)
-- ============================================
CREATE TABLE SESIONES (
    IdSesion SERIAL PRIMARY KEY,
    IdUsuario INT NOT NULL REFERENCES USUARIOS (IdUsuario) ON DELETE CASCADE,
    RefreshToken TEXT UNIQUE NOT NULL, -- Token para refrescar la sesión
    DispositivoInfo TEXT, -- Ej: "App Android", "Navegador Chrome"
    IpAddress VARCHAR(45),
    FechaExpiracion TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. TABLA: CITAS
-- ============================================
CREATE TABLE CITAS ( IdCita SERIAL PRIMARY KEY,

-- Datos del Paciente (Ahora como texto directo)
NombrePaciente VARCHAR(100) NOT NULL,
ApPaternoPaciente VARCHAR(100) NOT NULL,
ApMaternoPaciente VARCHAR(100),
TelefonoPaciente VARCHAR(20),
CorreoPaciente VARCHAR(150),

-- Datos de la Cita
FechaCita DATE NOT NULL,
HoraCita TIME NOT NULL,
Motivo TEXT,
Sintomas TEXT,
Estado VARCHAR(20) DEFAULT 'Programada' CHECK (
    Estado IN (
        'Programada',
        'Confirmada',
        'Completada',
        'Cancelada',
        'No Asistió'
    )
),
Modalidad VARCHAR(15) DEFAULT 'Presencial' CHECK (
    Modalidad IN ('Presencial', 'Virtual')
),
NotasDoctor TEXT,

-- Auditoría
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. TABLA: MEDICAMENTOS
-- ============================================
CREATE TABLE MEDICAMENTOS (
    IdMedicamento SERIAL PRIMARY KEY,
    NombreComercial VARCHAR(100) NOT NULL,
    SustanciaActiva VARCHAR(100), -- Ej: Paracetamol, Ibuprofeno
    Presentacion VARCHAR(50) NOT NULL, -- Ej: Tabletas, Jarabe, Cápsulas
    Concentracion VARCHAR(30), -- Ej: 500 mg, 10 ml
    Laboratorio VARCHAR(60),
    IndicacionesGenerales TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. TABLA: TRATAMIENTOS
-- ============================================
CREATE TABLE TRATAMIENTOS (
    IdTratamiento SERIAL PRIMARY KEY,
    IdPaciente INT NOT NULL REFERENCES PACIENTES(IdUsuario) ON DELETE CASCADE,
    IdDoctor INT REFERENCES DOCTORES(IdUsuario) ON DELETE SET NULL, -- Puede ser NULL si lo registra el paciente/acompañante solo
    IdMedicamento INT NOT NULL REFERENCES MEDICAMENTOS(IdMedicamento),

-- Detalles de la dosificación
Dosis VARCHAR(50) NOT NULL, -- Ej: "1 tableta", "5 ml"
FrecuenciaHoras INT NOT NULL, -- Ej: 8 (significa cada 8 horas)

-- Duración del tratamiento

FechaInicio DATE NOT NULL,
    FechaFin DATE NOT NULL,
    
    NotasInstrucciones TEXT, -- Ej: "Tomar después de los alimentos"
    Activo BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. TABLA: REGISTRO_TOMAS
-- ============================================
CREATE TABLE REGISTRO_TOMAS (
    IdTomar SERIAL PRIMARY KEY,
    IdTratamiento INT NOT NULL REFERENCES TRATAMIENTOS (IdTratamiento) ON DELETE CASCADE,
    IdAcompananteQueRegistro INT REFERENCES ACOMPANANTES (IdUsuario) ON DELETE SET NULL, -- Por si un acompañante le dio la toma
    FechaHoraProgramada TIMESTAMP NOT NULL, -- Cuándo le tocaba según el horario
    FechaHoraRealizada TIMESTAMP, -- Cuándo se la tomó realmente (NULL si no se la ha tomado)
    EstadoTomar VARCHAR(20) DEFAULT 'Pendiente' CHECK (
        EstadoTomar IN (
            'Pendiente',
            'Tomada',
            'Omitida',
            'Retrasada'
        )
    ),
    NotasTomas TEXT, -- Ej: "Sintió náuseas después de tomarla"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. TABLA: DISPOSITIVOS
-- ============================================
CREATE TABLE DISPOSITIVOS (
    IdDispositivo SERIAL PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL,              -- Ej: "Xiaomi Smart Band 8", "Fitbit Charge"
    DireccionMac VARCHAR(50) UNIQUE NOT NULL, -- Valida y almacena la MAC Address
    UltimaSincronizacion TIMESTAMP DEFAULT NULL,
    Activo BOOLEAN DEFAULT TRUE,

-- "Asignado a:" -> Relación directa con el Paciente
IdPacienteAsociado INT REFERENCES PACIENTES (IdUsuario) ON DELETE SET NULL,

-- Auditoría básica
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. TABLA: MEDICIONES_PRESION (Lecturas del Tensiómetro)
-- ============================================
CREATE TABLE MEDICIONES_PRESION (
    IdMedicion SERIAL PRIMARY KEY,
    IdPaciente INT NOT NULL REFERENCES PACIENTES(IdUsuario) ON DELETE CASCADE,

-- Valores del Tensiómetro
Sistolica INT NOT NULL CHECK (Sistolica BETWEEN 40 AND 260), -- SYS mmHg (Ej: 103)
Diastolica INT NOT NULL CHECK (Diastolica BETWEEN 30 AND 200), -- DIA mmHg (Ej: 60)
Pulso INT NOT NULL CHECK (Pulso BETWEEN 30 AND 220), -- PULSE /min (Ej: 68)

-- Información de contexto
Unidad VARCHAR(10) DEFAULT 'mmHg',
MetodoSincronizacion VARCHAR(20) DEFAULT 'Bluetooth' CHECK (
    MetodoSincronizacion IN ('Bluetooth', 'Manual')
),

-- Auditoría de tiempo
FechaHoraLectura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Momento en que se registró
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM MEDICIONES_PRESION WHERE IdPaciente = 2;

-- Eliminar la restricción actual
ALTER TABLE MEDICIONES_PRESION 
DROP CONSTRAINT IF EXISTS mediciones_presion_pulso_check;

-- Crear una nueva restricción que permita 0
ALTER TABLE MEDICIONES_PRESION 
ADD CONSTRAINT mediciones_presion_pulso_check 
CHECK (Pulso = 0 OR (Pulso BETWEEN 30 AND 220));

-- ============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================
CREATE INDEX idx_citas_fecha ON CITAS (FechaCita);

CREATE INDEX idx_usuarios_curp ON USUARIOS (CURP);

CREATE INDEX idx_usuarios_correo ON USUARIOS (Correo);

CREATE INDEX idx_usuarios_rol ON USUARIOS (Rol);

CREATE INDEX idx_pacientes_nss ON PACIENTES (NSS);

-- ============================================
-- FUNCIÓN PARA CALCULAR EDAD
-- ============================================
CREATE OR REPLACE FUNCTION calcular_edad(fecha_nac DATE)
RETURNS INT AS $$
BEGIN
    IF fecha_nac IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN DATE_PART('year', AGE(CURRENT_DATE, fecha_nac))::INT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VISTA PARA INFORMACIÓN COMPLETA DE USUARIOS
-- ============================================
CREATE OR REPLACE VIEW VW_USUARIOS_COMPLETO AS
SELECT
    u.IdUsuario,
    u.Nombre,
    u.ApPaterno,
    u.ApMaterno,
    u.Correo,
    u.Telefono,
    u.FechaNacimiento,
    calcular_edad (u.FechaNacimiento) AS Edad,
    u.CURP,
    u.Genero,
    u.Domicilio,
    u.CodigoPostal,
    u.Localidad,
    u.Municipio,
    u.Estado,
    u.Rol,
    u.PinVerificado,
    u.Activo,
    u.created_at,
    u.updated_at,
    CASE
        WHEN d.IdUsuario IS NOT NULL THEN 'Doctor'
        WHEN p.IdUsuario IS NOT NULL THEN 'Paciente'
        WHEN a.IdUsuario IS NOT NULL THEN 'Acompañante'
        WHEN ad.IdUsuario IS NOT NULL THEN 'Administrador'
        ELSE 'Sin rol definido'
    END AS TipoUsuarioDetallado,
    -- Datos específicos según rol
    d.Cedula AS CedulaDoctor,
    d.Especialidad,
    d.DireccionClinica,
    p.NSS AS NSSPaciente,
    p.TipoSangre,
    p.Peso,
    p.Altura,
    a.FechaAsignacion AS FechaAsignacionAcompanante,
    a.IdPacienteAsociado,
    ad.NivelPermiso,
    ad.AreaResponsabilidad
FROM
    USUARIOS u
    LEFT JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
    LEFT JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
    LEFT JOIN ACOMPANANTES a ON u.IdUsuario = a.IdUsuario
    LEFT JOIN ADMINISTRADORES ad ON u.IdUsuario = ad.IdUsuario
WHERE
    u.deleted_at IS NULL;

-- ============================================
-- INSERCIÓN DE PRUEBA 1: DOCTOR
-- ============================================
DO $$
DECLARE
    new_user_id INT;
    pdf_simulado TEXT := 'data:application/pdf;base64,JVBERi0xLjQKJ...[CONTENIDO_LARGO_AQUÍ]...';
BEGIN
    -- 1. Insertamos el usuario con los nuevos campos
    INSERT INTO USUARIOS (
        Nombre, 
        ApPaterno, 
        ApMaterno, 
        Correo, 
        Contrasenia, 
        Rol, 
        Telefono, 
        PinVerificado,
        FechaNacimiento,
        CURP,
        Genero,
        Domicilio,
        CodigoPostal,
        Localidad,
        Municipio,
        Estado
    )
    VALUES (
        'Luis', 
        'García', 
        'Mendoza', 
        'doctor.luis@htas.com', 
        crypt('Pass1234', gen_salt('bf')), 
        'Doctor', 
        2721234567, 
        true,
        '1985-03-15',                    -- Fecha de nacimiento
        'GAML850315HVZRRL01',            -- CURP ejemplo
        'Masculino',                     -- Género
        'Calle Benito Juárez #123 Col. Centro', -- Domicilio
        '94500',                         -- Código Postal
        'Córdoba',                       -- Localidad
        'Córdoba',                       -- Municipio
        'Veracruz'                       -- Estado
    )
    RETURNING IdUsuario INTO new_user_id;

    -- 2. Insertamos los datos del doctor
    INSERT INTO DOCTORES (
        IdUsuario, 
        Cedula, 
        ArchivoCedulaPDF, 
        Especialidad, 
        DireccionClinica,
        TipoSangre,
        Peso,
        Altura,
        AntecedentesFamiliares
    )
    VALUES (
        new_user_id, 
        '7788990011',
        pdf_simulado,
        'Cardiología', 
        'Av. Reforma 405, Int 2',
        'O+',
        75.5,
        1.78,
        'Hipertensión en padres'
    );

    RAISE NOTICE 'Usuario Doctor insertado con ID: %', new_user_id;
END $$;

-- ============================================
-- INSERCIÓN DE PRUEBA 2: PACIENTE
-- ============================================
DO $$
DECLARE
    patient_id INT;
BEGIN
    INSERT INTO USUARIOS (
        Nombre, 
        ApPaterno, 
        ApMaterno, 
        Correo, 
        Contrasenia, 
        Rol, 
        Telefono,
        FechaNacimiento,
        CURP,
        Genero,
        Domicilio,
        CodigoPostal,
        Localidad,
        Municipio,
        Estado
    )
    VALUES (
        'María', 
        'López', 
        'González', 
        'paciente.maria@htas.com', 
        crypt('Pac123', gen_salt('bf')), 
        'Paciente', 
        2729876543,
        '1990-07-22',
        'LOGM900722HVZPLR02',
        'Femenino',
        'Calle Hidalgo #45 Fracc. Las Flores',
        '94550',
        'Yanga',
        'Yanga',
        'Veracruz'
    )
    RETURNING IdUsuario INTO patient_id;

    -- Insertar datos del paciente
    INSERT INTO PACIENTES (
        IdUsuario,
        NSS,
        TipoSangre,
        Peso,
        Altura,
        AntecedentesFamiliares
    )
    VALUES (
        patient_id,
        '12345678901',
        'A+',
        65.5,
        1.62,
        'Diabetes tipo 2 en padres'
    );

    RAISE NOTICE 'Paciente insertado con ID: %', patient_id;
END $$;

-- ============================================
-- INSERCIÓN DE PRUEBA 3: ACOMPAÑANTE
-- ============================================
DO $$
DECLARE
    companion_id INT;
    patient_id INT;
BEGIN
    -- Obtener el ID del paciente creado anteriormente
    SELECT IdUsuario INTO patient_id 
    FROM USUARIOS 
    WHERE Correo = 'paciente.maria@htas.com' 
    LIMIT 1;
    
    -- Insertar acompañante
    INSERT INTO USUARIOS (
        Nombre, 
        ApPaterno, 
        ApMaterno, 
        Correo, 
        Contrasenia, 
        Rol, 
        Telefono,
        FechaNacimiento,
        CURP,
        Genero,
        Domicilio,
        CodigoPostal,
        Localidad,
        Municipio,
        Estado
    )
    VALUES (
        'Carlos', 
        'López', 
        'González', 
        'acomp.carlos@htas.com', 
        crypt('Acomp123', gen_salt('bf')), 
        'Acompañante', 
        2725551234,
        '1988-11-05',
        'LOGC881105HVZPLR03',
        'Masculino',
        'Calle Hidalgo #45 Fracc. Las Flores',
        '94550',
        'Yanga',
        'Yanga',
        'Veracruz'
    )
    RETURNING IdUsuario INTO companion_id;

    -- Insertar datos del acompañante
    INSERT INTO ACOMPANANTES (
        IdUsuario,
        FechaAsignacion,
        IdPacienteAsociado
    )
    VALUES (
        companion_id,
        CURRENT_DATE,
        patient_id
    );

    RAISE NOTICE 'Acompañante insertado con ID: %', companion_id;
END $$;

-- ============================================
-- CONSULTAS DE PRUEBA
-- ============================================

-- 1. Ver todos los usuarios con su edad calculada
SELECT
    IdUsuario,
    Nombre,
    ApPaterno,
    ApMaterno,
    FechaNacimiento,
    calcular_edad (FechaNacimiento) AS Edad,
    CURP,
    Genero,
    Domicilio,
    Localidad,
    Municipio,
    Estado,
    CodigoPostal,
    Correo,
    Telefono,
    Rol
FROM USUARIOS
WHERE
    deleted_at IS NULL
ORDER BY IdUsuario;

-- 2. Ver la vista completa con todos los detalles
SELECT * FROM VW_USUARIOS_COMPLETO;

-- 3. Ver solo doctores con su información completa
SELECT
    u.IdUsuario,
    u.Nombre,
    u.ApPaterno,
    u.ApMaterno,
    u.Correo,
    u.Telefono,
    u.FechaNacimiento,
    calcular_edad (u.FechaNacimiento) AS Edad,
    u.CURP,
    u.Genero,
    u.Domicilio,
    u.Localidad,
    u.Municipio,
    u.Estado,
    u.CodigoPostal,
    d.Cedula,
    d.Especialidad,
    d.DireccionClinica,
    d.TipoSangre,
    d.Peso,
    d.Altura
FROM USUARIOS u
    INNER JOIN DOCTORES d ON u.IdUsuario = d.IdUsuario
WHERE
    u.deleted_at IS NULL;

-- 4. Ver solo pacientes con su información completa
SELECT
    u.IdUsuario,
    u.Nombre,
    u.ApPaterno,
    u.ApMaterno,
    u.Correo,
    u.Telefono,
    u.FechaNacimiento,
    calcular_edad (u.FechaNacimiento) AS Edad,
    u.CURP,
    u.Genero,
    u.Domicilio,
    u.Localidad,
    u.Municipio,
    u.Estado,
    u.CodigoPostal,
    p.NSS,
    p.TipoSangre,
    p.Peso,
    p.Altura
FROM USUARIOS u
    INNER JOIN PACIENTES p ON u.IdUsuario = p.IdUsuario
WHERE
    u.deleted_at IS NULL;

-- ============================================
-- TRIGGER PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas que tienen updated_at
CREATE TRIGGER update_usuarios_updated_at 
    BEFORE UPDATE ON USUARIOS 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctores_updated_at 
    BEFORE UPDATE ON DOCTORES 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pacientes_updated_at 
    BEFORE UPDATE ON PACIENTES 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_acompanantes_updated_at 
    BEFORE UPDATE ON ACOMPANANTES 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_administradores_updated_at 
    BEFORE UPDATE ON ADMINISTRADORES 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_citas_updated_at 
    BEFORE UPDATE ON CITAS 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tratamientos_updated_at 
    BEFORE UPDATE ON TRATAMIENTOS 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dispositivos_updated_at 
    BEFORE UPDATE ON DISPOSITIVOS 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================