# Backend/api/python/hipertension.py
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Agregar ruta de tu script Python
sys.path.append(os.path.join(os.path.dirname(__file__), '../../python/algorithm'))

# Importar tu app de FastAPI existente
try:
    from hipertension_analyzer import app as fastapi_app
    print("FastAPI importado correctamente")
except ImportError as e:
    print(f"Error: {e}")
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

# Endpoints de prueba (si tu app no los tiene)
@app.get("/api/algorithm/estado")
async def estado():
    return {
        "success": True,
        "estado": "Python API activa en Vercel",
        "version": "3.3.0"
    }