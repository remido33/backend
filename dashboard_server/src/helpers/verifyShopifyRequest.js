
const crypto = require('crypto');

const secret = '5107ce881a782f468d2b63dfe007d8b6d22c7ca0d459b3ac0ae89ac729c0556e';

const verifyShopifyRequest = (req) => {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const body = req.rawBody;
    
    if(hmac && body) {
        const generatedHash = crypto
            .createHmac('sha256', secret)
            .update(body, 'utf8')
            .digest('base64');
        return hmac === generatedHash;
    }
};

module.exports = verifyShopifyRequest;
