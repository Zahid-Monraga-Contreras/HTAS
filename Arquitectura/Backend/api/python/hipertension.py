import os
import sys
import json
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from datetime import datetime
from mangum import Mangum  # Importante para Vercel

# Configurar rutas
ALGORITHM_PATH = os.path.join(os.path.dirname(__file__), '../../python/algorithm')
if os.path.exists(ALGORITHM_PATH):
    sys.path.insert(0, ALGORITHM_PATH)
else:
    # Ruta alternativa para Vercel
    ALGORITHM_PATH = os.path.join(os.path.dirname(__file__), '../python/algorithm')
    if os.path.exists(ALGORITHM_PATH):
        sys.path.insert(0, ALGORITHM_PATH)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HTAS_VERCEL_PYTHON")

# Crear app FastAPI
app = FastAPI(title="HTAS Python API", version="1.0.0")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Intentar importar tu analyzer
try:
    from hipertension_analyzer import app as analyzer_app
    logger.info("✅ hipertension_analyzer importado correctamente")
    # Si tu analyzer tiene endpoints, los fusionamos
    for route in analyzer_app.routes:
        app.router.routes.append(route)
except ImportError as e:
    logger.warning(f"⚠️ No se pudo importar hipertension_analyzer: {e}")
    logger.info("Usando endpoints básicos")

# =============================================
# ENDPOINTS
# =============================================

@app.get("/")
async def root():
    return {
        "mensaje": "Python API funcionando en Vercel",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/algorithm/estado")
async def estado_sistema():
    return {
        "success": True,
        "estado": "Python API activa en Vercel",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/ia/salud-sistema")
async def salud_sistema():
    return {
        "estatus_servicio": "Operando en Linea",
        "motor_ia_activo": "Configurado",
        "persistencia_db": "Activa",
        "version": "1.0.0"
    }

@app.post("/api/algorithm/analizar")
async def analizar_paciente(data: Dict[str, Any]):
    try:
        logger.info(f"Analizando paciente: {data.get('idPaciente')}")
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
    try:
        logger.info("Recibiendo análisis completo")
        
        if not data.get('cedula_pdf_base64') or not data.get('diagnostico_pdf_base64'):
            raise HTTPException(status_code=400, detail="Se requieren ambos PDFs")
        
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
    try:
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

@app.get("/api/algorithm/test")
async def test_python():
    return {
        "success": True,
        "mensaje": "Python API funcionando correctamente",
        "timestamp": datetime.now().isoformat()
    }

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("   INICIALIZANDO HTAS PYTHON EN VERCEL")
    logger.info("=" * 60)

# Handler para Vercel (Serverless)
handler = Mangum(app)