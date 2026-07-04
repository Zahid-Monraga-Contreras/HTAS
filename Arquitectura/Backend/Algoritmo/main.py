# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib

app = FastAPI(
    title="API de Monitoreo HTAS",
    description="API con validación de rangos clínicos para la detección de crisis hipertensivas.",
    version="2.0.0"
)

# Cargar el modelo .pkl
modelo = joblib.load('mejor_modelo_htas.pkl')

class DatosPaciente(BaseModel):
    Edad: int = Field(..., ge=0, le=120)
    Sistolica: int = Field(..., ge=40, le=260)
    Diastolica: int = Field(..., ge=30, le=150)
    Toma_Medicamento: int = Field(..., ge=0, le=1)

@app.post("/predecir_crisis")
def predecir_crisis(datos: DatosPaciente):
    if datos.Sistolica <= datos.Diastolica:
        raise HTTPException(
            status_code=400, 
            detail="Error clínico: La presión sistólica no puede ser menor o igual a la diastólica."
        )
        
    datos_df = [[datos.Edad, datos.Sistolica, datos.Diastolica, datos.Toma_Medicamento]]
    prediccion = int(modelo.predict(datos_df)[0])
    probabilidad = float(modelo.predict_proba(datos_df)[0][1])
    
    alerta = "ALTA: Riesgo de crisis." if prediccion == 1 else "NORMAL: Estable."
    
    return {
        "crisis_detectada": prediccion,
        "probabilidad_riesgo": f"{probabilidad * 100:.2f}%",
        "alerta_clinica": alerta
    }

if __name__ == "__main__":
    import uvicorn
    # Corre en el puerto 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)