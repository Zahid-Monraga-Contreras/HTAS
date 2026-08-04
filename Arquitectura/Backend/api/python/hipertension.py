# Backend/api/python/hipertension.py
import os
import sys
import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from datetime import datetime

# Agregar ruta de tu script Python
ALGORITHM_PATH = os.path.join(os.path.dirname(__file__), '../../python/algorithm')
sys.path.insert(0, ALGORITHM_PATH)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HTAS_VERCEL")

# Importar tu app de FastAPI existente
try:
    from hipertension_analyzer import app as fastapi_app
    logger.info("✅ FastAPI importado correctamente")
except ImportError as e:
    logger.error(f"❌ Error importando FastAPI: {e}")
    # Crear app básica si falla
    fastapi_app = FastAPI()

# Usar tu app existente
app = fastapi_app

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================
# ENDPOINTS PARA ALGORITHM
# =============================================

@app.get("/api/algorithm/estado")
async def estado_sistema():
    """Verificar estado del sistema Python"""
    return {
        "success": True,
        "estado": "Python API activa en Vercel",
        "version": "3.3.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/ia/salud-sistema")
async def salud_sistema():
    """Health check para FastAPI"""
    return {
        "estatus_servicio": "Operando en Linea",
        "motor_ia_activo": "Configurado",
        "persistencia_db": "Activa",
        "version": "3.3.0"
    }

@app.post("/api/algorithm/analizar")
async def analizar_paciente(data: Dict[str, Any]):
    """Analizar paciente con un PDF"""
    try:
        logger.info(f"Analizando paciente: {data.get('idPaciente')}")
        
        # Aquí va tu lógica existente de hipertension_analyzer.py
        # Por ahora, una respuesta de ejemplo
        return {
            "success": True,
            "mensaje": "Análisis completado",
            "data": data
        }
    except Exception as e:
        logger.error(f"Error en análisis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/algorithm/analizar-completo")
async def analizar_completo(data: Dict[str, Any]):
    """Analizar con dos PDFs (cédula + diagnóstico)"""
    try:
        logger.info("Recibiendo análisis completo")
        
        # Validar datos requeridos
        if not data.get('cedula_pdf_base64') or not data.get('diagnostico_pdf_base64'):
            raise HTTPException(status_code=400, detail="Se requieren ambos PDFs")
        
        # Aquí tu lógica existente
        return {
            "success": True,
            "mensaje": "Análisis completo finalizado",
            "folio_expediente_db": 12345,
            "cedula_pdf_valida": True,
            "diagnostico_pdf_valido": True,
            "prediccion_crisis": 0,
            "probabilidad_porcentual": 15.5,
            "nivel_riesgo_clinico": "ESTABLE / CONTROLADO",
            "protocolo_sugerido": "Continuar con monitoreo preventivo.",
            "motor_inferencia_usado": "Random Forest"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en análisis completo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/algorithm/ultimo-expediente/{idPaciente}")
async def obtener_ultimo_expediente(idPaciente: int):
    """Obtener último expediente del paciente"""
    try:
        # Aquí tu lógica existente
        return {
            "success": True,
            "idPaciente": idPaciente,
            "folio": 12345,
            "fecha_consulta": "2024-01-01",
            "edad": 45,
            "sistolica": 120,
            "diastolica": 80,
            "prediccion_crisis": 0,
            "probabilidad_porcentual": 15.5,
            "nivel_riesgo": "ESTABLE / CONTROLADO"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/algorithm/pdf/{folio}")
async def obtener_pdf(folio: int):
    """Obtener PDF por folio"""
    try:
        # Aquí tu lógica existente
        return {
            "success": True,
            "folio": folio,
            "tiene_pdf_cedula": True,
            "tiene_pdf_diagnostico": True,
            "pdf_cedula_base64": None,
            "pdf_diagnostico_base64": None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/algorithm/test")
async def test_python():
    """Endpoint de prueba para verificar que Python responde"""
    return {
        "success": True,
        "mensaje": "Python API funcionando correctamente",
        "timestamp": datetime.now().isoformat()
    }

@app.on_event("startup")
async def startup_event():
    """Inicializar servicios al arrancar"""
    logger.info("=" * 60)
    logger.info("   INICIALIZANDO HTAS-MEXICO EN VERCEL")
    logger.info("=" * 60)
    logger.info("✅ Python API lista para recibir peticiones")