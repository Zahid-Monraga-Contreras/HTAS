# verificar_dataset.py
import pandas as pd

# Cargar el dataset
ruta_dataset = "dataset/heart.csv"
df = pd.read_csv(ruta_dataset)

print("COLUMNAS DISPONIBLES:")
print(df.columns.tolist())
print("\n" + "="*50)
print("PRIMERAS 5 FILAS:")
print(df.head())
print("\n" + "="*50)
print("ESTADÍSTICAS BÁSICAS:")
print(df.describe())