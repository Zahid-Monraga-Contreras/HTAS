import sqlite3
import os

# Ruta de la base de datos (en la misma carpeta)
db_path = os.path.join(os.path.dirname(__file__), 'clinica_htas_mexico.db')

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Verificar si la columna existe
    cursor.execute("PRAGMA table_info(expedientes)")
    columnas = [col[1] for col in cursor.fetchall()]
    
    if 'ruta_pdf_cedula' not in columnas:
        cursor.execute("ALTER TABLE expedientes ADD COLUMN ruta_pdf_cedula TEXT")
        print("Columna ruta_pdf_cedula agregada correctamente")
    else:
        print("Columna ruta_pdf_cedula ya existe")
    
    if 'ruta_pdf_diagnostico' not in columnas:
        cursor.execute("ALTER TABLE expedientes ADD COLUMN ruta_pdf_diagnostico TEXT")
        print("Columna ruta_pdf_diagnostico agregada correctamente")
    else:
        print("Columna ruta_pdf_diagnostico ya existe")
    
    conn.commit()
    
    # Mostrar todas las columnas
    cursor.execute("PRAGMA table_info(expedientes)")
    print("\nColumnas de la tabla expedientes:")
    for col in cursor.fetchall():
        print(f"  {col[1]}")
    
    conn.close()
    print("\nBase de datos actualizada correctamente")

except Exception as e:
    print(f"Error: {e}")