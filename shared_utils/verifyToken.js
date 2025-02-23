const jwt = require('jsonwebtoken');
const getError = require('./getError');

const verifyToken = (req, res, next) => {

    // check stores list and compare to called :storeId param if it exists then pass user.
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return next(getError(401, 'No token provided.'));
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return next(getError(401, 'Invalid or expired token.'));
        }
        req.user = decoded;
        next();
    });
};

const verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return next(getError(401, 'No token provided.'));
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return next(getError(401, 'Invalid or expired token.'));
        }
        
        if (!decoded.admin) {
            return next(getError(403, 'Access denied.'));
        }

        req.user = decoded;
        next();
    });
};

module.exports = {
    verifyToken,
    verifyAdminToken,
};
