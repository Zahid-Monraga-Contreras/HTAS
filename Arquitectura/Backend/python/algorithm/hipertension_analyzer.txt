# ==============================================================================
#                      SISTEMA TECNOLOGICO PREDICTIVO "HTAS-MEXICO"
# ==============================================================================
# NOMBRE DEL SOFTWARE: Aun por definir el nombre del modulo
#                      
# CLASIFICACION INDAUTOR: Programa de Computacion (Software de Aplicacion Medica).
# AUTORIA Y TITULARIDAD: UTCV
# Garcia Peralta Fatima
# Monraga Contreras Zahid
# Radilla Partida Eleonor Guadalupe
# Suarez Rodriguez Saul
# Castro Valdivia Ricardo
# VERSION DE COMPILACION: 3.3.0 (Edicion con Almacenamiento Persistente de PDFs y PostgreSQL)
#
# DESCRIPCION GENERAL:
# Este sistema representa una suite integrada de software orientada al sector salud.
# Implementa un pipeline predictivo de aprendizaje automatico (Machine Learning) basado
# en la competencia directa y simultanea de tres paradigmas matematicos:
#   1. Regresion Logistica (Ajuste lineal optimizado por funcion sigmoide).
#   2. Random Forest (Ensamble jerarquico no lineal basado en Bagging).
#   3. XGBoost (Ensamble secuencial basado en Gradient Boosting con regularizacion).
#
# MEJORA V3.3.0: Implementa almacenamiento persistente de PDFs en el sistema de
# archivos, guardando los archivos en la carpeta uploads/pdfs/ con nombres
# estructurados y manteniendo las rutas en la base de datos PostgreSQL para su recuperacion.
# ==============================================================================

import os
import io
import re
import base64
import logging
import sys
import json
import pickle
from datetime import datetime, date
from typing import Dict, Any, Optional, Tuple, List
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field, field_validator

# Dependencias Cientificas y Algoritmicas de Inteligencia Artificial
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

# Dependencia de Terceros para Procesamiento de Flujos Binarios PDF
import pypdf

# Framework de Conectividad y Publicacion de Endpoints REST
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ==============================================================================
# POSTGRESQL - REEMPLAZO DE SQLITE
# ==============================================================================
import psycopg2
from psycopg2.extras import RealDictCursor

# ==============================================================================
# CARGA DE VARIABLES DE ENTORNO DESDE .env
# ==============================================================================
try:
    from dotenv import load_dotenv
    
    # Obtener la ruta base del proyecto (raiz)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Buscar el .env en la raiz del proyecto (Backend)
    env_path = os.path.join(BASE_DIR, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"[INIT] Variables de entorno cargadas desde: {env_path}")
    else:
        load_dotenv()
        print("[INIT] Usando variables de entorno del sistema.")
except ImportError:
    print("[INIT] python-dotenv no instalado. Usando variables de entorno del sistema.")

# ==============================================================================
# CONFIGURACION DE RUTAS - ADAPTADO A TU ESTRUCTURA
# ==============================================================================

# Obtener la ruta base del proyecto (raiz)
# El script esta en: python/algorithm/hipertension_analyzer.py
# Subimos 2 niveles para llegar a la raiz del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Ruta de almacenamiento de PDFs
PDF_STORAGE_PATH = os.path.join(BASE_DIR, 'uploads', 'pdfs')

# Ruta del CSV de entrenamiento (en la raiz del proyecto)
CSV_NAME = os.path.join(BASE_DIR, 'python', 'algorithm', 'Hipertension_Arterial_Mexico.csv')

# Crear directorio de PDFs si no existe
os.makedirs(PDF_STORAGE_PATH, exist_ok=True)

# ==============================================================================
# CONFIGURACION DE POSTGRESQL - CON TUS VARIABLES
# ==============================================================================

# Configuracion de la base de datos PostgreSQL
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', 5432),
    'database': os.environ.get('DB_NAME', 'BD_HTAS'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'zmc001139')
}

def get_db_connection():
    """Establece una conexion directa con PostgreSQL."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.critical(f"[POSTGRES_CONN] Error critico de conexion a PostgreSQL: {str(e)}")
        raise DatabaseConnectionException(f"No se pudo conectar a la base de datos PostgreSQL: {str(e)}")

# ==============================================================================
# SUB-SISTEMA DE CONFIGURACION DEL ENGINE DE LOGS
# ==============================================================================
FORMATO_LOGS = "%(asctime)s [%(levelname)s] [PROCESO: %(name)s] -> %(message)s"
logging.basicConfig(
    level=logging.INFO,
    format=FORMATO_LOGS,
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("HTAS_MEXICO_CORE")

logger.info(f"[INIT] Base del proyecto: {BASE_DIR}")
logger.info(f"[INIT] PDFs se guardaran en: {PDF_STORAGE_PATH}")
logger.info(f"[INIT] Base de datos: PostgreSQL - {DB_CONFIG['database']}")
logger.info(f"[INIT] CSV de entrenamiento: {CSV_NAME}")

# ==============================================================================
# CAPITULO I: CAPA DE GESTION DE EXCEPCIONES PERSONALIZADAS
# ==============================================================================
class HTASException(Exception):
    """Clase base para el control de anomalias dentro de la suite HTAS-Mexico."""
    def __init__(self, mensaje: str, codigo_error: str):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo_error = codigo_error


class PDFParsingException(HTASException):
    """Excepcion arrojada cuando el procesamiento binario o la decodificacion Base64 de un PDF falla."""
    def __init__(self, mensaje: str):
        super().__init__(mensaje, "ERR_PDF_PARSING_FAILED")


class SemanticValidationException(HTASException):
    """Excepcion arrojada cuando los PDFs no contienen los tokens o patrones de validacion esperados."""
    def __init__(self, mensaje: str):
        super().__init__(mensaje, "ERR_SEMANTIC_VALIDATION_FAILED")


class DatabaseConnectionException(HTASException):
    """Excepcion arrojada ante fallas de escritura, lectura o integridad referencial en PostgreSQL."""
    def __init__(self, mensaje: str):
        super().__init__(mensaje, "ERR_DATABASE_TRANSACTION_FAILED")


class MLModelException(HTASException):
    """Excepcion arrojada ante inconsistencias en el entrenamiento o inferencia matematica de los modelos."""
    def __init__(self, mensaje: str):
        super().__init__(mensaje, "ERR_ML_CORE_CRITICAL")


# ==============================================================================
# CAPITULO II: GESTOR DE ALMACENAMIENTO DE PDFs
# ==============================================================================

class GestorAlmacenamientoPDF:
    """
    Maneja el almacenamiento persistente de archivos PDF en el sistema de archivos.
    Guarda los PDFs en la carpeta uploads/pdfs/ con nombres estructurados.
    """
    
    @staticmethod
    def guardar_pdf(base64_data: str, folio_expediente: int, tipo: str) -> Dict[str, Any]:
        """
        Guarda un PDF en el sistema de archivos
        
        Args:
            base64_data: Datos del PDF en Base64
            folio_expediente: Numero de folio del expediente
            tipo: 'cedula' o 'diagnostico'
        
        Returns:
            Dict con estado de la operacion
        """
        try:
            # Limpiar cabecera si existe
            if "," in base64_data:
                base64_data = base64_data.split(",")[1]
            
            # Decodificar Base64 a bytes
            pdf_bytes = base64.b64decode(base64_data)
            
            # Crear nombre de archivo
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            nombre_archivo = f"folio_{folio_expediente}_{tipo}_{timestamp}.pdf"
            ruta_completa = os.path.join(PDF_STORAGE_PATH, nombre_archivo)
            
            # Guardar archivo
            with open(ruta_completa, 'wb') as f:
                f.write(pdf_bytes)
            
            logger.info(f"[PDF_STORAGE] PDF guardado: {ruta_completa}")
            logger.info(f"[PDF_STORAGE] Tamanio: {len(pdf_bytes)} bytes")
            
            return {
                "exito": True,
                "ruta": ruta_completa,
                "nombre": nombre_archivo,
                "tamano_bytes": len(pdf_bytes),
                "tamano_mb": round(len(pdf_bytes) / (1024 * 1024), 2)
            }
            
        except Exception as e:
            logger.error(f"[PDF_STORAGE] Error guardando PDF: {str(e)}")
            return {
                "exito": False,
                "error": str(e)
            }

    @staticmethod
    def obtener_pdf(folio_expediente: int, tipo: str) -> Optional[str]:
        """
        Obtiene la ruta del PDF mas reciente de un tipo especifico
        
        Args:
            folio_expediente: Numero de folio del expediente
            tipo: 'cedula' o 'diagnostico'
        
        Returns:
            Ruta del archivo o None si no existe
        """
        try:
            patron = f"folio_{folio_expediente}_{tipo}_"
            archivos = []
            
            for archivo in os.listdir(PDF_STORAGE_PATH):
                if archivo.startswith(patron) and archivo.endswith('.pdf'):
                    archivos.append(os.path.join(PDF_STORAGE_PATH, archivo))
            
            if archivos:
                # Devolver el mas reciente (por nombre de archivo que incluye timestamp)
                archivos.sort(reverse=True)
                return archivos[0]
            
            return None
            
        except Exception as e:
            logger.error(f"[PDF_STORAGE] Error obteniendo PDF: {str(e)}")
            return None

    @staticmethod
    def obtener_pdf_como_base64(folio_expediente: int, tipo: str) -> Optional[str]:
        """
        Obtiene un PDF como string Base64
        
        Args:
            folio_expediente: Numero de folio del expediente
            tipo: 'cedula' o 'diagnostico'
        
        Returns:
            String Base64 del PDF o None
        """
        ruta = GestorAlmacenamientoPDF.obtener_pdf(folio_expediente, tipo)
        if ruta and os.path.exists(ruta):
            try:
                with open(ruta, 'rb') as f:
                    return base64.b64encode(f.read()).decode('utf-8')
            except Exception as e:
                logger.error(f"[PDF_STORAGE] Error leyendo PDF: {str(e)}")
                return None
        return None


# ==============================================================================
# CAPITULO III: MOTOR DE BASE DE DATOS POSTGRESQL - CORREGIDO
# ==============================================================================
class GestorBaseDatosRelacional:
    """
    Abstrae y controla toda la interaccion con el motor de base de datos PostgreSQL.
    Aplica principios ACID (Atomicidad, Consistencia, Aislamiento y Durabilidad)
    mediante un esquema estructurado de tablas con llaves foraneas.
    """
    
    @staticmethod
    def conectar() -> psycopg2.extensions.connection:
        """Establece una conexion directa con PostgreSQL."""
        try:
            return get_db_connection()
        except Exception as e:
            logger.critical(f"[POSTGRES_CONN] Error critico de conexion: {str(e)}")
            raise DatabaseConnectionException(f"No se pudo conectar a la base de datos: {str(e)}")

    @classmethod
    def inicializar_esquema(cls):
        """
        Crea las tablas de la base de datos aplicando restricciones de integridad.
        Tabla 1: 'medicos' (Catalogo de medicos con registro validado).
        Tabla 2: 'expedientes_htas' (Registros clinicos vinculados al paciente y medico).
        """
        logger.info("[DB_INIT] Iniciando la creacion fisica del esquema relacional en PostgreSQL...")
        conn = cls.conectar()
        cursor = conn.cursor()
        
        try:
            # Creacion de Tabla de Medicos Validada
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS medicos (
                    cedula TEXT PRIMARY KEY,
                    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    estatus_activo INTEGER NOT NULL DEFAULT 1,
                    token_autenticacion_pdf TEXT
                );
            """)
            
            # Creacion de Tabla de Expedientes Clinicos - CORREGIDA con EXPEDIENTES_HTAS
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS expedientes_htas (
                    idexpediente SERIAL PRIMARY KEY,
                    idpaciente INTEGER NOT NULL,
                    iddoctor INTEGER,
                    fecha_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    edad INTEGER NOT NULL,
                    sistolica INTEGER NOT NULL,
                    diastolica INTEGER NOT NULL,
                    presion_pdf_sistolica INTEGER,
                    presion_pdf_diastolica INTEGER,
                    toma_medicamento INTEGER NOT NULL DEFAULT 0,
                    prediccion_crisis INTEGER NOT NULL,
                    probabilidad_porcentual REAL NOT NULL,
                    nivel_riesgo TEXT NOT NULL,
                    motor_utilizado TEXT NOT NULL,
                    pdf_cedula_valido BOOLEAN DEFAULT FALSE,
                    pdf_diagnostico_valido BOOLEAN DEFAULT FALSE,
                    valores_extraidos_pdf TEXT,
                    ruta_pdf_cedula TEXT,
                    ruta_pdf_diagnostico TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            conn.commit()
            logger.info("[DB_INIT] Esquema relacional de doble tabla creado e instanciado exitosamente en PostgreSQL.")
        except Exception as e:
            conn.rollback()
            logger.error(f"[DB_INIT] Error durante la construccion de tablas: {str(e)}")
            raise DatabaseConnectionException(f"Fallo de inicializacion DDL: {str(e)}")
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def registrar_o_actualizar_medico(cls, cedula: str, texto_cedula_token: str):
        """Registra un medico en el catalogo o actualiza su estado si ya existia."""
        conn = cls.conectar()
        cursor = conn.cursor()
        try:
            token_muestra = texto_cedula_token[:200].replace("\n", " ")
            
            cursor.execute("""
                INSERT INTO medicos (cedula, estatus_activo, token_autenticacion_pdf)
                VALUES (%s, 1, %s)
                ON CONFLICT (cedula) DO UPDATE SET
                    fecha_registro = CURRENT_TIMESTAMP,
                    token_autenticacion_pdf = EXCLUDED.token_autenticacion_pdf;
            """, (cedula, token_muestra))
            conn.commit()
            logger.info(f"[DB_DAO] Medico con Cedula '{cedula}' persistido/actualizado en catalogo.")
        except Exception as e:
            conn.rollback()
            logger.error(f"[DB_DAO] Error al registrar medico '{cedula}': {str(e)}")
            raise DatabaseConnectionException(f"Fallo al insertar en catalogo medico: {str(e)}")
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def registrar_expediente_completo(cls, datos: Dict[str, Any]) -> int:
        """
        Inserta el registro de evaluacion clinica vinculandolo al paciente y medico.
        AHORA CON IdPaciente e IdDoctor
        """
        conn = cls.conectar()
        cursor = conn.cursor()
        try:
            query = """
                INSERT INTO expedientes_htas (
                    idpaciente,
                    iddoctor,
                    edad, 
                    sistolica, 
                    diastolica,
                    presion_pdf_sistolica, 
                    presion_pdf_diastolica,
                    toma_medicamento, 
                    prediccion_crisis, 
                    probabilidad_porcentual,
                    nivel_riesgo, 
                    motor_utilizado, 
                    pdf_cedula_valido,
                    pdf_diagnostico_valido, 
                    valores_extraidos_pdf,
                    ruta_pdf_cedula, 
                    ruta_pdf_diagnostico
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING idexpediente;
            """
            
            valores = (
                datos.get("id_paciente"),
                datos.get("id_doctor"),
                datos["edad"],
                datos["sistolica"],
                datos["diastolica"],
                datos.get("presion_pdf_sistolica"),
                datos.get("presion_pdf_diastolica"),
                datos["toma_medicamento"],
                datos["prediccion_crisis"],
                datos["probabilidad_porcentual"],
                datos["nivel_riesgo_clinico"],
                datos["motor_inferencia_usado"],
                1 if datos["cedula_pdf_valida"] else 0,
                1 if datos["diagnostico_pdf_valido"] else 0,
                datos.get("valores_extraidos_pdf", ""),
                datos.get("ruta_pdf_cedula", ""),
                datos.get("ruta_pdf_diagnostico", "")
            )
            
            cursor.execute(query, valores)
            nuevo_folio = cursor.fetchone()[0]
            conn.commit()
            logger.info(f"[DB_DAO] Expediente Clinico guardado con exito. Folio de registro: #{nuevo_folio}")
            return nuevo_folio
        except Exception as e:
            conn.rollback()
            logger.error(f"[DB_DAO] Error al guardar el expediente del paciente: {str(e)}")
            raise DatabaseConnectionException(f"Fallo de transaccion DML en tabla 'expedientes_htas': {str(e)}")
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def obtener_expediente_por_folio(cls, folio: int) -> Optional[Dict[str, Any]]:
        """Obtiene un expediente completo por su folio"""
        conn = cls.conectar()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT 
                    idexpediente as id,
                    fecha_consulta,
                    idpaciente,
                    iddoctor,
                    edad,
                    sistolica,
                    diastolica,
                    presion_pdf_sistolica,
                    presion_pdf_diastolica,
                    toma_medicamento,
                    prediccion_crisis,
                    probabilidad_porcentual,
                    nivel_riesgo,
                    motor_utilizado,
                    pdf_cedula_valido,
                    pdf_diagnostico_valido,
                    valores_extraidos_pdf,
                    ruta_pdf_cedula,
                    ruta_pdf_diagnostico
                FROM expedientes_htas
                WHERE idexpediente = %s
            """, (folio,))
            
            resultado = cursor.fetchone()
            if resultado:
                return dict(resultado)
            return None
            
        except Exception as e:
            logger.error(f"[DB_DAO] Error obteniendo expediente: {str(e)}")
            return None
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def obtener_ultimo_expediente_por_paciente(cls, id_paciente: int) -> Optional[Dict[str, Any]]:
        """Obtiene el ultimo expediente de un paciente por su ID"""
        conn = cls.conectar()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT 
                    idexpediente as id,
                    fecha_consulta,
                    idpaciente,
                    iddoctor,
                    edad,
                    sistolica,
                    diastolica,
                    presion_pdf_sistolica,
                    presion_pdf_diastolica,
                    toma_medicamento,
                    prediccion_crisis,
                    probabilidad_porcentual,
                    nivel_riesgo,
                    motor_utilizado,
                    pdf_cedula_valido,
                    pdf_diagnostico_valido,
                    valores_extraidos_pdf,
                    ruta_pdf_cedula,
                    ruta_pdf_diagnostico
                FROM expedientes_htas
                WHERE idpaciente = %s
                ORDER BY idexpediente DESC
                LIMIT 1
            """, (id_paciente,))
            
            resultado = cursor.fetchone()
            if resultado:
                return dict(resultado)
            return None
            
        except Exception as e:
            logger.error(f"[DB_DAO] Error obteniendo expediente: {str(e)}")
            return None
        finally:
            cursor.close()
            conn.close()

    @classmethod
    def obtener_ultimo_expediente_por_cedula(cls, cedula_medico: str) -> Optional[Dict[str, Any]]:
        """Obtiene el ultimo expediente de un medico por su cedula"""
        conn = cls.conectar()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("""
                SELECT 
                    idexpediente as id,
                    fecha_consulta,
                    idpaciente,
                    iddoctor,
                    edad,
                    sistolica,
                    diastolica,
                    presion_pdf_sistolica,
                    presion_pdf_diastolica,
                    toma_medicamento,
                    prediccion_crisis,
                    probabilidad_porcentual,
                    nivel_riesgo,
                    motor_utilizado,
                    pdf_cedula_valido,
                    pdf_diagnostico_valido,
                    valores_extraidos_pdf,
                    ruta_pdf_cedula,
                    ruta_pdf_diagnostico
                FROM expedientes_htas
                WHERE iddoctor IN (SELECT idusuario FROM doctores WHERE cedula = %s)
                ORDER BY idexpediente DESC
                LIMIT 1
            """, (cedula_medico,))
            
            resultado = cursor.fetchone()
            if resultado:
                return dict(resultado)
            return None
            
        except Exception as e:
            logger.error(f"[DB_DAO] Error obteniendo expediente: {str(e)}")
            return None
        finally:
            cursor.close()
            conn.close()


# ==============================================================================
# CAPITULO IV: ANALIZADOR DE DOCUMENTOS PDF (PARSING & EXTRACCION DE VALORES REALES)
# ==============================================================================
class ProcesadorDocumentosPDF:
    """
    Motor encargado de la ingesta, limpieza, parsing y analisis semantico
    de documentos medicos codificados en formato Base64.
    AHORA CON EXTRACCION REAL DE VALORES NUMERICOS DE PRESION ARTERIAL.
    """
    
    # ================================================================
    # PATRONES PARA EXTRACCION DE VALORES DE PRESION ARTERIAL
    # ================================================================
    PATRONES_PRESION = [
        r'presi[oó]n\s*arterial\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'presi[oó]n\s*arterial\s*[:=]\s*(\d{2,3})\s*[\/]\s*(\d{2,3})',
        r'presi[oó]n\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'tensi[oó]n\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'pa\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'presi[oó]n\s*arterial\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'tensi[oó]n\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'blood\s*pressure\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'bp\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'blood\s*pressure\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'bp\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'(\d{2,3})\s*[/-]\s*(\d{2,3})\s*mm?hg?',
        r'(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg|mm hg)',
        r'(\d{2,3})\s*\/\s*(\d{2,3})\s*mm',
        r'sist[oó]lica?\s*[:=]\s*(\d{2,3})\s*.*?diast[oó]lica?\s*[:=]\s*(\d{2,3})',
        r'sys\s*[:=]\s*(\d{2,3})\s*.*?dia\s*[:=]\s*(\d{2,3})',
        r'sistolica\s*(\d{2,3}).*?diastolica\s*(\d{2,3})',
        r'(\d{2,3})\s*\/\s*(\d{2,3})(?=\s*(?:mmhg|mm hg)?\s*(?:[^\d]|$))',
    ]
    
    PATRON_SISTOLICA = r'sist[oó]lica?\s*[:=]?\s*(\d{2,3})'
    PATRON_DIASTOLICA = r'diast[oó]lica?\s*[:=]?\s*(\d{2,3})'
    
    LEXICON_CEDULA = ["cedula", "profesional", "registro", "medico", "educacion", "sep", "direccion", "profesiones", "folio"]
    
    LEXICON_MEDICO = [
        "hipertension", "hipertenso", "sistolica", "diastolica", "presion arterial",
        "tension", "cardiaco", "diagnostico", "clinica", "tratamiento", "medico", "paciente",
        "hypertension", "blood pressure", "mmHg"
    ]

    @staticmethod
    def extraer_texto_de_base64(string_base64: str) -> str:
        logger.info("[PDF_PARSER] Decodificando secuencia Base64 entrante...")
        try:
            if "," in string_base64:
                string_base64 = string_base64.split(",")[1]
            
            pdf_bytes = base64.b64decode(string_base64)
            buffer_memoria = io.BytesIO(pdf_bytes)
            
            lector_pdf = pypdf.PdfReader(buffer_memoria)
            texto_acumulado = []
            
            for indice, pagina in enumerate(lector_pdf.pages):
                texto_extraido = pagina.extract_text()
                if texto_extraido:
                    texto_acumulado.append(texto_extraido)
            
            texto_unificado = "\n".join(texto_acumulado).strip()
            
            if not texto_unificado:
                logger.warning("[PDF_PARSER] Archivo PDF vacio o compuesto puramente por imagenes escaneadas.")
                raise PDFParsingException("El PDF esta vacio o requiere reconocimiento optico de caracteres (OCR).")
            
            logger.info(f"[PDF_PARSER] Procesamiento completado. Caracteres extraidos: {len(texto_unificado)}")
            return texto_unificado
        except Exception as e:
            logger.error(f"[PDF_PARSER] Error critico durante la decodificacion del PDF: {str(e)}")
            raise PDFParsingException(f"Error estructural en el archivo PDF binario: {str(e)}")

    @classmethod
    def extraer_valores_presion(cls, texto_pdf: str) -> Tuple[Optional[int], Optional[int], List[Dict]]:
        logger.info("[PDF_VAL] Extrayendo valores de presion arterial del texto...")
        
        if not texto_pdf:
            return None, None, []
        
        texto_normalizado = texto_pdf.lower()
        valores_encontrados = []
        
        for patron in cls.PATRONES_PRESION:
            coincidencias = re.findall(patron, texto_pdf, re.IGNORECASE)
            
            for coincidencia in coincidencias:
                try:
                    if isinstance(coincidencia, tuple):
                        if len(coincidencia) >= 2:
                            sistolica_str = re.sub(r'\D', '', str(coincidencia[0]))
                            diastolica_str = re.sub(r'\D', '', str(coincidencia[1]))
                            
                            if sistolica_str and diastolica_str:
                                sistolica = int(sistolica_str)
                                diastolica = int(diastolica_str)
                            else:
                                continue
                        else:
                            continue
                    else:
                        numeros = re.findall(r'\d+', str(coincidencia))
                        if len(numeros) >= 2:
                            sistolica = int(numeros[0])
                            diastolica = int(numeros[1])
                        else:
                            continue
                    
                    if 80 <= sistolica <= 250 and 40 <= diastolica <= 150:
                        valor = {
                            'sistolica': sistolica,
                            'diastolica': diastolica,
                            'patron': patron,
                            'tipo': 'completo'
                        }
                        if not any(v['sistolica'] == sistolica and v['diastolica'] == diastolica for v in valores_encontrados):
                            valores_encontrados.append(valor)
                            logger.info(f"[PDF_VAL] Valor encontrado: {sistolica}/{diastolica} mmHg")
                            
                except (ValueError, TypeError, IndexError) as e:
                    logger.warning(f"[PDF_VAL] Error procesando coincidencia: {e}")
                    continue

        sistolica_vals = re.findall(cls.PATRON_SISTOLICA, texto_pdf, re.IGNORECASE)
        diastolica_vals = re.findall(cls.PATRON_DIASTOLICA, texto_pdf, re.IGNORECASE)
        
        if sistolica_vals and diastolica_vals:
            try:
                sistolica = int(re.sub(r'\D', '', str(sistolica_vals[-1])))
                diastolica = int(re.sub(r'\D', '', str(diastolica_vals[-1])))
                
                if 80 <= sistolica <= 250 and 40 <= diastolica <= 150:
                    valor = {
                        'sistolica': sistolica,
                        'diastolica': diastolica,
                        'patron': 'separado (sistolica/diastolica)',
                        'tipo': 'separado'
                    }
                    if not any(v['sistolica'] == sistolica and v['diastolica'] == diastolica for v in valores_encontrados):
                        valores_encontrados.append(valor)
                        logger.info(f"[PDF_VAL] Valor encontrado (separado): {sistolica}/{diastolica} mmHg")
            except (ValueError, TypeError) as e:
                logger.warning(f"[PDF_VAL] Error procesando valores separados: {e}")

        patron_contexto = r'presi[oó]n\s*arterial\s*[:=]?\s*(\d{2,3})\s*(?:[\/\-])\s*(\d{2,3})'
        coincidencias_contexto = re.findall(patron_contexto, texto_pdf, re.IGNORECASE)
        
        for coincidencia in coincidencias_contexto:
            try:
                if isinstance(coincidencia, tuple) and len(coincidencia) >= 2:
                    sistolica = int(coincidencia[0])
                    diastolica = int(coincidencia[1])
                    
                    if 80 <= sistolica <= 250 and 40 <= diastolica <= 150:
                        valor = {
                            'sistolica': sistolica,
                            'diastolica': diastolica,
                            'patron': 'contexto_presion_arterial',
                            'tipo': 'contexto'
                        }
                        if not any(v['sistolica'] == sistolica and v['diastolica'] == diastolica for v in valores_encontrados):
                            valores_encontrados.append(valor)
                            logger.info(f"[PDF_VAL] Valor encontrado (contexto): {sistolica}/{diastolica} mmHg")
            except (ValueError, TypeError) as e:
                continue

        sistolica_final = None
        diastolica_final = None
        
        if valores_encontrados:
            ultimo_valor = valores_encontrados[-1]
            sistolica_final = ultimo_valor['sistolica']
            diastolica_final = ultimo_valor['diastolica']
            logger.info(f"[PDF_VAL] Ultimo valor de presion encontrado: {sistolica_final}/{diastolica_final} mmHg")
        
        if sistolica_final is None or diastolica_final is None:
            logger.warning("[PDF_VAL] No se encontraron valores de presion arterial en el documento.")
        else:
            logger.info(f"[PDF_VAL] Extraccion completada. Total de valores encontrados: {len(valores_encontrados)}")
        
        return sistolica_final, diastolica_final, valores_encontrados

    @classmethod
    def validar_documento_cedula(cls, pdf_base64: str, cedula_esperada: str) -> Tuple[bool, str]:
        logger.info(f"[PDF_VAL] Verificando legitimidad del PDF para la cedula: {cedula_esperada}")
        texto_pdf = cls.extraer_texto_de_base64(pdf_base64)
        texto_normalizado = texto_pdf.lower()
        
        cedula_limpia = cedula_esperada.strip()
        contiene_cedula_id = cedula_limpia in texto_normalizado or cedula_limpia.replace(" ", "") in texto_normalizado
        
        coincidencias = sum(1 for token in cls.LEXICON_CEDULA if token in texto_normalizado)
        
        if contiene_cedula_id and coincidencias >= 2:
            logger.info("[PDF_VAL] El documento contiene la firma semantica oficial de una Cedula Profesional.")
            return True, texto_pdf
            
        logger.warning(f"[PDF_VAL] Cedula Profesional invalida. No coincide con '{cedula_esperada}' o no es oficial.")
        return False, texto_pdf

    @classmethod
    def validar_documento_hipertension(cls, pdf_base64: str) -> Tuple[bool, str, Optional[int], Optional[int], List[Dict]]:
        logger.info("[PDF_VAL] Analizando diagnostico clinico de confirmacion de hipertension...")
        texto_pdf = cls.extraer_texto_de_base64(pdf_base64)
        texto_normalizado = texto_pdf.lower()
        
        coincidencias = sum(1 for token in cls.LEXICON_MEDICO if token in texto_normalizado)
        sistolica, diastolica, valores_encontrados = cls.extraer_valores_presion(texto_pdf)
        
        if coincidencias >= 3:
            logger.info(f"[PDF_VAL] Confirmacion diagnostica: {coincidencias} palabras clave encontradas.")
            
            if sistolica is not None and diastolica is not None:
                logger.info(f"[PDF_VAL] Valores de presion extraidos: {sistolica}/{diastolica} mmHg")
            else:
                logger.info("[PDF_VAL] Documento valido pero sin valores numericos de presion.")
            
            return True, texto_pdf, sistolica, diastolica, valores_encontrados
            
        logger.warning(f"[PDF_VAL] El expediente no cuenta con suficientes marcadores clinicos.")
        return False, texto_pdf, None, None, []


# ==============================================================================
# CAPITULO V: ARQUITECTURA PIPELINE DE MACHINE LEARNING COMPETITIVO (IA) - OPTIMIZADO
# ==============================================================================
class PipelineInteligenciaArtificial:
    def __init__(self, datos_entrada: pd.DataFrame = None):
        self.df = datos_entrada
        self.scaler = StandardScaler()
        self.modelo_logistic_regression = None
        self.modelo_random_forest = None
        self.modelo_xgboost = None
        self.mejor_modelo = None
        self.nombre_ganador = "Ninguno"
        self.variables_predictoras = ['Edad', 'Sistolica', 'Diastolica', 'Toma_Medicamento']
        self.variable_clase = 'Crisis_Hipertensiva'
        
        # Rutas para caché de modelos
        self.modelo_path = os.path.join(BASE_DIR, 'python', 'algorithm', 'modelo_htas.pkl')
        self.scaler_path = os.path.join(BASE_DIR, 'python', 'algorithm', 'scaler_htas.pkl')

    def guardar_modelo(self) -> bool:
        """Guarda el modelo entrenado en disco para carga rápida"""
        try:
            modelo_data = {
                'mejor_modelo': self.mejor_modelo,
                'nombre_ganador': self.nombre_ganador,
                'variables_predictoras': self.variables_predictoras
            }
            with open(self.modelo_path, 'wb') as f:
                pickle.dump(modelo_data, f)
            with open(self.scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            logger.info(f"[MODEL_CACHE] Modelo guardado en: {self.modelo_path}")
            return True
        except Exception as e:
            logger.warning(f"[MODEL_CACHE] No se pudo guardar modelo: {str(e)}")
            return False

    def cargar_modelo(self) -> bool:
        """Carga modelo desde disco si existe"""
        try:
            if os.path.exists(self.modelo_path) and os.path.exists(self.scaler_path):
                with open(self.modelo_path, 'rb') as f:
                    data = pickle.load(f)
                    self.mejor_modelo = data['mejor_modelo']
                    self.nombre_ganador = data['nombre_ganador']
                    self.variables_predictoras = data['variables_predictoras']
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                logger.info(f"[MODEL_CACHE] Modelo cargado: {self.nombre_ganador} (inicio rápido ⚡)")
                return True
        except Exception as e:
            logger.warning(f"[MODEL_CACHE] No se pudo cargar modelo guardado: {str(e)}")
        return False

    def ejecutar_entrenamiento_y_competencia(self) -> str:
        # 1. Intentar cargar modelo guardado (inicio rápido)
        if self.cargar_modelo():
            logger.info("[ML_CORE] Usando modelo guardado en caché (inicio rápido ⚡)")
            return self.nombre_ganador
        
        logger.info("[ML_CORE] Entrenando modelos desde cero (puede tomar unos segundos)...")
        
        X = self.df[self.variables_predictoras]
        y = self.df[self.variable_clase]
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Entrenar Regresión Logística (rápido)
        logger.info("[ML_CORE] Entrenando Regresion Logistica...")
        self.modelo_logistic_regression = LogisticRegression(
            class_weight='balanced', random_state=42, max_iter=300, C=1.0
        )
        self.modelo_logistic_regression.fit(X_train_scaled, y_train)
        preds_lr = self.modelo_logistic_regression.predict(X_test_scaled)
        acc_lr = accuracy_score(y_test, preds_lr)
        f1_lr = f1_score(y_test, preds_lr, zero_division=0)
        logger.info(f"[ML_METRICAS] Regresion Logistica -> Acc: {acc_lr:.4f} | F1: {f1_lr:.4f}")
        
        # Entrenar Random Forest (medio)
        logger.info("[ML_CORE] Entrenando Random Forest...")
        self.modelo_random_forest = RandomForestClassifier(
            n_estimators=100, max_depth=6, class_weight='balanced', 
            random_state=42, n_jobs=-1
        )
        self.modelo_random_forest.fit(X_train_scaled, y_train)
        preds_rf = self.modelo_random_forest.predict(X_test_scaled)
        acc_rf = accuracy_score(y_test, preds_rf)
        f1_rf = f1_score(y_test, preds_rf, zero_division=0)
        logger.info(f"[ML_METRICAS] Random Forest -> Acc: {acc_rf:.4f} | F1: {f1_rf:.4f}")
        
        # Entrenar XGBoost (optimizado y más rápido)
        logger.info("[ML_CORE] Entrenando XGBoost...")
        conteo_clases = np.bincount(y_train)
        ratio_balanceo = conteo_clases[0] / conteo_clases[1] if len(conteo_clases) > 1 else 1.0
        
        self.modelo_xgboost = XGBClassifier(
            n_estimators=50,      # Reducido de 150 para más velocidad
            max_depth=4,          # Reducido de 5
            scale_pos_weight=ratio_balanceo,
            eval_metric='logloss',
            random_state=42,
            n_jobs=-1,            # Usar todos los núcleos
            verbosity=0           # Sin logs de entrenamiento
        )
        self.modelo_xgboost.fit(X_train_scaled, y_train)
        preds_xgb = self.modelo_xgboost.predict(X_test_scaled)
        acc_xgb = accuracy_score(y_test, preds_xgb)
        f1_xgb = f1_score(y_test, preds_xgb, zero_division=0)
        logger.info(f"[ML_METRICAS] XGBoost -> Acc: {acc_xgb:.4f} | F1: {f1_xgb:.4f}")

        # Seleccionar ganador
        tabla_competencia = {
            "Regresion Logistica": (self.modelo_logistic_regression, f1_lr),
            "Random Forest": (self.modelo_random_forest, f1_rf),
            "XGBoost": (self.modelo_xgboost, f1_xgb)
        }
        
        self.nombre_ganador = max(tabla_competencia, key=lambda clave: tabla_competencia[clave][1])
        self.mejor_modelo = tabla_competencia[self.nombre_ganador][0]
        
        # Guardar modelo para futuros inicios
        self.guardar_modelo()
        
        logger.info("=====================================================================")
        logger.info(f"   ALGORITMO GANADOR PARA PRODUCCION: {self.nombre_ganador.upper()}")
        logger.info(f"   Metrica F1 lograda: {tabla_competencia[self.nombre_ganador][1]:.4%}")
        logger.info("=====================================================================")
        
        return self.nombre_ganador

    def inferencia_paciente(self, edad: int, sistolica: int, diastolica: int, medicamento: int) -> Dict[str, Any]:
        if self.mejor_modelo is None:
            logger.critical("[INFERENCIA] Se intento consultar el modelo sin haber entrenado los algoritmos.")
            raise MLModelException("El pipeline no se ha inicializado o entrenado correctamente.")

        vector_entrada = pd.DataFrame([[edad, sistolica, diastolica, medicamento]], columns=self.variables_predictoras)
        vector_escalado = self.scaler.transform(vector_entrada)

        probabilidades = self.mejor_modelo.predict_proba(vector_escalado)
        probabilidad_crisis = float(probabilidades[0][1])
        prediccion_binaria = int(self.mejor_modelo.predict(vector_escalado)[0])

        if prediccion_binaria == 1 or sistolica >= 180 or diastolica >= 120:
            riesgo = "CRITICO (URGENCIA HIPERTENSIVA)"
            protocolo = "Riesgo severo inminente. El paciente requiere traslado urgente a una clinica medica o administracion inmediata de farmacos de rescate."
            prediccion_binaria = 1
        elif sistolica >= 140 or diastolica >= 90:
            riesgo = "MODERADO (HIPERTENSION ESTADIO 2)"
            protocolo = "Estadio clinico elevado. Se aconseja reposar 15 minutos, re-evaluar la presion y concertar una cita medica en menos de 24 horas."
        else:
            riesgo = "ESTABLE / CONTROLADO"
            protocolo = "Presion arterial dentro de los limites esperados o bajo adecuado control farmacologico. Continuar con monitoreo preventivo."

        return {
            "prediccion_crisis": prediccion_binaria,
            "probabilidad_porcentual": round(probabilidad_crisis * 100, 2),
            "nivel_riesgo_clinico": riesgo,
            "protocolo_sugerido": protocolo,
            "motor_inferencia_usado": self.nombre_ganador
        }


# ==============================================================================
# CAPITULO VI: CAPA DE VALIDACION Y TRANSFERENCIA DE DATOS (PYDANTIC SCHEMAS)
# ==============================================================================
class SolicitudEvaluacionCompleta(BaseModel):
    edad: int = Field(..., ge=0, le=120, description="Edad del paciente evaluado")
    sistolica: int = Field(..., ge=40, le=260, description="Presion sistolica medida en mmHg")
    diastolica: int = Field(..., ge=30, le=180, description="Presion diastolica medida en mmHg")
    toma_medicamento: int = Field(..., ge=0, le=1, description="Indicador binario de adherencia farmacologica (1=Si, 0=No)")
    
    cedula_medico: str = Field(..., min_length=7, max_length=10, description="Numero identificador de la Cedula")
    cedula_pdf_base64: str = Field(..., description="Documento de Cedula Profesional en formato Base64")
    diagnostico_pdf_base64: str = Field(..., description="Expediente de confirmacion de hipertension en Base64")

    @field_validator('cedula_medico')
    @classmethod
    def normalizar_cedula(cls, valor: str) -> str:
        return valor.strip()


class RespuestaEvaluacionClinica(BaseModel):
    folio_expediente_db: int
    cedula_pdf_valida: bool
    diagnostico_pdf_valido: bool
    prediccion_crisis: int
    probabilidad_porcentual: float
    nivel_riesgo_clinico: str
    protocolo_sugerido: str
    motor_inferencia_usado: str
    mensaje_almacenamiento: str


# ==============================================================================
# CAPITULO VII: EXPOSICION DE SERVICIOS WEB Y ROUTING (FASTAPI CONTROLLER)
# ==============================================================================

# Custom JSON Encoder para manejar fechas
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(self, obj)


# Lifespan para manejar el startup de la aplicación
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global instancia_ia_global
    logger.info("=====================================================================")
    logger.info("   INICIALIZANDO MOTOR PRINCIPAL DE PERSISTENCIA E INTELIGENCIA ARTIFICIAL  ")
    logger.info("=====================================================================")
    
    try:
        GestorBaseDatosRelacional.inicializar_esquema()
        logger.info("[STARTUP] Esquema PostgreSQL inicializado correctamente.")
    except Exception as e:
        logger.error(f"[STARTUP] Error inicializando PostgreSQL: {str(e)}")
    
    try:
        if not os.path.exists(CSV_NAME):
            raise FileNotFoundError("El dataset historico de entrenamiento clinico no fue localizado.")
            
        logger.info(f"[STARTUP] Extrayendo variables de entrenamiento desde: {CSV_NAME}")
        df_historico = pd.read_csv(CSV_NAME, usecols=['Edad', 'Sistolica', 'Diastolica', 'Toma_Medicamento', 'Crisis_Hipertensiva']).dropna()
        
        instancia_ia_global = PipelineInteligenciaArtificial(datos_entrada=df_historico)
        instancia_ia_global.ejecutar_entrenamiento_y_competencia()
        logger.info("[STARTUP] Pipeline de competencia tri-algoritmica cargado y listo en produccion.")
        
    except Exception as e:
        logger.critical(f"[STARTUP_CRITICAL] No se pudo leer el CSV. Iniciando con matriz sintetica de contingencia: {str(e)}")
        
        datos_emergencia = pd.DataFrame([
            [55, 120, 80, 1, 0], [67, 185, 115, 0, 1],
            [40, 130, 85, 1, 0], [78, 190, 120, 0, 1],
            [35, 115, 75, 1, 0], [62, 175, 110, 0, 1],
            [48, 140, 90, 1, 0], [80, 200, 130, 0, 1],
            [50, 120, 80, 1, 0], [66, 180, 100, 0, 1]
        ], columns=['Edad', 'Sistolica', 'Diastolica', 'Toma_Medicamento', 'Crisis_Hipertensiva'])
        
        instancia_ia_global = PipelineInteligenciaArtificial(datos_entrada=datos_emergencia)
        instancia_ia_global.ejecutar_entrenamiento_y_competencia()
    
    yield  # Aquí se ejecuta la aplicación
    
    # Shutdown (si es necesario)


app = FastAPI(
    title="Core Predictivo Tri-Algoritmico Persistente - HTAS Mexico",
    description="Motor de Inferencia clinica con validacion sintactica de expedientes y catalogo relacional de medicos.",
    version="3.3.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

instancia_ia_global: Optional[PipelineInteligenciaArtificial] = None


# ==============================================================================
# FUNCION PARA OBTENER ULTIMO EXPEDIENTE DE UN PACIENTE - CORREGIDO
# ==============================================================================
def obtener_ultimo_expediente_paciente(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        id_paciente = payload.get('id_paciente')
        
        if not id_paciente:
            return {
                "exitoso": False,
                "error": "Se requiere el ID del paciente"
            }
        
        logger.info(f"[NODE] Obteniendo ultimo expediente para paciente: {id_paciente}")
        
        # Usar el nuevo método que filtra por id_paciente
        expediente = GestorBaseDatosRelacional.obtener_ultimo_expediente_por_paciente(id_paciente)
        
        if not expediente:
            return {
                "exitoso": True,
                "data": None,
                "mensaje": "El paciente no tiene expedientes"
            }
        
        # Obtener el PDF desde el sistema de archivos
        ruta_pdf = expediente.get('ruta_pdf_diagnostico')
        pdf_base64 = None
        
        if ruta_pdf and os.path.exists(ruta_pdf):
            try:
                with open(ruta_pdf, 'rb') as f:
                    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
            except Exception as e:
                logger.error(f"[NODE] Error leyendo PDF: {str(e)}")
        
        expediente['pdf_diagnostico_base64'] = pdf_base64
        expediente['folio'] = expediente.get('id')
        expediente['id_paciente'] = id_paciente
        expediente['tiene_pdf_diagnostico'] = pdf_base64 is not None
        expediente['tiene_pdf_cedula'] = expediente.get('ruta_pdf_cedula') is not None
        
        # Convertir fecha_consulta a string ISO para serialización JSON
        fecha_consulta = expediente.get('fecha_consulta')
        if fecha_consulta and isinstance(fecha_consulta, (datetime, date)):
            expediente['fecha_consulta'] = fecha_consulta.isoformat()
        
        return {
            "exitoso": True,
            "data": {
                "folio": expediente.get('id'),
                "fecha_consulta": expediente.get('fecha_consulta'),
                "id_paciente": id_paciente,
                "nombre_paciente": "Paciente",
                "ap_paterno_paciente": "",
                "ap_materno_paciente": "",
                "edad": expediente.get('edad'),
                "sistolica": expediente.get('sistolica'),
                "diastolica": expediente.get('diastolica'),
                "presion_pdf_sistolica": expediente.get('presion_pdf_sistolica'),
                "presion_pdf_diastolica": expediente.get('presion_pdf_diastolica'),
                "prediccion_crisis": expediente.get('prediccion_crisis'),
                "probabilidad_porcentual": expediente.get('probabilidad_porcentual'),
                "nivel_riesgo": expediente.get('nivel_riesgo'),
                "motor_utilizado": expediente.get('motor_utilizado'),
                "tiene_pdf_cedula": expediente.get('tiene_pdf_cedula', False),
                "tiene_pdf_diagnostico": expediente.get('tiene_pdf_diagnostico', False),
                "pdf_diagnostico_base64": pdf_base64,
                "ruta_pdf_cedula": expediente.get('ruta_pdf_cedula'),
                "ruta_pdf_diagnostico": expediente.get('ruta_pdf_diagnostico')
            }
        }
        
    except Exception as e:
        logger.error(f"[NODE] Error obteniendo expediente: {str(e)}")
        return {
            "exitoso": False,
            "error": str(e)
        }


def procesar_desde_json(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        accion = payload.get('accion')
        
        if accion == 'obtener_ultimo_expediente_paciente':
            return obtener_ultimo_expediente_paciente(payload)
        
        if accion == 'obtener_pdf_por_folio':
            folio = payload.get('folio')
            if not folio:
                return {
                    "exitoso": False,
                    "error": "Se requiere el folio del expediente"
                }
            
            pdf_cedula = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "cedula")
            pdf_diagnostico = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "diagnostico")
            
            return {
                "exitoso": True,
                "folio": folio,
                "tiene_pdf_cedula": pdf_cedula is not None,
                "tiene_pdf_diagnostico": pdf_diagnostico is not None,
                "pdf_cedula_base64": pdf_cedula,
                "pdf_diagnostico_base64": pdf_diagnostico
            }
        
        if accion == 'obtener_ultimo_analisis':
            cedula_medico = payload.get('cedula_medico')
            if not cedula_medico:
                return {
                    "exitoso": False,
                    "error": "Se requiere la cedula del medico"
                }
            
            expediente = GestorBaseDatosRelacional.obtener_ultimo_expediente_por_cedula(cedula_medico)
            if not expediente:
                return {
                    "exitoso": False,
                    "error": "No hay analisis para esta cedula"
                }
            
            folio = expediente.get('id')
            pdf_cedula = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "cedula")
            pdf_diagnostico = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "diagnostico")
            
            # Convertir fecha_consulta a string ISO para serialización JSON
            fecha_consulta = expediente.get('fecha_consulta')
            if fecha_consulta and isinstance(fecha_consulta, (datetime, date)):
                fecha_consulta = fecha_consulta.isoformat()
            
            return {
                "exitoso": True,
                "folio": folio,
                "fecha_consulta": fecha_consulta,
                "cedula_medico": cedula_medico,
                "edad": expediente.get('edad'),
                "sistolica": expediente.get('sistolica'),
                "diastolica": expediente.get('diastolica'),
                "presion_pdf_sistolica": expediente.get('presion_pdf_sistolica'),
                "presion_pdf_diastolica": expediente.get('presion_pdf_diastolica'),
                "prediccion_crisis": expediente.get('prediccion_crisis'),
                "probabilidad_porcentual": expediente.get('probabilidad_porcentual'),
                "nivel_riesgo": expediente.get('nivel_riesgo'),
                "motor_utilizado": expediente.get('motor_utilizado'),
                "pdf_cedula_valido": expediente.get('pdf_cedula_valido'),
                "pdf_diagnostico_valido": expediente.get('pdf_diagnostico_valido'),
                "tiene_pdf_cedula": pdf_cedula is not None,
                "tiene_pdf_diagnostico": pdf_diagnostico is not None,
                "pdf_cedula_base64": pdf_cedula,
                "pdf_diagnostico_base64": pdf_diagnostico
            }
        
        logger.info("[NODE] Procesando solicitud desde JSON...")
        
        id_paciente = payload.get('id_paciente')
        id_doctor = payload.get('id_doctor')
        edad = payload.get('edad')
        sistolica = payload.get('sistolica')
        diastolica = payload.get('diastolica')
        toma_medicamento = payload.get('toma_medicamento', 0)
        cedula_medico = payload.get('cedula_medico', '')
        cedula_pdf_base64 = payload.get('cedula_pdf_base64', '')
        diagnostico_pdf_base64 = payload.get('diagnostico_pdf_base64', '')
        
        if edad is None or sistolica is None or diastolica is None:
            return {
                "exitoso": False,
                "error": "Faltan datos requeridos: edad, sistolica, diastolica"
            }
        
        logger.info(f"[NODE] Datos recibidos - Edad: {edad}, Presion: {sistolica}/{diastolica}")
        
        pdf_diagnostico_valido = False
        texto_diagnostico = ""
        sistolica_pdf = None
        diastolica_pdf = None
        valores_pdf = []
        
        if diagnostico_pdf_base64:
            logger.info("[NODE] Validando PDF de diagnostico...")
            pdf_diagnostico_valido, texto_diagnostico, sistolica_pdf, diastolica_pdf, valores_pdf = \
                ProcesadorDocumentosPDF.validar_documento_hipertension(diagnostico_pdf_base64)
            logger.info(f"[NODE] PDF Diagnostico valido: {pdf_diagnostico_valido}")
        
        pdf_cedula_valido = False
        texto_cedula = ""
        
        if cedula_pdf_base64 and cedula_medico:
            logger.info("[NODE] Validando PDF de cedula...")
            pdf_cedula_valido, texto_cedula = ProcesadorDocumentosPDF.validar_documento_cedula(
                cedula_pdf_base64, cedula_medico
            )
            logger.info(f"[NODE] PDF Cedula valido: {pdf_cedula_valido}")
        
        sistolica_final = sistolica
        diastolica_final = diastolica
        
        if sistolica_pdf is not None and diastolica_pdf is not None:
            sistolica_final = sistolica_pdf
            diastolica_final = diastolica_pdf
            logger.info(f"[NODE] Usando valores del PDF: {sistolica_final}/{diastolica_final} mmHg")
        else:
            logger.info(f"[NODE] Usando valores del payload: {sistolica_final}/{diastolica_final} mmHg")
        
        global instancia_ia_global
        if instancia_ia_global:
            resultado_inferencia = instancia_ia_global.inferencia_paciente(
                edad=edad,
                sistolica=sistolica_final,
                diastolica=diastolica_final,
                medicamento=toma_medicamento
            )
        else:
            logger.warning("[NODE] Modelo no entrenado, usando reglas basicas")
            if sistolica_final >= 180 or diastolica_final >= 120:
                nivel_riesgo = "CRITICO (URGENCIA HIPERTENSIVA)"
                protocolo = "Riesgo severo inminente. El paciente requiere traslado urgente a una clinica medica o administracion inmediata de farmacos de rescate."
                prediccion = 1
                probabilidad = 95.0
            elif sistolica_final >= 140 or diastolica_final >= 90:
                nivel_riesgo = "MODERADO (HIPERTENSION ESTADIO 2)"
                protocolo = "Estadio clinico elevado. Se aconseja reposar 15 minutos, re-evaluar la presion y concertar una cita medica en menos de 24 horas."
                prediccion = 1
                probabilidad = 75.0
            else:
                nivel_riesgo = "ESTABLE / CONTROLADO"
                protocolo = "Presion arterial dentro de los limites esperados o bajo adecuado control farmacologico. Continuar con monitoreo preventivo."
                prediccion = 0
                probabilidad = 10.0
            
            resultado_inferencia = {
                "prediccion_crisis": prediccion,
                "probabilidad_porcentual": probabilidad,
                "nivel_riesgo_clinico": nivel_riesgo,
                "protocolo_sugerido": protocolo,
                "motor_inferencia_usado": "Reglas Basicas"
            }
        
        logger.info(f"[NODE] Registrando medico con cedula: {cedula_medico}")
        texto_token = texto_cedula if texto_cedula else "Token generado para medico"
        GestorBaseDatosRelacional.registrar_o_actualizar_medico(cedula_medico, texto_token)
        
        valores_texto = ""
        if valores_pdf:
            valores_texto = "|".join([f"{v['sistolica']}/{v['diastolica']}" for v in valores_pdf])
        
        # ============================================================
        # DATOS PARA LA BASE DE DATOS - CORREGIDO
        # ============================================================
        datos_db = {
            "id_paciente": id_paciente,
            "id_doctor": id_doctor,
            "edad": edad,
            "sistolica": sistolica,
            "diastolica": diastolica,
            "presion_pdf_sistolica": sistolica_pdf,
            "presion_pdf_diastolica": diastolica_pdf,
            "toma_medicamento": toma_medicamento,
            "prediccion_crisis": resultado_inferencia["prediccion_crisis"],
            "probabilidad_porcentual": resultado_inferencia["probabilidad_porcentual"],
            "nivel_riesgo_clinico": resultado_inferencia["nivel_riesgo_clinico"],
            "motor_inferencia_usado": resultado_inferencia["motor_inferencia_usado"],
            "cedula_pdf_valida": pdf_cedula_valido,
            "diagnostico_pdf_valido": pdf_diagnostico_valido,
            "valores_extraidos_pdf": valores_texto,
            "ruta_pdf_cedula": "",
            "ruta_pdf_diagnostico": ""
        }
        
        folio = GestorBaseDatosRelacional.registrar_expediente_completo(datos_db)
        logger.info(f"[NODE] Expediente registrado con folio: {folio}")
        
        ruta_cedula = ""
        ruta_diagnostico = ""
        
        if cedula_pdf_base64:
            logger.info(f"[NODE] Guardando PDF de cedula para folio {folio}...")
            resultado_cedula = GestorAlmacenamientoPDF.guardar_pdf(
                cedula_pdf_base64, folio, "cedula"
            )
            if resultado_cedula["exito"]:
                ruta_cedula = resultado_cedula["ruta"]
                logger.info(f"[NODE] PDF cedula guardado en: {ruta_cedula}")
            else:
                logger.error(f"[NODE] Error guardando PDF cedula: {resultado_cedula.get('error')}")
        
        if diagnostico_pdf_base64:
            logger.info(f"[NODE] Guardando PDF de diagnostico para folio {folio}...")
            resultado_diagnostico = GestorAlmacenamientoPDF.guardar_pdf(
                diagnostico_pdf_base64, folio, "diagnostico"
            )
            if resultado_diagnostico["exito"]:
                ruta_diagnostico = resultado_diagnostico["ruta"]
                logger.info(f"[NODE] PDF diagnostico guardado en: {ruta_diagnostico}")
            else:
                logger.error(f"[NODE] Error guardando PDF diagnostico: {resultado_diagnostico.get('error')}")
        
        if ruta_cedula or ruta_diagnostico:
            conn = GestorBaseDatosRelacional.conectar()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    UPDATE expedientes_htas 
                    SET ruta_pdf_cedula = %s, ruta_pdf_diagnostico = %s
                    WHERE idexpediente = %s
                """, (ruta_cedula, ruta_diagnostico, folio))
                conn.commit()
                logger.info(f"[DB_DAO] Rutas PDF actualizadas para folio #{folio}")
            except Exception as e:
                logger.error(f"[DB_DAO] Error actualizando rutas PDF: {str(e)}")
            finally:
                cursor.close()
                conn.close()
        
        logger.info(f"[NODE] Analisis completado. Folio: {folio}")
        
        return {
            "exitoso": True,
            "folio_expediente_db": folio,
            "cedula_pdf_valida": pdf_cedula_valido,
            "diagnostico_pdf_valido": pdf_diagnostico_valido,
            "prediccion_crisis": resultado_inferencia["prediccion_crisis"],
            "probabilidad_porcentual": resultado_inferencia["probabilidad_porcentual"],
            "nivel_riesgo_clinico": resultado_inferencia["nivel_riesgo_clinico"],
            "protocolo_sugerido": resultado_inferencia["protocolo_sugerido"],
            "motor_inferencia_usado": resultado_inferencia["motor_inferencia_usado"],
            "valores_pdf": valores_pdf,
            "sistolica_usada": sistolica_final,
            "diastolica_usada": diastolica_final,
            "valores_usados": "pdf" if sistolica_pdf is not None else "payload",
            "ruta_pdf_cedula": ruta_cedula,
            "ruta_pdf_diagnostico": ruta_diagnostico
        }
        
    except Exception as e:
        logger.error(f"[NODE] Error al analizar paciente: {str(e)}")
        return {
            "exitoso": False,
            "error": str(e)
        }


def procesar_desde_stdin() -> Dict[str, Any]:
    try:
        data = sys.stdin.read()
        payload = json.loads(data)
        return procesar_desde_json(payload)
    except Exception as e:
        return {
            "exitoso": False,
            "error": f"Error al procesar stdin: {str(e)}"
        }


@app.get("/api/ia/salud-sistema", status_code=status.HTTP_200_OK)
def verificar_salud_servidor():
    global instancia_ia_global
    return {
        "estatus_servicio": "Operando en Linea",
        "motor_ia_activo": instancia_ia_global.nombre_ganador if instancia_ia_global else "Ninguno",
        "persistencia_db": "Activa (PostgreSQL)",
        "seguridad_pdf": "Activo (Reconocimiento Semantico + Extraccion de Valores)",
        "almacenamiento_pdf": f"Activo (Ruta: {PDF_STORAGE_PATH})",
        "version": "3.3.0"
    }


@app.get("/api/ia/obtener-pdf/{folio}")
def obtener_pdf_por_folio(folio: int):
    try:
        expediente = GestorBaseDatosRelacional.obtener_expediente_por_folio(folio)
        
        if not expediente:
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
        
        pdf_cedula = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "cedula")
        pdf_diagnostico = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "diagnostico")
        
        # Convertir fecha_consulta a string ISO para serialización JSON
        fecha_consulta = expediente.get("fecha_consulta")
        if fecha_consulta and isinstance(fecha_consulta, (datetime, date)):
            fecha_consulta = fecha_consulta.isoformat()
        
        return {
            "folio": folio,
            "fecha_consulta": fecha_consulta,
            "cedula_medico": expediente.get("cedula_medico_fk"),
            "edad": expediente.get("edad"),
            "sistolica": expediente.get("sistolica"),
            "diastolica": expediente.get("diastolica"),
            "nivel_riesgo": expediente.get("nivel_riesgo"),
            "tiene_pdf_cedula": pdf_cedula is not None,
            "tiene_pdf_diagnostico": pdf_diagnostico is not None,
            "pdf_cedula_base64": pdf_cedula,
            "pdf_diagnostico_base64": pdf_diagnostico
        }
    except Exception as e:
        logger.error(f"[API] Error obteniendo PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ia/ultimo-analisis/{cedula_medico}")
def obtener_ultimo_analisis(cedula_medico: str):
    try:
        expediente = GestorBaseDatosRelacional.obtener_ultimo_expediente_por_cedula(cedula_medico)
        
        if not expediente:
            raise HTTPException(status_code=404, detail="No hay analisis para esta cedula")
        
        folio = expediente.get("id")
        
        pdf_cedula = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "cedula")
        pdf_diagnostico = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "diagnostico")
        
        # Convertir fecha_consulta a string ISO para serialización JSON
        fecha_consulta = expediente.get("fecha_consulta")
        if fecha_consulta and isinstance(fecha_consulta, (datetime, date)):
            fecha_consulta = fecha_consulta.isoformat()
        
        return {
            "folio": folio,
            "fecha_consulta": fecha_consulta,
            "cedula_medico": cedula_medico,
            "edad": expediente.get("edad"),
            "sistolica": expediente.get("sistolica"),
            "diastolica": expediente.get("diastolica"),
            "presion_pdf_sistolica": expediente.get("presion_pdf_sistolica"),
            "presion_pdf_diastolica": expediente.get("presion_pdf_diastolica"),
            "prediccion_crisis": expediente.get("prediccion_crisis"),
            "probabilidad_porcentual": expediente.get("probabilidad_porcentual"),
            "nivel_riesgo": expediente.get("nivel_riesgo"),
            "motor_utilizado": expediente.get("motor_utilizado"),
            "pdf_cedula_valido": expediente.get("pdf_cedula_valido"),
            "pdf_diagnostico_valido": expediente.get("pdf_diagnostico_valido"),
            "tiene_pdf_cedula": pdf_cedula is not None,
            "tiene_pdf_diagnostico": pdf_diagnostico is not None,
            "pdf_cedula_base64": pdf_cedula,
            "pdf_diagnostico_base64": pdf_diagnostico
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Error obteniendo ultimo analisis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ia/evaluar-paciente-completo", response_model=RespuestaEvaluacionClinica, status_code=status.HTTP_200_OK)
def evaluar_expediente_completo(payload: SolicitudEvaluacionCompleta):
    global instancia_ia_global
    if not instancia_ia_global:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El motor analitico predictivo no se encuentra instanciado en el servidor."
        )

    try:
        pdf_cedula_valido, texto_cedula_extraido = ProcesadorDocumentosPDF.validar_documento_cedula(
            payload.cedula_pdf_base64, payload.cedula_medico
        )
    except PDFParsingException as e:
        logger.error(f"[API_ENDPOINT] Fallo al parsear Cedula: {e.mensaje}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.mensaje)
        
    if not pdf_cedula_valido:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Fallo de credencial. El PDF no contiene el identificador de Cedula Profesional solicitado."
        )

    try:
        pdf_diagnostico_valido, texto_diagnostico, sistolica_pdf, diastolica_pdf, valores_pdf = \
            ProcesadorDocumentosPDF.validar_documento_hipertension(
                payload.diagnostico_pdf_base64
            )
    except PDFParsingException as e:
        logger.error(f"[API_ENDPOINT] Fallo al parsear el diagnostico: {e.mensaje}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.mensaje)
        
    if not pdf_diagnostico_valido:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fallo clinico. El PDF de soporte no contiene el diagnostico clinico requerido de hipertension."
        )

    sistolica_final = payload.sistolica
    diastolica_final = payload.diastolica
    valores_usados = "payload"
    
    if sistolica_pdf is not None and diastolica_pdf is not None:
        sistolica_final = sistolica_pdf
        diastolica_final = diastolica_pdf
        valores_usados = "pdf"
        logger.info(f"[API] Usando valores extraidos del PDF: {sistolica_final}/{diastolica_final} mmHg")
    else:
        logger.info(f"[API] Usando valores del payload: {sistolica_final}/{diastolica_final} mmHg")

    try:
        GestorBaseDatosRelacional.registrar_o_actualizar_medico(
            cedula=payload.cedula_medico,
            texto_cedula_token=texto_cedula_extraido
        )
    except DatabaseConnectionException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.mensaje)

    try:
        resultado_inferencia = instancia_ia_global.inferencia_paciente(
            edad=payload.edad,
            sistolica=sistolica_final,
            diastolica=diastolica_final,
            medicamento=payload.toma_medicamento
        )
    except MLModelException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.mensaje)

    try:
        valores_texto = ""
        if valores_pdf:
            valores_texto = "|".join([f"{v['sistolica']}/{v['diastolica']}" for v in valores_pdf])
        
        # ============================================================
        # DATOS PARA LA BASE DE DATOS
        # NOTA: Este endpoint necesita recibir id_paciente desde el token
        # ============================================================
        datos_para_base_datos = {
            "id_paciente": 1,  # ← TEMPORAL: Debe venir del token de autenticación
            "id_doctor": None,
            "edad": payload.edad,
            "sistolica": payload.sistolica,
            "diastolica": payload.diastolica,
            "presion_pdf_sistolica": sistolica_pdf,
            "presion_pdf_diastolica": diastolica_pdf,
            "toma_medicamento": payload.toma_medicamento,
            "prediccion_crisis": resultado_inferencia["prediccion_crisis"],
            "probabilidad_porcentual": resultado_inferencia["probabilidad_porcentual"],
            "nivel_riesgo_clinico": resultado_inferencia["nivel_riesgo_clinico"],
            "motor_inferencia_usado": resultado_inferencia["motor_inferencia_usado"],
            "cedula_pdf_valida": pdf_cedula_valido,
            "diagnostico_pdf_valido": pdf_diagnostico_valido,
            "valores_extraidos_pdf": valores_texto,
            "ruta_pdf_cedula": "",
            "ruta_pdf_diagnostico": ""
        }
        
        folio_transaccion = GestorBaseDatosRelacional.registrar_expediente_completo(datos_para_base_datos)
        
    except DatabaseConnectionException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.mensaje)

    try:
        ruta_cedula = ""
        ruta_diagnostico = ""
        
        if payload.cedula_pdf_base64:
            logger.info(f"[API] Guardando PDF de cedula para folio {folio_transaccion}...")
            resultado_cedula = GestorAlmacenamientoPDF.guardar_pdf(
                payload.cedula_pdf_base64, folio_transaccion, "cedula"
            )
            if resultado_cedula["exito"]:
                ruta_cedula = resultado_cedula["ruta"]
                logger.info(f"[API] PDF Cedula guardado: {ruta_cedula}")
            else:
                logger.error(f"[API] Error guardando PDF cedula: {resultado_cedula.get('error')}")
        
        if payload.diagnostico_pdf_base64:
            logger.info(f"[API] Guardando PDF de diagnostico para folio {folio_transaccion}...")
            resultado_diagnostico = GestorAlmacenamientoPDF.guardar_pdf(
                payload.diagnostico_pdf_base64, folio_transaccion, "diagnostico"
            )
            if resultado_diagnostico["exito"]:
                ruta_diagnostico = resultado_diagnostico["ruta"]
                logger.info(f"[API] PDF Diagnostico guardado: {ruta_diagnostico}")
            else:
                logger.error(f"[API] Error guardando PDF diagnostico: {resultado_diagnostico.get('error')}")
        
        if ruta_cedula or ruta_diagnostico:
            conn = GestorBaseDatosRelacional.conectar()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    UPDATE expedientes_htas 
                    SET ruta_pdf_cedula = %s, ruta_pdf_diagnostico = %s
                    WHERE idexpediente = %s
                """, (ruta_cedula, ruta_diagnostico, folio_transaccion))
                conn.commit()
                logger.info(f"[API] Rutas PDF actualizadas para folio #{folio_transaccion}")
            except Exception as e:
                logger.error(f"[API] Error actualizando rutas PDF: {str(e)}")
            finally:
                cursor.close()
                conn.close()
                
    except Exception as e:
        logger.error(f"[API] Error en almacenamiento de PDFs: {str(e)}")

    return {
        "folio_expediente_db": folio_transaccion,
        "cedula_pdf_valida": pdf_cedula_valido,
        "diagnostico_pdf_valido": pdf_diagnostico_valido,
        "prediccion_crisis": resultado_inferencia["prediccion_crisis"],
        "probabilidad_porcentual": resultado_inferencia["probabilidad_porcentual"],
        "nivel_riesgo_clinico": resultado_inferencia["nivel_riesgo_clinico"],
        "protocolo_sugerido": resultado_inferencia["protocolo_sugerido"],
        "motor_inferencia_usado": resultado_inferencia["motor_inferencia_usado"],
        "mensaje_almacenamiento": f"Expediente persistido exitosamente en PostgreSQL. Folio de control asignado #{folio_transaccion}. Valores usados: {valores_usados}. PDFs almacenados en: {PDF_STORAGE_PATH}"
    }


# ==============================================================================
# HILO DE CONTROL DE INICIO DE LA COMPILACION (ENTRYPOINT)
# ==============================================================================
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--json':
        try:
            logger.info("[NODE] Verificando conexion a PostgreSQL...")
            conn = get_db_connection()
            conn.close()
            logger.info("[NODE] Conexion a PostgreSQL exitosa.")
            
            payload = json.loads(sys.argv[2])
            resultado = procesar_desde_json(payload)
            print(json.dumps(resultado, cls=CustomJSONEncoder))
        except json.JSONDecodeError as e:
            print(json.dumps({
                "exitoso": False,
                "error": f"Error al decodificar JSON: {str(e)}"
            }))
        except Exception as e:
            print(json.dumps({
                "exitoso": False,
                "error": str(e)
            }))
    elif len(sys.argv) > 1 and sys.argv[1] == '--stdin':
        try:
            logger.info("[NODE] Verificando conexion a PostgreSQL...")
            conn = get_db_connection()
            conn.close()
            logger.info("[NODE] Conexion a PostgreSQL exitosa.")
            
            resultado = procesar_desde_stdin()
            print(json.dumps(resultado, cls=CustomJSONEncoder))
        except Exception as e:
            print(json.dumps({
                "exitoso": False,
                "error": str(e)
            }))
    else:
        logger.info("[SISTEMA_HOST] Lanzando el bucle de eventos del servidor ASGI Uvicorn...")
        uvicorn.run("hipertension_analyzer:app", host="0.0.0.0", port=8000)