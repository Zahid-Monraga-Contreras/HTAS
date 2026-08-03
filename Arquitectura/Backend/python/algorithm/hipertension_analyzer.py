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
# VERSION DE COMPILACION: 3.3.0 (Edicion con Almacenamiento Persistente de PDFs y SQLite)
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
# estructurados y manteniendo las rutas en la base de datos SQLite para su recuperacion.
# ==============================================================================

import os
import io
import re
import base64
import logging
import sqlite3
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List
from pydantic import BaseModel, Field, validator

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
# CONFIGURACION DE RUTAS - ADAPTADO A TU ESTRUCTURA
# ==============================================================================

# Obtener la ruta base del proyecto (raiz)
# El script esta en: python/algorithm/hipertension_analyzer.py
# Subimos 2 niveles para llegar a la raiz del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Ruta de almacenamiento de PDFs
PDF_STORAGE_PATH = os.path.join(BASE_DIR, 'uploads', 'pdfs')

# Ruta de la base de datos (en la raiz del proyecto)
DB_NAME = os.path.join(BASE_DIR, 'clinica_htas_mexico.db')

# Ruta del CSV de entrenamiento (en la raiz del proyecto)
CSV_NAME = os.path.join(BASE_DIR, 'Hipertension_Arterial_Mexico.csv')

# Crear directorio de PDFs si no existe
os.makedirs(PDF_STORAGE_PATH, exist_ok=True)

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
logger.info(f"[INIT] Base de datos: {DB_NAME}")
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
    """Excepcion arrojada ante fallas de escritura, lectura o integridad referencial en SQLite."""
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
# CAPITULO III: MOTOR DE BASE DE DATOS RELACIONAL (SQLite)
# ==============================================================================
class GestorBaseDatosRelacional:
    """
    Abstrae y controla toda la interaccion con el motor de base de datos SQLite.
    Aplica principios ACID (Atomicidad, Consistencia, Aislamiento y Durabilidad)
    mediante un esquema estructurado de dos tablas con llaves foraneas.
    """
    
    @staticmethod
    def conectar() -> sqlite3.Connection:
        """Establece una conexion directa con el archivo de base de datos relacional."""
        try:
            return sqlite3.connect(DB_NAME)
        except sqlite3.Error as e:
            logger.critical(f"[SQLITE_CONN] Error critico de conexion al archivo {DB_NAME}: {str(e)}")
            raise DatabaseConnectionException(f"No se pudo conectar a la base de datos: {str(e)}")

    @classmethod
    def inicializar_esquema(cls):
        """
        Crea las tablas de la base de datos aplicando restricciones de integridad.
        Tabla 1: 'medicos' (Catalogo de medicos con registro validado).
        Tabla 2: 'expedientes' (Registros clinicos vinculados al medico).
        """
        logger.info("[DB_INIT] Iniciando la creacion fisica del esquema relacional...")
        conn = cls.conectar()
        cursor = conn.cursor()
        
        try:
            # Habilitar el soporte de llaves foraneas en el motor SQLite
            cursor.execute("PRAGMA foreign_keys = ON;")
            
            # Creacion de Tabla de Medicos Validada
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS medicos (
                    cedula TEXT PRIMARY KEY,
                    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    estatus_activo INTEGER NOT NULL DEFAULT 1,
                    token_autenticacion_pdf TEXT
                );
            """)
            
            # Creacion de Tabla de Expedientes Clinicos (Llave foranea hacia Medicos)
            # Se agregaron las columnas ruta_pdf_cedula y ruta_pdf_diagnostico
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS expedientes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    cedula_medico_fk TEXT NOT NULL,
                    edad INTEGER NOT NULL,
                    sistolica INTEGER NOT NULL,
                    diastolica INTEGER NOT NULL,
                    presion_pdf_sistolica INTEGER,
                    presion_pdf_diastolica INTEGER,
                    toma_medicamento INTEGER NOT NULL,
                    prediccion_crisis INTEGER NOT NULL,
                    probabilidad_porcentual REAL NOT NULL,
                    nivel_riesgo TEXT NOT NULL,
                    motor_utilizado TEXT NOT NULL,
                    pdf_cedula_valido INTEGER NOT NULL,
                    pdf_diagnostico_valido INTEGER NOT NULL,
                    valores_extraidos_pdf TEXT,
                    ruta_pdf_cedula TEXT,
                    ruta_pdf_diagnostico TEXT,
                    FOREIGN KEY (cedula_medico_fk) REFERENCES medicos(cedula)
                        ON DELETE CASCADE ON UPDATE CASCADE
                );
            """)
            
            conn.commit()
            logger.info("[DB_INIT] Esquema relacional de doble tabla creado e instanciado exitosamente.")
        except sqlite3.Error as e:
            conn.rollback()
            logger.error(f"[DB_INIT] Error durante la construccion de tablas: {str(e)}")
            raise DatabaseConnectionException(f"Fallo de inicializacion DDL: {str(e)}")
        finally:
            conn.close()

    @classmethod
    def registrar_o_actualizar_medico(cls, cedula: str, texto_cedula_token: str):
        """Registra un medico en el catalogo o actualiza su estado si ya existia."""
        conn = cls.conectar()
        cursor = conn.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys = ON;")
            # Tomamos una muestra de texto del PDF de la cedula como token de firma
            token_muestra = texto_cedula_token[:200].replace("\n", " ")
            
            cursor.execute("""
                INSERT INTO medicos (cedula, estatus_activo, token_autenticacion_pdf)
                VALUES (?, 1, ?)
                ON CONFLICT(cedula) DO UPDATE SET
                    fecha_registro = CURRENT_TIMESTAMP,
                    token_autenticacion_pdf = excluded.token_autenticacion_pdf;
            """, (cedula, token_muestra))
            conn.commit()
            logger.info(f"[DB_DAO] Medico con Cedula '{cedula}' persistido/actualizado en catalogo.")
        except sqlite3.Error as e:
            conn.rollback()
            logger.error(f"[DB_DAO] Error al registrar medico '{cedula}': {str(e)}")
            raise DatabaseConnectionException(f"Fallo al insertar en catalogo medico: {str(e)}")
        finally:
            conn.close()

    @classmethod
    def registrar_expediente_completo(cls, datos: Dict[str, Any]) -> int:
        """Inserta el registro de evaluacion clinica vinculandolo a la cedula del medico."""
        conn = cls.conectar()
        cursor = conn.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys = ON;")
            
            query = """
                INSERT INTO expedientes (
                    cedula_medico_fk, edad, sistolica, diastolica,
                    presion_pdf_sistolica, presion_pdf_diastolica,
                    toma_medicamento, prediccion_crisis, probabilidad_porcentual,
                    nivel_riesgo, motor_utilizado, pdf_cedula_valido,
                    pdf_diagnostico_valido, valores_extraidos_pdf,
                    ruta_pdf_cedula, ruta_pdf_diagnostico
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """
            
            valores = (
                datos["cedula_medico"],
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
            conn.commit()
            nuevo_folio = cursor.lastrowid
            logger.info(f"[DB_DAO] Expediente Clinico guardado con exito. Folio de registro: #{nuevo_folio}")
            return nuevo_folio
        except sqlite3.Error as e:
            conn.rollback()
            logger.error(f"[DB_DAO] Error al guardar el expediente del paciente: {str(e)}")
            raise DatabaseConnectionException(f"Fallo de transaccion DML en tabla 'expedientes': {str(e)}")
        finally:
            conn.close()

    @classmethod
    def obtener_expediente_por_folio(cls, folio: int) -> Optional[Dict[str, Any]]:
        """Obtiene un expediente completo por su folio"""
        conn = cls.conectar()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    id, fecha_consulta, cedula_medico_fk, edad,
                    sistolica, diastolica, presion_pdf_sistolica, presion_pdf_diastolica,
                    toma_medicamento, prediccion_crisis, probabilidad_porcentual,
                    nivel_riesgo, motor_utilizado, pdf_cedula_valido,
                    pdf_diagnostico_valido, valores_extraidos_pdf,
                    ruta_pdf_cedula, ruta_pdf_diagnostico
                FROM expedientes
                WHERE id = ?
            """, (folio,))
            
            resultado = cursor.fetchone()
            if resultado:
                columnas = [desc[0] for desc in cursor.description]
                return dict(zip(columnas, resultado))
            return None
            
        except sqlite3.Error as e:
            logger.error(f"[DB_DAO] Error obteniendo expediente: {str(e)}")
            return None
        finally:
            conn.close()

    @classmethod
    def obtener_ultimo_expediente_por_cedula(cls, cedula_medico: str) -> Optional[Dict[str, Any]]:
        """Obtiene el ultimo expediente de un medico"""
        conn = cls.conectar()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    id, fecha_consulta, cedula_medico_fk, edad,
                    sistolica, diastolica, presion_pdf_sistolica, presion_pdf_diastolica,
                    toma_medicamento, prediccion_crisis, probabilidad_porcentual,
                    nivel_riesgo, motor_utilizado, pdf_cedula_valido,
                    pdf_diagnostico_valido, valores_extraidos_pdf,
                    ruta_pdf_cedula, ruta_pdf_diagnostico
                FROM expedientes
                WHERE cedula_medico_fk = ?
                ORDER BY id DESC
                LIMIT 1
            """, (cedula_medico,))
            
            resultado = cursor.fetchone()
            if resultado:
                columnas = [desc[0] for desc in cursor.description]
                return dict(zip(columnas, resultado))
            return None
            
        except sqlite3.Error as e:
            logger.error(f"[DB_DAO] Error obteniendo expediente: {str(e)}")
            return None
        finally:
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
        # Espanol - formato completo
        r'presi[oó]n\s*arterial\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'presi[oó]n\s*arterial\s*[:=]\s*(\d{2,3})\s*[\/]\s*(\d{2,3})',
        r'presi[oó]n\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'tensi[oó]n\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'pa\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'presi[oó]n\s*arterial\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'tensi[oó]n\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        
        # Ingles
        r'blood\s*pressure\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'bp\s*[:=]\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'blood\s*pressure\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        r'bp\s*(\d{2,3})\s*[/-]\s*(\d{2,3})',
        
        # Patrones simples con mmHg
        r'(\d{2,3})\s*[/-]\s*(\d{2,3})\s*mm?hg?',
        r'(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg|mm hg)',
        r'(\d{2,3})\s*\/\s*(\d{2,3})\s*mm',
        
        # Con etiquetas especificas (busqueda separada)
        r'sist[oó]lica?\s*[:=]\s*(\d{2,3})\s*.*?diast[oó]lica?\s*[:=]\s*(\d{2,3})',
        r'sys\s*[:=]\s*(\d{2,3})\s*.*?dia\s*[:=]\s*(\d{2,3})',
        r'sistolica\s*(\d{2,3}).*?diastolica\s*(\d{2,3})',
        
        # Sin etiquetas pero con numeros que parecen presion
        r'(\d{2,3})\s*\/\s*(\d{2,3})(?=\s*(?:mmhg|mm hg)?\s*(?:[^\d]|$))',
    ]
    
    # Patrones para buscar sistolica y diastolica por separado
    PATRON_SISTOLICA = r'sist[oó]lica?\s*[:=]?\s*(\d{2,3})'
    PATRON_DIASTOLICA = r'diast[oó]lica?\s*[:=]?\s*(\d{2,3})'
    
    # Palabras clave para validacion de cedula
    LEXICON_CEDULA = ["cedula", "profesional", "registro", "medico", "educacion", "sep", "direccion", "profesiones", "folio"]
    
    # Palabras clave para validacion de diagnostico
    LEXICON_MEDICO = [
        "hipertension", "hipertenso", "sistolica", "diastolica", "presion arterial",
        "tension", "cardiaco", "diagnostico", "clinica", "tratamiento", "medico", "paciente",
        "hypertension", "blood pressure", "mmHg"
    ]

    @staticmethod
    def extraer_texto_de_base64(string_base64: str) -> str:
        """
        Decodifica la cadena en Base64, la transforma en un flujo binario en memoria,
        lee el archivo PDF y extrae recursivamente el texto de cada pagina.
        """
        logger.info("[PDF_PARSER] Decodificando secuencia Base64 entrante...")
        try:
            # Limpieza estructural de la cabecera del DataURI si esta presente
            if "," in string_base64:
                string_base64 = string_base64.split(",")[1]
            
            # Conversion de texto plano codificado a bytes fisicos
            pdf_bytes = base64.b64decode(string_base64)
            # Creacion de un buffer de entrada/salida virtual en memoria RAM
            buffer_memoria = io.BytesIO(pdf_bytes)
            
            # Instanciacion del parser de pypdf
            lector_pdf = pypdf.PdfReader(buffer_memoria)
            texto_acumulado = []
            
            # Recorrido de paginas para extraccion de caracteres unicode
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
        """
        EXTRAE VALORES REALES DE PRESION ARTERIAL del texto del PDF.
        
        Args:
            texto_pdf: Texto extraido del PDF
            
        Returns:
            Tuple con (sistolica, diastolica, lista_valores_encontrados)
            - sistolica: ultimo valor de sistolica encontrado o None
            - diastolica: ultimo valor de diastolica encontrado o None
            - lista_valores_encontrados: todos los valores encontrados
        """
        logger.info("[PDF_VAL] Extrayendo valores de presion arterial del texto...")
        
        if not texto_pdf:
            return None, None, []
        
        texto_normalizado = texto_pdf.lower()
        valores_encontrados = []
        
        # ============================================================
        # BUSQUEDA CON PATRONES DE PRESION COMPLETA (SYS/DIA juntos)
        # ============================================================
        for patron in cls.PATRONES_PRESION:
            coincidencias = re.findall(patron, texto_pdf, re.IGNORECASE)
            
            for coincidencia in coincidencias:
                try:
                    if isinstance(coincidencia, tuple):
                        if len(coincidencia) >= 2:
                            # Limpiar caracteres no numericos
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
                        # Si es un string, buscar dos numeros separados
                        numeros = re.findall(r'\d+', str(coincidencia))
                        if len(numeros) >= 2:
                            sistolica = int(numeros[0])
                            diastolica = int(numeros[1])
                        else:
                            continue
                    
                    # Validar rangos razonables
                    if 80 <= sistolica <= 250 and 40 <= diastolica <= 150:
                        valor = {
                            'sistolica': sistolica,
                            'diastolica': diastolica,
                            'patron': patron,
                            'tipo': 'completo'
                        }
                        # Evitar duplicados exactos
                        if not any(v['sistolica'] == sistolica and v['diastolica'] == diastolica for v in valores_encontrados):
                            valores_encontrados.append(valor)
                            logger.info(f"[PDF_VAL] Valor encontrado: {sistolica}/{diastolica} mmHg")
                            
                except (ValueError, TypeError, IndexError) as e:
                    logger.warning(f"[PDF_VAL] Error procesando coincidencia: {e}")
                    continue

        # ============================================================
        # BUSQUEDA POR SEPARADO (SISTOLICA Y DIASTOLICA POR APARTE)
        # ============================================================
        # Buscar sistolica
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

        # ============================================================
        # BUSCAR EN CONTEXTO DE "PRESION ARTERIAL: X/Y" SIN mmHg
        # ============================================================
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

        # ============================================================
        # DETERMINAR EL ULTIMO VALOR ENCONTRADO (MAS RECIENTE)
        # ============================================================
        sistolica_final = None
        diastolica_final = None
        
        if valores_encontrados:
            # Tomar el ultimo valor (mas reciente en el documento)
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
        """
        Aplica reglas de negocio de reconocimiento semantico sobre el PDF de la cedula.
        Verifica que contenga el numero exacto de cedula y palabras institucionales.
        """
        logger.info(f"[PDF_VAL] Verificando legitimidad del PDF para la cedula: {cedula_esperada}")
        texto_pdf = cls.extraer_texto_de_base64(pdf_base64)
        texto_normalizado = texto_pdf.lower()
        
        # Validacion del numero de cedula (limpiando espacios o guiones)
        cedula_limpia = cedula_esperada.strip()
        contiene_cedula_id = cedula_limpia in texto_normalizado or cedula_limpia.replace(" ", "") in texto_normalizado
        
        # Patron de coincidencia linguistica institucional
        coincidencias = sum(1 for token in cls.LEXICON_CEDULA if token in texto_normalizado)
        
        # Umbral de validacion semantica
        if contiene_cedula_id and coincidencias >= 2:
            logger.info("[PDF_VAL] El documento contiene la firma semantica oficial de una Cedula Profesional.")
            return True, texto_pdf
            
        logger.warning(f"[PDF_VAL] Cedula Profesional invalida. No coincide con '{cedula_esperada}' o no es oficial.")
        return False, texto_pdf

    @classmethod
    def validar_documento_hipertension(cls, pdf_base64: str) -> Tuple[bool, str, Optional[int], Optional[int], List[Dict]]:
        """
        Analiza el PDF clinico buscando palabras clave medicas y EXTRAYENDO VALORES REALES
        de presion arterial.
        
        Returns:
            Tuple con:
            - bool: si el documento es valido
            - str: texto del PDF
            - int: sistolica encontrada (o None)
            - int: diastolica encontrada (o None)
            - List: lista de todos los valores encontrados
        """
        logger.info("[PDF_VAL] Analizando diagnostico clinico de confirmacion de hipertension...")
        texto_pdf = cls.extraer_texto_de_base64(pdf_base64)
        texto_normalizado = texto_pdf.lower()
        
        # 1. Buscar palabras clave medicas (como antes)
        coincidencias = sum(1 for token in cls.LEXICON_MEDICO if token in texto_normalizado)
        
        # 2. EXTRAER VALORES NUMERICOS DE PRESION (NUEVO)
        sistolica, diastolica, valores_encontrados = cls.extraer_valores_presion(texto_pdf)
        
        # 3. Decision: Validar si tiene suficientes marcadores clinicos
        # El umbral se mantiene en 3 para compatibilidad
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
# CAPITULO V: ARQUITECTURA PIPELINE DE MACHINE LEARNING COMPETITIVO (IA)
# ==============================================================================
class PipelineInteligenciaArtificial:
    """
    Controla el flujo de vida analitico de la Inteligencia Artificial del sistema.
    Entrena, valida y hace competir a tres algoritmos de ML distintos,
    seleccionando de manera automatizada al mejor modelo.
    """
    def __init__(self, datos_entrada: pd.DataFrame):
        self.df = datos_entrada
        self.scaler = StandardScaler()
        
        # Instanciacion logica de los tres contenedores de algoritmos
        self.modelo_logistic_regression = None
        self.modelo_random_forest = None
        self.modelo_xgboost = None
        
        # Atributos para el modelo ganador
        self.mejor_modelo = None
        self.nombre_ganador = "Ninguno"
        
        # Definicion del esquema dimensional de variables
        self.variables_predictoras = ['Edad', 'Sistolica', 'Diastolica', 'Toma_Medicamento']
        self.variable_clase = 'Crisis_Hipertensiva'

    def ejecutar_entrenamiento_y_competencia(self) -> str:
        """
        Prepara las matrices de entrada, separa en conjuntos de entrenamiento y
        prueba, entrena simultaneamente los 3 clasificadores y evalua su rendimiento.
        """
        logger.info("[ML_CORE] Iniciando pipeline de entrenamiento tri-algoritmico competitivo...")
        
        # Extraccion de variables dependientes e independientes
        X = self.df[self.variables_predictoras]
        y = self.df[self.variable_clase]
        
        # Division de datos (80% entrenamiento, 20% evaluacion) con estratificacion
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Escalado y normalizacion z-score de variables continuas
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # ----------------------------------------------------------------------
        # ALGORITMO 1: REGRESION LOGISTICA (Optimizacion Convexa Lineal)
        # ----------------------------------------------------------------------
        logger.info("[ML_CORE] Entrenando Clasificador 1: Regresion Logistica...")
        self.modelo_logistic_regression = LogisticRegression(class_weight='balanced', random_state=42, max_iter=500)
        self.modelo_logistic_regression.fit(X_train_scaled, y_train)
        preds_lr = self.modelo_logistic_regression.predict(X_test_scaled)
        
        # Extraccion de metricas de rendimiento para el Algoritmo 1
        acc_lr = accuracy_score(y_test, preds_lr)
        prec_lr = precision_score(y_test, preds_lr, zero_division=0)
        rec_lr = recall_score(y_test, preds_lr, zero_division=0)
        f1_lr = f1_score(y_test, preds_lr, zero_division=0)
        logger.info(f"[ML_METRICAS] Regresion Logistica -> Acc: {acc_lr:.4f} | F1: {f1_lr:.4f}")

        # ----------------------------------------------------------------------
        # ALGORITMO 2: RANDOM FOREST (Ensamble Homogeneo de Arboles Paralelos)
        # ----------------------------------------------------------------------
        logger.info("[ML_CORE] Entrenando Clasificador 2: Random Forest Classifier...")
        self.modelo_random_forest = RandomForestClassifier(
            n_estimators=200, max_depth=8, class_weight='balanced', random_state=42
        )
        self.modelo_random_forest.fit(X_train_scaled, y_train)
        preds_rf = self.modelo_random_forest.predict(X_test_scaled)
        
        # Extraccion de metricas de rendimiento para el Algoritmo 2
        acc_rf = accuracy_score(y_test, preds_rf)
        prec_rf = precision_score(y_test, preds_rf, zero_division=0)
        rec_rf = recall_score(y_test, preds_rf, zero_division=0)
        f1_rf = f1_score(y_test, preds_rf, zero_division=0)
        logger.info(f"[ML_METRICAS] Random Forest -> Acc: {acc_rf:.4f} | F1: {f1_rf:.4f}")

        # ----------------------------------------------------------------------
        # ALGORITMO 3: XGBOOST (Optimizador Secuencial por Gradiente Descendente)
        # ----------------------------------------------------------------------
        logger.info("[ML_CORE] Entrenando Clasificador 3: XGBoost Classifier...")
        conteo_clases = np.bincount(y_train)
        ratio_balanceo = conteo_clases[0] / conteo_clases[1] if len(conteo_clases) > 1 else 1.0
        
        self.modelo_xgboost = XGBClassifier(
            n_estimators=150, max_depth=5, scale_pos_weight=ratio_balanceo,
            eval_metric='logloss', random_state=42
        )
        self.modelo_xgboost.fit(X_train_scaled, y_train)
        preds_xgb = self.modelo_xgboost.predict(X_test_scaled)
        
        # Extraccion de metricas de rendimiento para el Algoritmo 3
        acc_xgb = accuracy_score(y_test, preds_xgb)
        prec_xgb = precision_score(y_test, preds_xgb, zero_division=0)
        rec_xgb = recall_score(y_test, preds_xgb, zero_division=0)
        f1_xgb = f1_score(y_test, preds_xgb, zero_division=0)
        logger.info(f"[ML_METRICAS] XGBoost -> Acc: {acc_xgb:.4f} | F1: {f1_xgb:.4f}")

        # ----------------------------------------------------------------------
        # PROCESO DE EVALUACION Y CORONACION DEL ALGORITMO GANADOR
        # ----------------------------------------------------------------------
        # Evaluamos bajo el criterio del F1-Score (idoneo para datos clinicos balanceados/desbalanceados)
        tabla_competencia = {
            "Regresion Logistica": (self.modelo_logistic_regression, f1_lr),
            "Random Forest": (self.modelo_random_forest, f1_rf),
            "XGBoost": (self.modelo_xgboost, f1_xgb)
        }
        
        # Busqueda del mejor modelo segun metrica F1
        self.nombre_ganador = max(tabla_competencia, key=lambda clave: tabla_competencia[clave][1])
        self.mejor_modelo = tabla_competencia[self.nombre_ganador][0]
        
        logger.info("=====================================================================")
        logger.info(f"   ALGORITMO GANADOR PARA PRODUCCION: {self.nombre_ganador.upper()}")
        logger.info(f"   Metrica F1 lograda: {tabla_competencia[self.nombre_ganador][1]:.4%}")
        logger.info("=====================================================================")
        
        return self.nombre_ganador

    def inferencia_paciente(self, edad: int, sistolica: int, diastolica: int, medicamento: int) -> Dict[str, Any]:
        """
        Ejecuta la prediccion sobre un nuevo paciente a partir de sus parametros,
        usando exclusivamente el mejor de los tres modelos de la competencia.
        """
        if self.mejor_modelo is None:
            logger.critical("[INFERENCIA] Se intento consultar el modelo sin haber entrenado los algoritmos.")
            raise MLModelException("El pipeline no se ha inicializado o entrenado correctamente.")

        # Construccion y estructuración del vector unidimensional de entrada
        vector_entrada = pd.DataFrame([[edad, sistolica, diastolica, medicamento]], columns=self.variables_predictoras)
        # Escalado equivalente al entrenamiento
        vector_escalado = self.scaler.transform(vector_entrada)

        # Calculo de probabilidades clinicas
        probabilidades = self.mejor_modelo.predict_proba(vector_escalado)
        probabilidad_crisis = float(probabilidades[0][1])
        prediccion_binaria = int(self.mejor_modelo.predict(vector_escalado)[0])

        # Regla de Negocio / Semáforo de Riesgo (Guias Internacionales de Cardiologia)
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
    """
    Mapeador estricto para validar los datos que recibe la API desde el exterior (Mobile o Web).
    Previene inyecciones de datos y errores de formato.
    """
    edad: int = Field(..., ge=0, le=120, description="Edad del paciente evaluado")
    sistolica: int = Field(..., ge=40, le=260, description="Presion sistolica medida en mmHg")
    diastolica: int = Field(..., ge=30, le=180, description="Presion diastolica medida en mmHg")
    toma_medicamento: int = Field(..., ge=0, le=1, description="Indicador binario de adherencia farmacologica (1=Si, 0=No)")
    
    cedula_medico: str = Field(..., min_length=7, max_length=10, description="Numero identificador de la Cedula")
    cedula_pdf_base64: str = Field(..., description="Documento de Cedula Profesional en formato Base64")
    diagnostico_pdf_base64: str = Field(..., description="Expediente de confirmacion de hipertension en Base64")

    @validator('cedula_medico')
    def normalizar_cedula(cls, valor: str):
        """Remueve espacios en blanco innecesarios de la cedula profesional."""
        return valor.strip()


class RespuestaEvaluacionClinica(BaseModel):
    """Estructura de respuesta HTTP para el cliente movil."""
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
app = FastAPI(
    title="Core Predictivo Tri-Algoritmico Persistente - HTAS Mexico",
    description="Motor de Inferencia clinica con validacion sintactica de expedientes y catalogo relacional de medicos.",
    version="3.3.0"
)

# Configuracion del puente CORS para permitir interacciones seguras entre dominios
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variable de almacenamiento global en RAM para la instancia activa del pipeline de IA
instancia_ia_global: Optional[PipelineInteligenciaArtificial] = None


# ==============================================================================
# FUNCION PARA OBTENER ULTIMO EXPEDIENTE DE UN PACIENTE
# ==============================================================================
def obtener_ultimo_expediente_paciente(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Obtiene el ultimo expediente de un paciente
    """
    try:
        id_paciente = payload.get('id_paciente')
        
        if not id_paciente:
            return {
                "exitoso": False,
                "error": "Se requiere el ID del paciente"
            }
        
        logger.info(f"[NODE] Obteniendo ultimo expediente para paciente: {id_paciente}")
        
        conn = GestorBaseDatosRelacional.conectar()
        cursor = conn.cursor()
        
        # Primero obtener el ultimo id de expediente para este paciente
        # Como la tabla expedientes no tiene id_paciente, usamos cedula_medico_fk
        # o simplemente obtenemos el ultimo expediente de todos
        cursor.execute("""
            SELECT 
                id, 
                fecha_consulta, 
                cedula_medico_fk,
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
            FROM expedientes
            ORDER BY id DESC
            LIMIT 1
        """)
        
        resultado = cursor.fetchone()
        conn.close()
        
        if not resultado:
            return {
                "exitoso": False,
                "error": "No hay expedientes para este paciente"
            }
        
        # Obtener los nombres de las columnas
        columnas = ['id', 'fecha_consulta', 'cedula_medico_fk', 'edad', 'sistolica', 
                   'diastolica', 'presion_pdf_sistolica', 'presion_pdf_diastolica',
                   'toma_medicamento', 'prediccion_crisis', 'probabilidad_porcentual',
                   'nivel_riesgo', 'motor_utilizado', 'pdf_cedula_valido',
                   'pdf_diagnostico_valido', 'valores_extraidos_pdf',
                   'ruta_pdf_cedula', 'ruta_pdf_diagnostico']
        
        datos = dict(zip(columnas, resultado))
        
        # Agregar el campo 'folio' que espera el frontend
        datos['folio'] = datos.get('id')
        
        # Buscar el PDF en el sistema de archivos y convertirlo a Base64
        ruta_pdf = datos.get('ruta_pdf_diagnostico')
        pdf_base64 = None
        
        if ruta_pdf and os.path.exists(ruta_pdf):
            try:
                with open(ruta_pdf, 'rb') as f:
                    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
            except Exception as e:
                logger.error(f"[NODE] Error leyendo PDF: {str(e)}")
        
        datos['pdf_diagnostico_base64'] = pdf_base64
        
        # Mapear campos para compatibilidad con el frontend
        return {
            "exitoso": True,
            "folio": datos.get('id'),
            "fecha_consulta": datos.get('fecha_consulta'),
            "id_paciente": id_paciente,
            "nombre_paciente": "Paciente",
            "ap_paterno_paciente": "",
            "ap_materno_paciente": "",
            "edad": datos.get('edad'),
            "sistolica": datos.get('sistolica'),
            "diastolica": datos.get('diastolica'),
            "presion_pdf_sistolica": datos.get('presion_pdf_sistolica'),
            "presion_pdf_diastolica": datos.get('presion_pdf_diastolica'),
            "prediccion_crisis": datos.get('prediccion_crisis'),
            "probabilidad_porcentual": datos.get('probabilidad_porcentual'),
            "nivel_riesgo": datos.get('nivel_riesgo'),
            "motor_utilizado": datos.get('motor_utilizado'),
            "tiene_pdf_cedula": bool(datos.get('pdf_cedula_valido')),
            "tiene_pdf_diagnostico": bool(datos.get('pdf_diagnostico_valido')),
            "pdf_diagnostico_base64": pdf_base64,
            "ruta_pdf_cedula": datos.get('ruta_pdf_cedula'),
            "ruta_pdf_diagnostico": datos.get('ruta_pdf_diagnostico')
        }
        
    except Exception as e:
        logger.error(f"[NODE] Error obteniendo expediente: {str(e)}")
        return {
            "exitoso": False,
            "error": str(e)
        }


def procesar_desde_json(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Procesa una solicitud desde Node.js via argumentos JSON
    """
    try:
        accion = payload.get('accion')
        
        # Si es una accion para obtener el ultimo expediente
        if accion == 'obtener_ultimo_expediente_paciente':
            return obtener_ultimo_expediente_paciente(payload)
        
        # Si es una accion para obtener PDF por folio
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
        
        # Si es una accion para obtener ultimo analisis por cedula
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
            
            return {
                "exitoso": True,
                "folio": folio,
                "fecha_consulta": expediente.get('fecha_consulta'),
                "cedula_medico": expediente.get('cedula_medico_fk'),
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
        
        # Si no es una accion especifica, procesar como analisis normal
        logger.info("[NODE] Procesando solicitud desde JSON...")
        
        # Extraer datos del payload
        id_paciente = payload.get('id_paciente')
        id_doctor = payload.get('id_doctor')
        edad = payload.get('edad')
        sistolica = payload.get('sistolica')
        diastolica = payload.get('diastolica')
        toma_medicamento = payload.get('toma_medicamento', 0)
        cedula_medico = payload.get('cedula_medico', '')
        cedula_pdf_base64 = payload.get('cedula_pdf_base64', '')
        diagnostico_pdf_base64 = payload.get('diagnostico_pdf_base64', '')
        
        # Validar datos requeridos
        if edad is None or sistolica is None or diastolica is None:
            return {
                "exitoso": False,
                "error": "Faltan datos requeridos: edad, sistolica, diastolica"
            }
        
        logger.info(f"[NODE] Datos recibidos - Edad: {edad}, Presion: {sistolica}/{diastolica}")
        
        # Validar PDF de diagnostico
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
        
        # Validar PDF de cedula
        pdf_cedula_valido = False
        texto_cedula = ""
        
        if cedula_pdf_base64 and cedula_medico:
            logger.info("[NODE] Validando PDF de cedula...")
            pdf_cedula_valido, texto_cedula = ProcesadorDocumentosPDF.validar_documento_cedula(
                cedula_pdf_base64, cedula_medico
            )
            logger.info(f"[NODE] PDF Cedula valido: {pdf_cedula_valido}")
        
        # Decidir que valores usar (priorizar los del PDF)
        sistolica_final = sistolica
        diastolica_final = diastolica
        
        if sistolica_pdf is not None and diastolica_pdf is not None:
            sistolica_final = sistolica_pdf
            diastolica_final = diastolica_pdf
            logger.info(f"[NODE] Usando valores del PDF: {sistolica_final}/{diastolica_final} mmHg")
        else:
            logger.info(f"[NODE] Usando valores del payload: {sistolica_final}/{diastolica_final} mmHg")
        
        # Usar el modelo global si existe
        global instancia_ia_global
        if instancia_ia_global:
            resultado_inferencia = instancia_ia_global.inferencia_paciente(
                edad=edad,
                sistolica=sistolica_final,
                diastolica=diastolica_final,
                medicamento=toma_medicamento
            )
        else:
            # Si no hay modelo entrenado, usar reglas basicas
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
        
        # ============================================================
        # REGISTRAR MEDICO PRIMERO (para evitar FOREIGN KEY constraint)
        # ============================================================
        logger.info(f"[NODE] Registrando medico con cedula: {cedula_medico}")
        texto_token = texto_cedula if texto_cedula else "Token generado para medico"
        GestorBaseDatosRelacional.registrar_o_actualizar_medico(cedula_medico, texto_token)
        
        # Guardar en base de datos (primero para obtener el folio)
        valores_texto = ""
        if valores_pdf:
            valores_texto = "|".join([f"{v['sistolica']}/{v['diastolica']}" for v in valores_pdf])
        
        datos_db = {
            "cedula_medico": cedula_medico,
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
        
        # ============================================================
        # GUARDAR PDFs EN EL SISTEMA DE ARCHIVOS
        # ============================================================
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
        
        # ACTUALIZAR rutas en la base de datos
        if ruta_cedula or ruta_diagnostico:
            conn = GestorBaseDatosRelacional.conectar()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    UPDATE expedientes 
                    SET ruta_pdf_cedula = ?, ruta_pdf_diagnostico = ?
                    WHERE id = ?
                """, (ruta_cedula, ruta_diagnostico, folio))
                conn.commit()
                logger.info(f"[DB_DAO] Rutas PDF actualizadas para folio #{folio}")
            except sqlite3.Error as e:
                logger.error(f"[DB_DAO] Error actualizando rutas PDF: {str(e)}")
            finally:
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
    """Procesa datos desde stdin (para payloads grandes)"""
    try:
        data = sys.stdin.read()
        payload = json.loads(data)
        return procesar_desde_json(payload)
    except Exception as e:
        return {
            "exitoso": False,
            "error": f"Error al procesar stdin: {str(e)}"
        }


@app.on_event("startup")
def arrancar_servicios_sistema():
    """
    Evento de inicializacion automatica al arrancar el servidor web.
    Configura la base de datos y entrena los 3 modelos de IA para competir.
    """
    global instancia_ia_global
    logger.info("=====================================================================")
    logger.info("   INICIALIZANDO MOTOR PRINCIPAL DE PERSISTENCIA E INTELIGENCIA ARTIFICIAL  ")
    logger.info("=====================================================================")
    
    # 1. Configurar Base de Datos SQLite Relacional
    GestorBaseDatosRelacional.inicializar_esquema()
    
    # 2. Intentar cargar el archivo historico para el entrenamiento de los 3 modelos
    try:
        if not os.path.exists(CSV_NAME):
            raise FileNotFoundError("El dataset historico de entrenamiento clinico no fue localizado.")
            
        logger.info(f"[STARTUP] Extrayendo variables de entrenamiento desde: {CSV_NAME}")
        df_historico = pd.read_csv(CSV_NAME).dropna()
        
        instancia_ia_global = PipelineInteligenciaArtificial(datos_entrada=df_historico)
        instancia_ia_global.ejecutar_entrenamiento_y_competencia()
        logger.info("[STARTUP] Pipeline de competencia tri-algoritmica cargado y listo en produccion.")
        
    except Exception as e:
        logger.critical(f"[STARTUP_CRITICAL] No se pudo leer el CSV. Iniciando con matriz sintetica de contingencia: {str(e)}")
        
        # Creacion de matriz de emergencia para garantizar que el servidor levante sin caidas de produccion
        datos_emergencia = pd.DataFrame([
            [55, 120, 80, 1, 0], [67, 185, 115, 0, 1],
            [40, 130, 85, 1, 0], [78, 190, 120, 0, 1],
            [35, 115, 75, 1, 0], [62, 175, 110, 0, 1],
            [48, 140, 90, 1, 0], [80, 200, 130, 0, 1],
            [50, 120, 80, 1, 0], [66, 180, 100, 0, 1]
        ], columns=['Edad', 'Sistolica', 'Diastolica', 'Toma_Medicamento', 'Crisis_Hipertensiva'])
        
        instancia_ia_global = PipelineInteligenciaArtificial(datos_entrada=datos_emergencia)
        instancia_ia_global.ejecutar_entrenamiento_y_competencia()


@app.get("/api/ia/salud-sistema", status_code=status.HTTP_200_OK)
def verificar_salud_servidor():
    """Endpoint de monitoreo y verificacion de estatus."""
    global instancia_ia_global
    return {
        "estatus_servicio": "Operando en Linea",
        "motor_ia_activo": instancia_ia_global.nombre_ganador if instancia_ia_global else "Ninguno",
        "persistencia_db": "Activa (SQLite)",
        "seguridad_pdf": "Activo (Reconocimiento Semantico + Extraccion de Valores)",
        "almacenamiento_pdf": f"Activo (Ruta: {PDF_STORAGE_PATH})",
        "version": "3.3.0"
    }


@app.get("/api/ia/obtener-pdf/{folio}")
def obtener_pdf_por_folio(folio: int):
    """
    Obtiene los PDFs asociados a un expediente por su folio
    """
    try:
        expediente = GestorBaseDatosRelacional.obtener_expediente_por_folio(folio)
        
        if not expediente:
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
        
        # Obtener PDFs como Base64
        pdf_cedula = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "cedula")
        pdf_diagnostico = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "diagnostico")
        
        return {
            "folio": folio,
            "fecha_consulta": expediente.get("fecha_consulta"),
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
    """
    Obtiene el ultimo analisis realizado por un medico especifico
    """
    try:
        expediente = GestorBaseDatosRelacional.obtener_ultimo_expediente_por_cedula(cedula_medico)
        
        if not expediente:
            raise HTTPException(status_code=404, detail="No hay analisis para esta cedula")
        
        folio = expediente.get("id")
        
        # Obtener PDFs como Base64
        pdf_cedula = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "cedula")
        pdf_diagnostico = GestorAlmacenamientoPDF.obtener_pdf_como_base64(folio, "diagnostico")
        
        return {
            "folio": folio,
            "fecha_consulta": expediente.get("fecha_consulta"),
            "cedula_medico": expediente.get("cedula_medico_fk"),
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
    """
    ENDPOINT REY DE LA ARQUITECTURA.
    
    Ejecuta en secuencia lineal:
      1. Parsing y validacion semantica del PDF de la Cedula del medico.
      2. Parsing, validacion y EXTRACCION DE VALORES REALES del PDF de Hipertension.
      3. Registro del medico en el catalogo de base de datos.
      4. Inferencia probabilistica con el mejor de los 3 modelos de ML.
      5. Consolidacion relacional del expediente y devolucion del folio unico.
      6. Almacenamiento persistente de los PDFs en el sistema de archivos.
    """
    global instancia_ia_global
    if not instancia_ia_global:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El motor analitico predictivo no se encuentra instanciado en el servidor."
        )

    # ----------------------------------------------------------------------
    # PASO 1: EXTRACCION Y VALIDACION DE CEDULA PROFESIONAL EN PDF
    # ----------------------------------------------------------------------
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

    # ----------------------------------------------------------------------
    # PASO 2: EXTRACCION, VALIDACION Y EXTRACCION DE VALORES DEL PDF CLINICO
    # ----------------------------------------------------------------------
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

    # ================================================================
    # DECISION: Usar valores del PDF si fueron encontrados
    # ================================================================
    sistolica_final = payload.sistolica
    diastolica_final = payload.diastolica
    valores_usados = "payload"
    
    if sistolica_pdf is not None and diastolica_pdf is not None:
        # Priorizar valores extraidos del PDF
        sistolica_final = sistolica_pdf
        diastolica_final = diastolica_pdf
        valores_usados = "pdf"
        logger.info(f"[API] Usando valores extraidos del PDF: {sistolica_final}/{diastolica_final} mmHg")
    else:
        logger.info(f"[API] Usando valores del payload: {sistolica_final}/{diastolica_final} mmHg")

    # ----------------------------------------------------------------------
    # PASO 3: REGISTRO/ACTUALIZACION DE ENTIDAD MEDICO EN BASE DE DATOS
    # ----------------------------------------------------------------------
    try:
        GestorBaseDatosRelacional.registrar_o_actualizar_medico(
            cedula=payload.cedula_medico,
            texto_cedula_token=texto_cedula_extraido
        )
    except DatabaseConnectionException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.mensaje)

    # ----------------------------------------------------------------------
    # PASO 4: CALCULO DE INFERENCIA PREDICTIVA CON EL ALGORITMO CAMPEON
    # ----------------------------------------------------------------------
    try:
        resultado_inferencia = instancia_ia_global.inferencia_paciente(
            edad=payload.edad,
            sistolica=sistolica_final,
            diastolica=diastolica_final,
            medicamento=payload.toma_medicamento
        )
    except MLModelException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.mensaje)

    # ----------------------------------------------------------------------
    # PASO 5: PERSISTENCIA COMPLETA DEL EXPEDIENTE ASOCIADO AL MEDICO
    # ----------------------------------------------------------------------
    try:
        # Preparar los valores extraidos del PDF como texto para almacenar
        valores_texto = ""
        if valores_pdf:
            valores_texto = "|".join([f"{v['sistolica']}/{v['diastolica']}" for v in valores_pdf])
        
        datos_para_base_datos = {
            "cedula_medico": payload.cedula_medico,
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

    # ----------------------------------------------------------------------
    # PASO 6: ALMACENAMIENTO PERSISTENTE DE PDFs
    # ----------------------------------------------------------------------
    try:
        ruta_cedula = ""
        ruta_diagnostico = ""
        
        # Guardar PDF de cedula
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
        
        # Guardar PDF de diagnostico
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
        
        # Actualizar rutas en la base de datos
        if ruta_cedula or ruta_diagnostico:
            conn = GestorBaseDatosRelacional.conectar()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    UPDATE expedientes 
                    SET ruta_pdf_cedula = ?, ruta_pdf_diagnostico = ?
                    WHERE id = ?
                """, (ruta_cedula, ruta_diagnostico, folio_transaccion))
                conn.commit()
                logger.info(f"[API] Rutas PDF actualizadas para folio #{folio_transaccion}")
            except sqlite3.Error as e:
                logger.error(f"[API] Error actualizando rutas PDF: {str(e)}")
            finally:
                conn.close()
                
    except Exception as e:
        logger.error(f"[API] Error en almacenamiento de PDFs: {str(e)}")

    # ----------------------------------------------------------------------
    # PASO 7: EMISION DEL EXPEDIENTE DIGITALIZADO DE RESPUESTA
    # ----------------------------------------------------------------------
    return {
        "folio_expediente_db": folio_transaccion,
        "cedula_pdf_valida": pdf_cedula_valido,
        "diagnostico_pdf_valido": pdf_diagnostico_valido,
        "prediccion_crisis": resultado_inferencia["prediccion_crisis"],
        "probabilidad_porcentual": resultado_inferencia["probabilidad_porcentual"],
        "nivel_riesgo_clinico": resultado_inferencia["nivel_riesgo_clinico"],
        "protocolo_sugerido": resultado_inferencia["protocolo_sugerido"],
        "motor_inferencia_usado": resultado_inferencia["motor_inferencia_usado"],
        "mensaje_almacenamiento": f"Expediente persistido exitosamente en SQLite. Folio de control asignado #{folio_transaccion}. Valores usados: {valores_usados}. PDFs almacenados en: {PDF_STORAGE_PATH}"
    }


# ==============================================================================
# HILO DE CONTROL DE INICIO DE LA COMPILACION (ENTRYPOINT)
# ==============================================================================
if __name__ == "__main__":
    # Verificar si se ejecuta con argumentos JSON desde Node.js
    if len(sys.argv) > 1 and sys.argv[1] == '--json':
        try:
            # Inicializar base de datos antes de procesar
            logger.info("[NODE] Inicializando esquema de base de datos...")
            GestorBaseDatosRelacional.inicializar_esquema()
            logger.info("[NODE] Esquema de base de datos inicializado.")
            
            payload = json.loads(sys.argv[2])
            resultado = procesar_desde_json(payload)
            print(json.dumps(resultado))
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
            # Inicializar base de datos antes de procesar
            logger.info("[NODE] Inicializando esquema de base de datos...")
            GestorBaseDatosRelacional.inicializar_esquema()
            logger.info("[NODE] Esquema de base de datos inicializado.")
            
            resultado = procesar_desde_stdin()
            print(json.dumps(resultado))
        except Exception as e:
            print(json.dumps({
                "exitoso": False,
                "error": str(e)
            }))
    else:
        # Modo normal (servidor FastAPI)
        logger.info("[SISTEMA_HOST] Lanzando el bucle de eventos del servidor ASGI Uvicorn...")
        uvicorn.run("hipertension_analyzer:app", host="0.0.0.0", port=8000)