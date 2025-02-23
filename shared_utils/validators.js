const getError = require('./getError');

const isStringOfNumbersSeparatedByComma = (value) => {
    const regex = /^\d+(,\d+)*$/;
    if (!regex.test(value)) {
        throw getError(400, 'Value must be a string of numbers separated by commas.');
    }
    return true;
};

const isEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(value)) {
        throw getError(400, 'Invalid email format.');
    }
    return true;
};

module.exports = {
    isEmail,
    isStringOfNumbersSeparatedByComma,
};
