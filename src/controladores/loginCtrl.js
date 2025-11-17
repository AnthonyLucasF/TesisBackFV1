import { conmysql } from "../db.js";
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

/* export const validarsesion = async (req, res) => {
    try {
        const { usuario_usuario, usuario_clave } = req.body;

        const [usuarios] = await conmysql.query('SELECT * FROM usuario WHERE usuario_usuario=?', [usuario_usuario]);

        if (usuarios.length === 0) {
            return res.status(404).json({ message: 'El Usuario no está registrado' });
        }

        const usuario = usuarios[0];

        if (usuario.usuario_clave !== usuario_clave) {
            return res.status(401).json({ message: 'Contraseña incorrecta.' });
        }

        res.status(200).json({
            message: 'Inicio de sesión exitoso',
            usuario: {
                id: usuario.id,
                email: usuario.usuario_cedula,
                nombre: usuario.usuario_nombre,
                avatar: usuario.usuario_usuario,
                estado: usuario.usuario_clave,
                estado: usuario.usuario_estado,
                estado: usuario.usuario_rol
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
}; */

export const validarsesion = async (req, res) => {
    try {
        const { usuario_usuario, usuario_clave } = req.body;

        const [usuarios] = await conmysql.query(
            'SELECT * FROM usuario WHERE usuario_usuario=? AND usuario_estado="activo"',
            [usuario_usuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ message: 'Usuario no registrado o inactivo' });
        }

        const usuario = usuarios[0];

        // Comparar clave (después de migrar a bcrypt)
        const esValido = await bcryptjs.compare(usuario_clave, usuario.usuario_clave);

        if (!esValido) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // Crear el token
        const token = jwt.sign({
            id: usuario.usuario_id,
            rol: usuario.usuario_rol,
            nombre: usuario.usuario_nombre
        }, 'secretkey', { expiresIn: '1d' });

        res.status(200).json({
            message: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id: usuario.usuario_id,
                cedula: usuario.usuario_cedula,
                nombre: usuario.usuario_nombre,
                usuario: usuario.usuario_usuario,
                estado: usuario.usuario_estado,
                rol: usuario.usuario_rol
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// SELECT: Obtener todos los registros
export const getUsuario =
    async (req, res) => {
        try {
            const [result] = await conmysql.query('SELECT * FROM usuario');
            res.json(result);
        } catch (error) {
            return res.status(500).json({ message: "Error al consultar Usuarios" });
        }
    };

// SELECT por ID
export const getUsuarioxid =
    async (req, res) => {
        try {
            const [result] = await conmysql.query('SELECT * FROM usuario WHERE usuario_id=?', [req.params.id]);
            if (result.length <= 0) return res.status(404).json({
                chofer_id: 0,
                message: "Usuario no encontrado"
            });
            res.json(result[0]);
        } catch (error) {
            return res.status(500).json({ message: "Error del Servidor" });
        }
    };

// INSERT: Crear un nuevo registro
export const postUsuario =
    async (req, res) => {
        try {
            const { usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol } = req.body;
            //const imagen = req.file ? `/uploads/${req.file.filename}` : null;

            const [rows] = await conmysql.query(
                `INSERT INTO usuario 
                    (usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol]
            );

            res.json({
                id: rows.insertId,
                message: "Usuario registrado con éxito"
            });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };

// UPDATE: Actualizar un registro completo
export const putUsuario =
    async (req, res) => {
        try {
            const { id } = req.params;
            const { usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol } = req.body;

            const [result] = await conmysql.query(
                `UPDATE usuario SET 
                    usuario_cedula=?, usuario_nombre=?, usuario_usuario=?, usuario_clave=?, usuario_estado=?, usuario_rol=? 
                WHERE usuario_id = ?`,
                [usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol, id]
            );

            if (result.affectedRows <= 0) return res.status(404).json({ message: "Usuario no encontrado" });

            const [rows] = await conmysql.query('SELECT * FROM usuario WHERE usuario_id=?', [id])

            res.json({
                success: true,
                message: "Usuario registrado con éxito",
                data: { id: rows.insertId }
            });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };

// UPDATE parcial: Actualizar algunos campos
export const pathUsuario =
    async (req, res) => {
        try {
            const { id } = req.params;
            const { usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol } = req.body;

            const [result] = await conmysql.query(
                `UPDATE usuario SET 
                    usuario_cedula = IFNULL(?, usuario_cedula), 
                    usuario_nombre = IFNULL(?, usuario_nombre), 
                    usuario_usuario = IFNULL(?, usuario_usuario), 
                    usuario_clave = IFNULL(?, usuario_clave), 
                    usuario_estado = IFNULL(?, usuario_estado), 
                    usuario_rol = IFNULL(?, usuario_rol)
                WHERE usuario_id=?`,
                [usuario_cedula, usuario_nombre, usuario_usuario, usuario_clave, usuario_estado, usuario_rol, id]
            );

            if (result.affectedRows <= 0) return res.status(404).json({ message: "Usuario no encontrado" });

            const [rows] = await conmysql.query('SELECT * FROM usuario WHERE usuario_id=?', [id])

            res.json({ message: "Usuario actualizado parcialmente" });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };


// DELETE: Eliminar un registro
export const deleteUsuario =
    async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await conmysql.query('DELETE FROM usuario WHERE usuario_id=?', [id]);

            if (rows.affectedRows <= 0) return res.status(404).json({
                id: 0,
                message: "Usuario no encontrado"
            });

            res.status(202).json({ message: "Usuario eliminado con éxito" });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    };
