
const errorHandler = (error, req, res, next) => {
    const status = error?.error?.status;
    return res.status(parseInt(status) || 500).json(error || 'Internal server error');
};

module.exports = errorHandler;