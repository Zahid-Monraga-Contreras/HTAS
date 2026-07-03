
-- Habilitar extensión para seguridad de contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLA NÚCLEO: USUARIOS
CREATE TABLE USUARIOS (
    IdUsuario SERIAL PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL,
    ApPaterno VARCHAR(50) NOT NULL,
    ApMaterno VARCHAR(50),
    Correo VARCHAR(60) UNIQUE NOT NULL,
    Contrasenia TEXT NOT NULL, 
    Telefono BIGINT,
	Genero VARCHAR(20) CHECK (Genero IN ('Masculino', 'Femenino', 'Otro', 'No especificado')),
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

ALTER TABLE USUARIOS ADD COLUMN GoogleFitToken JSONB;

SELECT*FROM USUARIOS;

-- 2. TABLA: DOCTORES
CREATE TABLE DOCTORES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS(IdUsuario) ON DELETE CASCADE,
    Cedula VARCHAR(20) UNIQUE NOT NULL,
	ArchivoCedulaPDF TEXT NOT NULL,
    Especialidad VARCHAR(60) NOT NULL,
    DireccionClinica VARCHAR(100),
    TipoSangre VARCHAR(5) CHECK (TipoSangre IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    Peso NUMERIC(5,2), -- En kg (ejemplo: 78.50)
    Altura NUMERIC(3,2), -- En metros (ejemplo: 1.75)
    AntecedentesFamiliares TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: PACIENTES
CREATE TABLE PACIENTES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS(IdUsuario) ON DELETE CASCADE,
    NSS VARCHAR(11) UNIQUE, -- Número de Seguridad Social,
    TipoSangre VARCHAR(5) CHECK (TipoSangre IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    Peso NUMERIC(5,2), -- En kg (ejemplo: 78.50)
    Altura NUMERIC(3,2), -- En metros (ejemplo: 1.75)
    AntecedentesFamiliares TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: ACOMPANANTES
CREATE TABLE ACOMPANANTES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS(IdUsuario) ON DELETE CASCADE,
	FechaNacimiento DATE NOT NULL,
    FechaAsignacion DATE NOT NULL,
    IdPacienteAsociado INT REFERENCES PACIENTES(IdUsuario) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ACOMPANANTES ALTER COLUMN FechaAsignacion DROP NOT NULL;

-- 5. TABLA: ADMINISTRADORES
CREATE TABLE ADMINISTRADORES (
    IdUsuario INT PRIMARY KEY REFERENCES USUARIOS(IdUsuario) ON DELETE CASCADE,
    NivelPermiso VARCHAR(20) DEFAULT 'Soporte' 
        CHECK (NivelPermiso IN ('SuperAdmin', 'Soporte', 'Moderador')),
    AreaResponsabilidad VARCHAR(50) DEFAULT 'General', -- Ej: 'Sistemas', 'Atención Médica', 'Auditoría'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA: SESIONES (Soporte Multisesión)
CREATE TABLE SESIONES (
    IdSesion SERIAL PRIMARY KEY,
    IdUsuario INT NOT NULL REFERENCES USUARIOS(IdUsuario) ON DELETE CASCADE,
    RefreshToken TEXT UNIQUE NOT NULL, -- Token para refrescar la sesión
    DispositivoInfo TEXT,              -- Ej: "App Android", "Navegador Chrome"
    IpAddress VARCHAR(45),
    FechaExpiracion TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CITAS (
    IdCita SERIAL PRIMARY KEY,
    
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
    
    Estado VARCHAR(20) DEFAULT 'Programada' 
        CHECK (Estado IN ('Programada', 'Confirmada', 'Completada', 'Cancelada', 'No Asistió')),
    
    Modalidad VARCHAR(15) DEFAULT 'Presencial' 
        CHECK (Modalidad IN ('Presencial', 'Virtual')),
    
    NotasDoctor TEXT,
    
    -- Auditoría
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE REGISTRO_TOMAS (
    IdTomar SERIAL PRIMARY KEY,
    IdTratamiento INT NOT NULL REFERENCES TRATAMIENTOS(IdTratamiento) ON DELETE CASCADE,
    IdAcompananteQueRegistro INT REFERENCES ACOMPANANTES(IdUsuario) ON DELETE SET NULL, -- Por si un acompañante le dio la toma
    
    FechaHoraProgramada TIMESTAMP NOT NULL, -- Cuándo le tocaba según el horario
    FechaHoraRealizada TIMESTAMP,          -- Cuándo se la tomó realmente (NULL si no se la ha tomado)
    
    EstadoTomar VARCHAR(20) DEFAULT 'Pendiente'
        CHECK (EstadoTomar IN ('Pendiente', 'Tomada', 'Omitida', 'Retrasada')),
        
    NotasTomas TEXT, -- Ej: "Sintió náuseas después de tomarla"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE DISPOSITIVOS (
    IdDispositivo SERIAL PRIMARY KEY,
    Nombre VARCHAR(50) NOT NULL,              -- Ej: "Xiaomi Smart Band 8", "Fitbit Charge"
    DireccionMac MACADDR UNIQUE NOT NULL,      -- Valida y almacena la MAC Address de forma nativa
    UltimaSincronizacion TIMESTAMP DEFAULT NULL,
    Activo BOOLEAN DEFAULT TRUE,
    
    -- "Asignado a:" -> Relación directa con el Paciente
    IdPacienteAsociado INT REFERENCES PACIENTES(IdUsuario) ON DELETE SET NULL,
    
    -- Auditoría básica
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE DISPOSITIVOS 
ALTER COLUMN DireccionMac TYPE VARCHAR(50) USING DireccionMac::text;

-- 7. TABLA: MEDICIONES_PRESION (Lecturas del Tensiómetro)
CREATE TABLE MEDICIONES_PRESION (
    IdMedicion SERIAL PRIMARY KEY,
    IdPaciente INT NOT NULL REFERENCES PACIENTES(IdUsuario) ON DELETE CASCADE,
    
    -- Valores del Tensiómetro (Basados en la imagen del Femmto)
    Sistolica INT NOT NULL CHECK (Sistolica BETWEEN 40 AND 260),  -- SYS mmHg (Ej: 103)
    Diastolica INT NOT NULL CHECK (Diastolica BETWEEN 30 AND 200), -- DIA mmHg (Ej: 60)
    Pulso INT NOT NULL CHECK (Pulso BETWEEN 30 AND 220),           -- PULSE /min (Ej: 68)
    
    -- Información de contexto
    Unidad VARCHAR(10) DEFAULT 'mmHg',
    MetodoSincronizacion VARCHAR(20) DEFAULT 'Bluetooth' 
        CHECK (MetodoSincronizacion IN ('Bluetooth', 'Manual')),
    
    -- Auditoría de tiempo
    FechaHoraLectura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Momento en que se registró
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para mejorar la velocidad de búsqueda por fecha (muy útil para calendarios)
CREATE INDEX idx_citas_fecha ON CITAS(FechaCita);

---
--- EJEMPLO DE INSERCIÓN PARA PRUEBAS DE LOGIN
---

DO $$
DECLARE
    new_user_id INT;
    -- Simulamos un Base64 de un PDF (JVBERi... es el inicio estándar de un PDF)
    pdf_simulado TEXT := 'data:application/pdf;base64,JVBERi0xLjQKJ...[CONTENIDO_LARGO_AQUÍ]...';
BEGIN
    -- 1. Insertamos el usuario
    INSERT INTO USUARIOS (Nombre, ApPaterno, ApMaterno, Correo, Contrasenia, Rol, Telefono, PinVerificado)
    VALUES ('Luis', 'García', 'Mendoza', 'doctor.luis@htas.com', crypt('Pass1234', gen_salt('bf')), 'Doctor', 2721234567, true)
    RETURNING IdUsuario INTO new_user_id;

    -- 2. Insertamos los datos del doctor incluyendo el PDF
    -- IMPORTANTE: Asegúrate de que los nombres de las columnas coincidan con tu tabla
    INSERT INTO DOCTORES (IdUsuario, Cedula, ArchivoCedulaPDF, Especialidad, DireccionClinica)
    VALUES (
        new_user_id, 
        '7788990011',      -- El número de cédula
        pdf_simulado,      -- El contenido del archivo PDF en Base64
        'Cardiología', 
        'Av. Reforma 405, Int 2'
    );

    RAISE NOTICE 'Usuario Doctor insertado con ID: %', new_user_id;
END $$;

-- HTAS