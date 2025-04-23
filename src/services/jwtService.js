const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '123'; 

/**
 * Gera um token JWT para o usuário.
 * @param {Object} payload - Os dados que serão incluídos no token.
 * @param {string} payload.id - O ID do usuário.
 * @param {string} payload.email - O email do usuário.
 * @param {string} payload.nome - O nome do usuário.
 * @returns {string} - O token JWT gerado.
 */
const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

module.exports = { generateToken };
