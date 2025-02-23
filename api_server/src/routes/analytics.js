const router = require('express').Router();
const { validate } = require('node-cron');
const validateParams = require("../../../shared_utils/validateParams");
const { 
    createActionAnalyticController, 
    createTermAnalyticController,
    createPurchaseAnalyticController
} = require('../controllers/analytics');


const platforms = [1, 2];
const actions = [1, 2];

router.post(
    '/:storeId/action',
    validateParams([
        { 
            key: 'body', 
            value: 'actionId', 
            validate: (actionId) => actions.find((i) => i === actionId), 
        },
        {
            key: 'body', 
            value: 'productId', 
            validate: 'number', 
        },
        {
            key: 'body', 
            value: 'platformId',
            validate: (platformId) => platforms.find((i) => i === platformId),
        },
    ]), 
    createActionAnalyticController,
);

router.post(
    '/:storeId/term',
    validateParams([
        { 
            key: 'body', 
            value: 'query', 
            validate: 'string', 
        },
        {
            key: 'body', 
            value: 'platformId',
            validate: (platformId) => platforms.find((i) => i === platformId),
        },
    ]), 
    createTermAnalyticController,
);

router.post(
    '/:storeId/purchase',
    validateParams([
        { 
            key: 'body', 
            value: 'products', 
            validate: (arr) => Array.isArray(arr) && arr.every(item => 
                typeof item?.count === 'number' 
                && typeof item?.id === 'number'
                && typeof item?.variantId === 'number'
            ), 
        },
        {
            key: 'body', 
            value: 'platformId',
            validate: (platformId) => platforms.find((i) => i === platformId),
        },
        {
            key: 'body',
            value: 'total',
            validate: 'number',
        }
    ]), 
    createPurchaseAnalyticController,
);

module.exports = router;