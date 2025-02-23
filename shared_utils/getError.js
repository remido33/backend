
const getError = (status, message, rest) => ({
    error: {
        timestamp: Date.now(),
        status: parseInt(status || 500),
        message: message,
        ...rest,
    }
});

module.exports = getError;