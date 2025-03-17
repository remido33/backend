const tryCatch = require("../../../shared_utils/tryCatch");
const { 
    createActionAnalyticService, 
    createTermAnalyticService,
    createPurchaseAnalyticService,
} = require("../services/analytics");

const createActionAnalyticController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { actionId, productId, platformId, } = req.body;
    
    await createActionAnalyticService({ 
        storeId, 
        actionId, 
        productId, 
        platformId, 
    });
    
    res.status(204).end();
});

const createTermAnalyticController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { query, platformId, } = req.body;
    
    await createTermAnalyticService({ 
        storeId, 
        query, 
        platformId, 
    });

    res.status(204).end();
});

const createPurchaseAnalyticController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { platformId, products, total, } = req.body;

    await createPurchaseAnalyticService({ 
        storeId, 
        products, 
        platformId,
        total,
    });

    res.status(204).end();
});

module.exports = {
    createActionAnalyticController,
    createTermAnalyticController,
    createPurchaseAnalyticController,
};
