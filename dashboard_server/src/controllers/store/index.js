const tryCatch = require("../../../../shared_utils/tryCatch");
const { storeSettingsKeys } = require('../../helpers/extraData');
const getError = require('../../../../shared_utils/getError');
const { 
    createStoreService,
    getStoreService,
    updateStoreService,
    deleteStoreService,
    getPurchaseByIdService,
    createProductWebhookService,
    updateProductWebhookService,
    deleteProductWebhookService,
    updateCollectionWebhookService,
    deleteCollectionWebhookService,
} = require("../../services/store");

const createStoreController = tryCatch(async (req, res) => {
    const { storeName, accountName, planId, apiKey, accessToken, } = req.body;

    const response = await createStoreService({ 
        storeName, 
        accountName,
        planId, 
        apiKey, 
        accessToken, 
    });

    res.status(200).json(response);
});

const getStoreController = tryCatch(async (req,res) => {
    const { id, } = req.params;
    const response = await getStoreService({ id, });

    res.status(200).json(response);
});

const updateStoreController = tryCatch(async (req, res) => {
    const { id, } = req.params;
    const params = req.body;
    const keys = Object.keys(params);

    if (keys.length === 0)
        throw getError(400, 'No keys provided');
    
    const checkKeys = keys.every(key => storeSettingsKeys.includes(key));

    if (!checkKeys)
        throw getError(400, 'One or more provided keys are invalid.');

    const updates = keys.map(key => ({
        key,
        value: params[key],
    }));

    const response = await updateStoreService({ id, updates, })
    res.status(200).json(response);
});

const deleteStoreController = tryCatch(async (req, res) => {
    const { id, } = req.params;
    await deleteStoreService({ id, });

    res.status(204).end();
});

const getPurchaseByIdController = tryCatch(async (req, res) => {
    const { id: storeId, purchaseId } = req.params;
    const response = await getPurchaseByIdService({ storeId, purchaseId, });

    res.status(200).json(response);
});

const createProductWebhookController = tryCatch(async (req, res) => {
    const { id: storeId, } = req.params;

    await createProductWebhookService({
        storeId,
        data: req.body,
    });
    
    res.status(204).end();
});

const updateProductWebhookController = tryCatch(async (req, res) => {
    const { id: storeId } = req.params;
    
    await updateProductWebhookService({ 
        storeId, 
        data: req.body, 
    });

    res.status(204).end();
});

const deleteProductWebhookController = tryCatch(async (req, res) => {
    const { id: storeId } = req.params;
    const { id: deleteId } = req.body;

    await deleteProductWebhookService({
        storeId,
        deleteId,
    })

    res.status(204).end();
});

const updateCollectionWebhookController = tryCatch(async (req, res) => {
    const { id: storeId } = req.params;
    const { id: updateId } = req.body;

    await updateCollectionWebhookService({
        storeId,
        updateId: updateId.toString(),
    })

    res.status(204).end();
});

const deleteCollectionWebhookController = tryCatch(async (req, res) => {
    const { id: storeId } = req.params;
    const { id: deleteId } = req.body;

    await deleteCollectionWebhookService({ 
        storeId, 
        deleteId: deleteId.toString(),
    });

    res.status(204).end();
});

module.exports = {
    createStoreController,
    getStoreController,
    updateStoreController,
    deleteStoreController,
    getPurchaseByIdController,
    createProductWebhookController,
    updateProductWebhookController,
    deleteProductWebhookController,
    updateCollectionWebhookController,
    deleteCollectionWebhookController,
};
