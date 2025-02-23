
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');
const getError = require("../../../shared_utils/getError");

const generateQrForLogin = async (secret, email) => {
    try {
        return await qrcode.toDataURL(speakeasy.otpauthURL({
            secret: secret,
            label: email,
            issuer: 'Lorem',
            encoding: 'base32',
        }));
    } catch (error) {
        throw getError(500, 'Error generating QR code');
    }
}

module.exports = generateQrForLogin;