# adaptar_dataset.py
import pandas as pd
import numpy as np
import os

def adaptar_dataset_heart():
    """
    Adapta el dataset heart.csv al formato requerido por HTAS-MEXICO
    """
    print("="*60)
    print("ADAPTANDO DATASET HEART.CSV PARA HTAS-MEXICO")
    print("="*60)
    
    # Construir ruta correcta
    ruta_actual = os.path.dirname(os.path.abspath(__file__))
    ruta_original = os.path.join(ruta_actual, "dataset", "heart.csv")
    
    print(f"Buscando archivo en: {ruta_original}")
    
    if not os.path.exists(ruta_original):
        print(f"ERROR: No se encuentra el archivo en: {ruta_original}")
        return
    
    # 1. Cargar el dataset original
    df = pd.read_csv(ruta_original)
    
    print(f"\nDataset original cargado: {len(df)} registros")
    print(f"Columnas originales: {df.columns.tolist()}")
    
    # 2. Crear el nuevo DataFrame con las columnas requeridas
    df_adaptado = pd.DataFrame()
    
    # Edad: usar 'age'
    df_adaptado['Edad'] = df['age']
    print("Edad mapeada desde 'age'")
    
    # Sistolica: usar 'trestbps' (presion arterial en reposo)
    df_adaptado['Sistolica'] = df['trestbps']
    print("Sistolica mapeada desde 'trestbps'")
    
    # Diastolica: No existe directamente en heart.csv
    # La estimamos usando una relacion realista con la sistolica
    # Diastolica ≈ Sistolica * 0.6 + 10 (relacion comun en cardiologia)
    df_adaptado['Diastolica'] = (df['trestbps'] * 0.6 + 10).astype(int)
    df_adaptado['Diastolica'] = df_adaptado['Diastolica'].clip(50, 130)
    print("Diastolica estimada a partir de la sistolica (relacion 0.6 + 10)")
    
    # Toma_Medicamento: No existe en heart.csv
    # Generamos aleatoriamente basado en edad y presion (30% de probabilidad)
    np.random.seed(42)
    # Los pacientes con presion mas alta tienen mas probabilidad de tomar medicamento
    probabilidad_med = 0.2 + (df_adaptado['Sistolica'] - 120) / 300
    probabilidad_med = probabilidad_med.clip(0.1, 0.7)
    df_adaptado['Toma_Medicamento'] = np.random.random(len(df)) < probabilidad_med
    df_adaptado['Toma_Medicamento'] = df_adaptado['Toma_Medicamento'].astype(int)
    print("Toma_Medicamento generado basado en edad y presion arterial")
    
    # Crisis_Hipertensiva: Usar 'target' (enfermedad cardiaca) como proxy
    # En heart.csv, target indica enfermedad cardiaca, que esta relacionada con hipertension
    df_adaptado['Crisis_Hipertensiva'] = df['target']
    print("Crisis_Hipertensiva mapeada desde 'target' (enfermedad cardiaca)")
    
    # 3. Guardar el dataset adaptado en la carpeta algorithm
    ruta_salida = os.path.join(ruta_actual, "Hipertension_Arterial_Mexico.csv")
    df_adaptado.to_csv(ruta_salida, index=False)
    
    print("\n" + "="*60)
    print("DATASET ADAPTADO GUARDADO EXITOSAMENTE")
    print("="*60)
    print(f"Archivo: {ruta_salida}")
    print(f"Registros: {len(df_adaptado)}")
    print("\nPrimeras 5 filas del dataset adaptado:")
    print(df_adaptado.head())
    
    print("\nEstadisticas del dataset adaptado:")
    print(df_adaptado.describe())
    
    print("\nDistribucion de Crisis_Hipertensiva:")
    print(df_adaptado['Crisis_Hipertensiva'].value_counts())
    
    print("\nCorrelacion entre variables:")
    print(df_adaptado.corr()['Crisis_Hipertensiva'].sort_values(ascending=False))
    
    return df_adaptado

if __name__ == "__main__":
    adaptar_dataset_heart()