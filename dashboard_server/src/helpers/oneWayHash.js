const crypto = require('crypto');

const oneWayHash = (value) => {
    return crypto.createHmac('sha256', process.env.ONE_WAY_HASH_KEY)
        .update(value)
        .digest('hex');
}

module.exports = oneWayHash;