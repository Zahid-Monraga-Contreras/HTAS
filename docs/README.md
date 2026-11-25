# 📁 Documentación Técnica — Proyecto HTAS

Esta carpeta (`docs/`) contiene la documentación técnica del proyecto **HTAS (Hipertensión Arterial Sistémica)** en formato Word (`.docx`). Todos los documentos incluyen la portada institucional de la UTCV y no tienen encabezados ni pies de página.

Los paquetes de despliegue y el lanzador para Windows se encuentran en la carpeta [`releases/`](../releases/).

---

## 📑 Documentos Word (.docx)

1. **[`01_Historial_de_Versiones_HTAS.docx`](01_Historial_de_Versiones_HTAS.docx)**

   - **Contenido:** matriz de control de versiones y detalle de cada etapa de desarrollo. Las fechas provienen del historial de commits; solo v1.0.0 (29/09/2026) existe como etiqueta en git, y las versiones 0.1.0 a 0.3.0 se describen como etapas de desarrollo. Incluye además los cambios posteriores a v1.0.0 y una nota sobre verificación y calidad.
2. **[`02_Guia_Instalacion_y_Ejecucion_HTAS.docx`](02_Guia_Instalacion_y_Ejecucion_HTAS.docx)**

   - **Contenido:** requisitos previos (Node.js, npm, Python, Angular CLI, Git y PostgreSQL), clonación del repositorio, instalación de dependencias del backend, del microservicio de IA y del frontend, configuración del archivo `.env` con valores de ejemplo, carga del esquema `sql/bd_htas.sql`, ejecución en modo desarrollo (puertos 8000, 3000 y 4200) y uso de los scripts `build.ps1` y `build.bat`.
3. **[`03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.docx`](03_Paquetes_de_Despliegue_y_Ejecutables_HTAS.docx)**

   - **Contenido:** arquitectura de despliegue, inventario de los paquetes de `releases/`, publicación del backend en Vercel, del frontend en Firebase Hosting, del microservicio de IA en Render y de la base de datos en Neon, e instrucciones de uso del lanzador `HTAS-Ejecutable-Lanzador.bat`.
4. **[`Documentacion_Integral_HTAS.docx`](Documentacion_Integral_HTAS.docx)**

   - **Contenido:** documento técnico unificado que reúne, en tres secciones, el contenido de los tres documentos anteriores.
