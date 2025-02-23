const getError = require("../../../shared_utils/getError");
const tryCatch = require("../../../shared_utils/tryCatch");
const { 
    getProductService,
    createCheckoutService,
    getMultipleProductsService,
    getSearchResultsService,
    getSuggestionsService,
    getRecommendationService,
    getCollectionProductsService, 
} = require("../services/store");

const getCollectionProductsController = tryCatch(async (req, res) => {
    const { storeId, refId, } = req.params;
    const { offset, limit, sortBy, aggs = '', fields, } = req.query;
    const parsedFields = fields.split(',').filter(Boolean);

    if(parsedFields.length === 0) {
        throw getError(400, 'One of the fields length is invalid..')
    }
    

    const response = await getCollectionProductsService({
        storeId, 
        refId,
        offset: parseInt(offset, 10) || 0,
        limit: parseInt(limit, 10) || 10,
        sortBy,
        aggs,
        fields: parsedFields,
    });

    res.status(200).json(response);
});

const getProductController = tryCatch(async (req, res) => {
    const { storeId, productId, } = req.params;
    
    const response = await getProductService({ 
        storeId, 
        productId, 
    });

    res.status(200).json(response);
});

const getMultipleProductsController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { ids, fields } = req.query;
    const productIds = ids.split(',');
    const parsedFields = fields.split(',').filter(Boolean);

    if(parsedFields.length === 0 || productIds.length === 0) {
        throw getError(400, 'One of the fields length is invalid..')
    }

    const response = await getMultipleProductsService({ 
        storeId, 
        productIds, 
        fields: parsedFields
    });
    res.status(200).json(response);
});

const createCheckoutController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { items, } = req.body;

    const isValid = items.every(item => {
        const keys = Object.keys(item);
        return keys.length === 2
            && keys.includes('variantId')
            && keys.includes('quantity')
    });

    if (!isValid) {
        throw getError(400, 'Each item must contain exactly the keys "id" and "quantity".');
    };

    const response = await createCheckoutService({ storeId, items, });

    res.status(200).json(response)
})

const getSearchResultsController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { query, offset, limit, sortBy, aggs = '', fields, } = req.query;

    const parsedFields = fields.split(',').filter(Boolean);

    if(parsedFields.length === 0) {
        throw getError(400, 'One of the fields length is invalid..')
    }

    const response = await getSearchResultsService({
        storeId, 
        query,
        offset,
        limit, 
        sortBy,
        aggs,
        fields: parsedFields,
    });

    res.status(200).json(response);
});

const getSuggestionsController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { query, limit, } = req.query;

    const response = await getSuggestionsService({
        storeId, 
        query,
        limit,
        excludeTypes: ['men']
    });

    res.status(200).json(response);
});

const getRecommendationController = tryCatch(async (req, res) => {
    const { storeId, } = req.params;
    const { ids, fields, } = req.query;
    const productIds = ids.split(',');
    const parsedFields = fields.split(',').filter(Boolean);

    if(parsedFields.length === 0 || productIds.length === 0) {
        throw getError(400, 'One of the fields length is invalid..')
    }

    const response = await getRecommendationService({ 
        storeId, 
        productIds, 
        fields: parsedFields, 
    });
    res.status(200).json(response);
});

module.exports = {
    getProductController,
    getMultipleProductsController,
    getSearchResultsController,
    getSuggestionsController,
    getCollectionProductsController,
    getRecommendationController,
    createCheckoutController,
};
