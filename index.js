const express = require('express');
const db = require('./config/db');
require('dotenv').config();

const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();

app.use(cors());
app.use(express.json());

// =======================================
// CONFIGURACIÓN DE MULTER
// =======================================

const carpetaUploads = path.join(__dirname, 'uploads');

// Crear la carpeta si no existe
if (!fs.existsSync(carpetaUploads)) {
    fs.mkdirSync(carpetaUploads, { recursive: true });
}

const upload = multer({
    dest: carpetaUploads,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const extension = path.extname(
            file.originalname
        ).toLowerCase();

        if (extension === '.json' || extension === '.csv') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos JSON y CSV'));
        }
    }
});

// =======================================
// VERIFICAR FUNCIONAMIENTO DE LA API
// =======================================

app.get('/', (req, res) => {
    res.send('API REST funcionando correctamente');
});

// =======================================
// GET - CONSULTAR TODOS LOS PRODUCTOS
// =======================================

app.get('/productos', async (req, res) => {
    try {
        const [productos] = await db.query(
            'SELECT * FROM productos'
        );

        res.status(200).json(productos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar productos'
        });
    }
});

// =======================================
// GET - CONSULTAR PRODUCTO POR ID
// =======================================

app.get('/productos/:id', async (req, res) => {
    try {
        const [productos] = await db.query(
            'SELECT * FROM productos WHERE id = ?',
            [req.params.id]
        );

        if (productos.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.status(200).json(productos[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar producto'
        });
    }
});

// =======================================
// FUNCIÓN PARA VALIDAR PRODUCTOS
// =======================================

function validarProducto(producto) {
    return (
        producto !== null &&
        typeof producto === 'object' &&
        !Array.isArray(producto) &&
        typeof producto.nombre === 'string' &&
        producto.nombre.trim() !== '' &&
        typeof producto.precio === 'number' &&
        Number.isFinite(producto.precio) &&
        producto.precio >= 0 &&
        Number.isInteger(producto.stock) &&
        producto.stock >= 0
    );
}

// =======================================
// POST - REGISTRAR UN PRODUCTO
// =======================================

app.post('/productos', async (req, res) => {
    try {
        const { nombre, precio, stock } = req.body;

        if (!validarProducto({ nombre, precio, stock })) {
            return res.status(400).json({
                mensaje: 'Datos del producto inválidos'
            });
        }

        const [resultado] = await db.query(
            'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
            [nombre, precio, stock]
        );

        res.status(201).json({
            mensaje: 'Producto registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al registrar producto'
        });
    }
});

// =======================================
// PUT - ACTUALIZAR UN PRODUCTO
// =======================================

app.put('/productos/:id', async (req, res) => {
    try {
        const { nombre, precio, stock } = req.body;

        if (!validarProducto({ nombre, precio, stock })) {
            return res.status(400).json({
                mensaje: 'Datos del producto inválidos'
            });
        }

        const [resultado] = await db.query(
            `UPDATE productos
             SET nombre = ?, precio = ?, stock = ?
             WHERE id = ?`,
            [nombre, precio, stock, req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Producto actualizado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al actualizar producto'
        });
    }
});

// =======================================
// DELETE - ELIMINAR UN PRODUCTO
// =======================================

app.delete('/productos/:id', async (req, res) => {
    try {
        const [resultado] = await db.query(
            'DELETE FROM productos WHERE id = ?',
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.status(200).json({
            mensaje: 'Producto eliminado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al eliminar producto'
        });
    }
});

// =======================================
// FUNCIÓN PARA LEER ARCHIVOS CSV
// =======================================

function leerCSV(rutaArchivo) {
    return new Promise((resolve, reject) => {
        const registros = [];

        const archivo = fs.createReadStream(rutaArchivo);
        const parser = csv({
            strict: true,
            mapHeaders: ({ header }) => header.trim()
        });

        archivo.on('error', reject);
        parser.on('error', reject);

        parser.on('headers', (encabezados) => {
            const requeridos = ['nombre', 'precio', 'stock'];

            const correctos = requeridos.every(campo =>
                encabezados.includes(campo)
            );

            if (!correctos) {
                parser.destroy(
                    new Error('El CSV debe incluir nombre, precio y stock')
                );
            }
        });

        parser.on('data', (fila) => {
            // Evitar convertir campos vacíos en cero
            const precioTexto = String(fila.precio ?? '').trim();
            const stockTexto = String(fila.stock ?? '').trim();

            registros.push({
                nombre: fila.nombre,
                precio: precioTexto === ''
                    ? NaN
                    : Number(precioTexto),
                stock: stockTexto === ''
                    ? NaN
                    : Number(stockTexto)
            });
        });

        parser.on('end', () => resolve(registros));

        archivo.pipe(parser);
    });
}

// =======================================
// POST - IMPORTAR ARCHIVOS JSON Y CSV
// =======================================

app.post(
    '/api/recursos/importar',
    (req, res, next) => {
        upload.single('archivo')(req, res, (error) => {
            if (error) {
                if (error instanceof multer.MulterError) {
                    return res.status(400).json({
                        mensaje: 'Error al subir el archivo',
                        detalle: error.message
                    });
                }

                return res.status(400).json({
                    mensaje: error.message
                });
            }

            next();
        });
    },
    async (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                mensaje: 'No se ha enviado ningún archivo'
            });
        }

        const rutaArchivo = req.file.path;

        try {
            const extension = path.extname(
                req.file.originalname
            ).toLowerCase();

            let productos = [];

            // Procesar archivo JSON
            if (extension === '.json') {
                const contenido = await fs.promises.readFile(
                    rutaArchivo,
                    'utf8'
                );

                productos = JSON.parse(contenido);

            // Procesar archivo CSV
            } else if (extension === '.csv') {
                productos = await leerCSV(rutaArchivo);

            } else {
                return res.status(400).json({
                    mensaje: 'Formato de archivo no permitido'
                });
            }

            // Comprobar que existan registros
            if (!Array.isArray(productos) || productos.length === 0) {
                return res.status(400).json({
                    mensaje: 'El archivo no contiene productos válidos'
                });
            }

            // Validar todos los registros
            const productosValidos = productos.every(validarProducto);

            if (!productosValidos) {
                return res.status(400).json({
                    mensaje: 'El archivo contiene productos con datos inválidos'
                });
            }

            // Insertar registros mediante transacción
            const conexion = await db.getConnection();

            try {
                await conexion.beginTransaction();

                for (const producto of productos) {
                    await conexion.query(
                        `INSERT INTO productos
                         (nombre, precio, stock)
                         VALUES (?, ?, ?)`,
                        [
                            producto.nombre.trim(),
                            producto.precio,
                            producto.stock
                        ]
                    );
                }

                await conexion.commit();

            } catch (error) {
                await conexion.rollback();
                throw error;

            } finally {
                conexion.release();
            }

            return res.status(200).json({
                mensaje: 'Productos importados correctamente',
                formato: extension,
                registrosInsertados: productos.length
            });

        } catch (error) {
            console.error('Error al importar:', error);

            if (error instanceof SyntaxError) {
                return res.status(400).json({
                    mensaje: 'El archivo JSON tiene un formato incorrecto'
                });
            }

            if (
                error.message.includes('CSV') ||
                error.message.includes('column')
            ) {
                return res.status(400).json({
                    mensaje: 'El archivo CSV tiene un formato incorrecto'
                });
            }

            return res.status(500).json({
                mensaje: 'Error al procesar el archivo'
            });

        } finally {
            // Eliminar el archivo temporal
            try {
                await fs.promises.unlink(rutaArchivo);
            } catch (error) {
                console.error(
                    'No se pudo eliminar el archivo temporal:',
                    error.message
                );
            }
        }
    }
);

 
 // =======================================
 // GET - EXPORTAR PRODUCTOS EN JSON
 // =======================================

app.get('/api/recursos/exportar/json', async (req, res) => {
    try {
        // Consultar todos los productos
        const [productos] = await db.query(
            'SELECT * FROM productos'
        );

        // Configurar la descarga del archivo JSON
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="datos_exportados.json"'
        );

        res.setHeader(
            'Content-Type',
            'application/json; charset=utf-8'
        );

        // Enviar los registros en formato JSON
        res.status(200).json(productos);

    } catch (error) {
        console.error('Error al exportar JSON:', error);

        res.status(500).json({
            mensaje: 'Error al exportar productos en JSON'
        });
    }
});

// =======================================
// GET - EXPORTAR PRODUCTOS EN CSV
// =======================================

app.get('/api/recursos/exportar/csv', async (req, res) => {
    try {
        // Consultar todos los productos
        const [productos] = await db.query(
            'SELECT * FROM productos'
        );

        // Crear encabezados del archivo CSV
        let csvData = 'id,nombre,precio,stock\r\n';

        // Convertir los registros al formato CSV
        productos.forEach(producto => {
            // Escapar las comillas del nombre
            const nombre = String(producto.nombre)
                .replace(/"/g, '""');

            // Agregar cada producto al archivo
            csvData += `${producto.id},"${nombre}",${producto.precio},${producto.stock}\r\n`;
        });

        // Configurar el tipo de contenido
        res.setHeader(
            'Content-Type',
            'text/csv; charset=utf-8'
        );

        // Configurar la descarga del archivo
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="datos_exportados.csv"'
        );

        // Enviar los datos en formato CSV
        res.status(200).send('\uFEFF' + csvData);

    } catch (error) {
        console.error('Error al exportar CSV:', error);

        res.status(500).json({
            mensaje: 'Error al exportar productos en CSV'
        });
    }
});

// =======================================
// INICIAR SERVIDOR Y VERIFICAR MYSQL
// =======================================

async function iniciarServidor() {
    try {
        // Verificar conexión con MySQL
        const conexion = await db.getConnection();

        console.log('Conectado exitosamente a MySQL');

        conexion.release();

        // Configurar el puerto del servidor
        const puerto = process.env.PORT || 3000;

        // Iniciar Express
        app.listen(puerto, () => {
            console.log(
                `Servidor ejecutándose en http://localhost:${puerto}`
            );
        });

    } catch (error) {
        console.error(
            'Error de conexión:',
            error.message
        );

        process.exit(1);
    }
}

// Ejecutar el servidor
iniciarServidor();
