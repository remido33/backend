const jwt = require('jsonwebtoken');
const getError = require('./getError');

const verifyToken = (req, res, next) => {

    const { id: storeId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return next(getError(401, 'No token provided.'));
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return next(getError(401, 'Invalid or expired token.'));
        }
        if(!decoded.storeIds.includes(parseInt(storeId))) {
            return next(getError(401, 'No rights for this store.'))
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
