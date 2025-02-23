const getError = require("./getError");

const validateParams = (params) => async (req, res, next) => {
    const missingParams = [];

    for (const param of params) {
        const { key, value, type, defaultValue, validate } = param;
        let paramValue;

        if (key === 'param') {
            paramValue = req.params[value];
        } else if (key === 'query') {
            paramValue = req.query[value];
            // Convert query parameters to numbers if the type is 'number'
            if (type === 'number' && paramValue !== undefined) {
                paramValue = Number(paramValue);
            }
        } else if (key === 'body' && req.body) {
            paramValue = req.body[value];
        } else if (key === 'headers' && req.headers) {
            paramValue = req.headers[value];
        } else {
            paramValue = undefined;
        }

        // Apply default value if the parameter is missing
        if (paramValue === undefined && defaultValue !== undefined) {
            paramValue = defaultValue;
        }

        // Custom validation function
        if (validate && typeof validate === 'function') {
            try {
                const valid = await validate(paramValue, req);
                
                if(!valid) {
                    if(!paramValue) {
                        return next(getError(400, `Missing {${value}} in req.${key}.`));
                    }
                    return next(getError(400, `Validation for {${key}}:{${value}} failed. Make sure data passed correctly.`));
                }
            } catch (err) {
                // If validation fails, forward the error to the next middleware
                return next(getError(500, 'Validation threw an error.'));
            }
        }

        if (paramValue === undefined) {
            missingParams.push(`${value} at ${key}`);
        } else if (type && typeof paramValue !== type) {
            missingParams.push(`${value} at ${key} (invalid type)`);
        } else if (type === 'number' && isNaN(paramValue)) {
            missingParams.push(`${value} at ${key} (not a valid number)`);
        }
    }

    if (missingParams.length > 0) {
        const errorMessages = `Missing parameter(s): ${missingParams.join(', ')}`;
        return next(getError(400, errorMessages));  // Forward missing param error to next middleware
    }

    next();  // Proceed if no errors
};

module.exports = validateParams;
