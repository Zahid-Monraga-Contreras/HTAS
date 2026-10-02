const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Metadatos básicos sobre nuestra API
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'HTAS API',
            version: '1.0.0',
            description: 'Documentación de la API de HTAS (Hipertensión Arterial Sistémica)',
            contact: {
                name: 'Soporte HTAS'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor Local'
            },
            {
                url: 'https://htas-backend.vercel.app',
                description: 'Servidor de Producción'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    // Rutas a los archivos con las anotaciones de Swagger
    apis: ['./src/routes/*.js', './src/app.js'],
};

// Formato JSON
const swaggerSpec = swaggerJSDoc(options);

// Opciones para asegurar que Swagger UI cargue sus archivos estaticos en Vercel (Serverless)
const swaggerUiOptions = {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js'
    ],
    customSiteTitle: "HTAS API Docs"
};

// Función para configurar nuestra documentación
const swaggerDocs = (app, port) => {
    // Ruta para acceder a la documentación
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

    // Ruta para tener la documentación en formato JSON
    app.get('/api/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    console.log(`Documentación de la API disponible en http://localhost:${port}/api/docs`);
};

module.exports = swaggerDocs;
