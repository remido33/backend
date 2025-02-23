const crypto = require('crypto');
const getError = require("./getError");

const algorithm = process.env.ENCRYPTION_ALGORITHM;
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');

const encrypt = (value) => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + encrypted;
    }
    catch (error) {
        console.error(error)
        throw getError(404, 'Error at formatting data')
    }
};

const decrypt = (value) => {
    try {
        // Assuming the value is in 'hex' format and contains the IV and encrypted data
        const encryptedBuffer = Buffer.from(value, 'hex');

        // Extract the IV (first 16 bytes if the IV length is 16 bytes)
        const iv = encryptedBuffer.slice(0, 16);

        // Extract the encrypted data (remaining bytes)
        const encrypted = encryptedBuffer.slice(16);

        // Create decipher with the IV
        const decipher = crypto.createDecipheriv(algorithm, key, iv);

        // Decrypt the data
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
    catch (error) {
        console.error(error);
        throw getError(404, 'Error at formatting data')
    }
}

module.exports = {
    encrypt,
    decrypt,
}