const express = require('express');

const app = express();
const PORT = 3000;

// Middleware para recibir JSON
app.use(express.json());

// Arreglo en memoria para almacenar productos
let productos = [
    { id: 1, nombre: "Laptop", precio: 15000 },
    { id: 2, nombre: "Mouse", precio: 250 },
    { id: 3, nombre: "Teclado", precio: 500 }
];

// Control para generar identificadores únicos
let siguienteId = 4;

// Ruta principal
app.get('/', (req, res) => {
    res.send('Servidor API REST funcionando correctamente');
});

// GET: Obtener todos los productos
app.get('/api/recursos', (req, res) => {
    res.status(200).json(productos);
});

// GET: Obtener un producto por ID
app.get('/api/recursos/:id', (req, res) => {
    const id = Number(req.params.id);

    const producto = productos.find(p => p.id === id);

    if (!producto) {
        return res.status(404).json({
            mensaje: "Producto no encontrado"
        });
    }

    res.status(200).json(producto);
});

// POST: Crear un producto
app.post('/api/recursos', (req, res) => {
    const { nombre, precio } = req.body || {};

    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0
    ) {
        return res.status(400).json({
            mensaje: "Nombre y precio válidos son obligatorios"
        });
    }

    const nuevoProducto = {
        id: siguienteId++,
        nombre: nombre.trim(),
        precio
    };

    productos.push(nuevoProducto);

    res.status(201).json(nuevoProducto);
});

// PUT: Actualizar un producto
app.put('/api/recursos/:id', (req, res) => {
    const id = Number(req.params.id);
    const { nombre, precio } = req.body || {};

    const producto = productos.find(p => p.id === id);

    if (!producto) {
        return res.status(404).json({
            mensaje: "Producto no encontrado"
        });
    }

    if (
        typeof nombre !== 'string' ||
        !nombre.trim() ||
        typeof precio !== 'number' ||
        !Number.isFinite(precio) ||
        precio < 0
    ) {
        return res.status(400).json({
            mensaje: "Nombre y precio válidos son obligatorios"
        });
    }

    producto.nombre = nombre.trim();
    producto.precio = precio;

    res.status(200).json(producto);
});

// DELETE: Eliminar un producto
app.delete('/api/recursos/:id', (req, res) => {
    const id = Number(req.params.id);

    const indice = productos.findIndex(p => p.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: "Producto no encontrado"
        });
    }

    productos.splice(indice, 1);

    res.status(200).json({
        mensaje: "Producto eliminado correctamente"
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
