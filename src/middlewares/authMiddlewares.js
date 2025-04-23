const jwt = require('jsonwebtoken');
const { ERROR_MESSAGES, HTTP_STATUS_CODES } = require('../utils/enum');

const authenticateUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res
            .status(HTTP_STATUS_CODES.UNAUTHORIZED)
            .json({ message: ERROR_MESSAGES.TOKEN_REQUIRED });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res
            .status(HTTP_STATUS_CODES.UNAUTHORIZED)
            .json({ message: ERROR_MESSAGES.INVALID_TOKEN });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res
            .status(HTTP_STATUS_CODES.UNAUTHORIZED)
            .json({ message: ERROR_MESSAGES.INVALID_TOKEN });
    }
};

module.exports = authenticateUser;
