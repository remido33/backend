const getError = require('../../../shared_utils/getError');
const { setRedisHash } = require('../../../shared_utils/redisHelpers');
const { v4: uuidv4 } = require('uuid');

const createActionAnalyticService = async ({ storeId, actionId, productId, platformId, }) => {
    try {
        const uniqueId = uuidv4();
        await setRedisHash(`analytics:${uniqueId}`, {
            storeId,
            actionId,
            productId,
            platformId,
            timestamp: Date.now(),
        });
    } catch (error) {
        throw getError(500, 'Error creating analytic');
    }
};

const createTermAnalyticService = async ({ storeId, query, platformId }) => {
    try {
        const uniqueId = uuidv4();
        await setRedisHash(`terms:${uniqueId}`, {
            storeId,
            query,
            platformId,
            timestamp: Date.now(),
        });
    } catch (error) {
        throw getError(500, 'Error creating analytic');
    }
}

const createPurchaseAnalyticService = async ({ storeId, platformId, products, total, }) => {
    try {
        const uniqueId = uuidv4();
        await setRedisHash(`purchase:${uniqueId}`, {
            storeId,
            products: JSON.stringify(products),
            platformId,
            timestamp: Date.now(),
            total,
        });
    } catch (error) {
        throw getError(500, 'Error creating analytic');
    }
}

module.exports = {
    createActionAnalyticService,
    createTermAnalyticService,
    createPurchaseAnalyticService,
};