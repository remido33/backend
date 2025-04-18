const router = require('express').Router();
const { 
    createStoreController,
    getStoreController,
    updateStoreController,
    deleteStoreController,
    getPurchaseByIdController,
    createProductWebhookController,
    updateProductWebhookController,
    deleteProductWebhookController,
    deleteCollectionWebhookController,
    updateCollectionWebhookController
} = require("../../controllers/store");
const validateParams = require("../../../../shared_utils/validateParams");
const { plans } = require('../../helpers/extraData');
const { verifyToken, verifyAdminToken } = require('../../../../shared_utils/verifyToken');

router.post(
    '/',
    validateParams([
        { 
            key: 'body', 
            value: 'storeName', 
            type: 'string', 
        },
        { 
            key: 'body', 
            value: 'accountName', 
            type: 'string', 
        },
        {
            key: 'body', 
            value: 'planId', 
            validate: (planId) => plans.find(({ id }) => id === planId), 
        },
        {
            key: 'body',
            value: 'apiKey',
            type: 'string',
        },
        {
            key: 'body',
            value: 'accessToken',
            type: 'string',
        }
    ]), 
    // verifyAdminToken,
    createStoreController,
);

router.get(
    '/:id',
    verifyToken,
    getStoreController,
);

router.delete(
    '/:id',
    // verifyAdminToken,
    deleteStoreController,
);

router.patch(
    '/:id',
    verifyToken,
    updateStoreController,
);

router.get('/:id/purchase/:purchaseId',
    verifyToken,
    getPurchaseByIdController,
);

// webhooks are verified in app init 

router.post(
    '/:id/webhook/product/create',
    createProductWebhookController,
);

router.post(
    '/:id/webhook/product/update',
    updateProductWebhookController,
);

router.post(
    '/:id/webhook/product/delete',
    deleteProductWebhookController,
);

router.post(
    '/:id/webhook/collection/update',
    updateCollectionWebhookController,
);

router.post(
    '/:id/webhook/collection/delete',
    deleteCollectionWebhookController
);
    
module.exports = router;