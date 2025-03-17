const tryCatch = require("../../../../shared_utils/tryCatch");
const { 
    getChartAnalyticsService, 
    getProductsTableAnalyticsService, 
    getOrdersTableAnalyticsService,
    getTermsTableAnalyticsService,
} = require("../../services/store/analytics");

const getChartAnalyticsController = tryCatch(async (req,res) => {
    const { id, } = req.params;
    const { startDate, endDate } = req.query;
    const response = await getChartAnalyticsService({
        storeId: id,
        startDate,
        endDate,
    });

    res.status(200).json(response);
});

const getProductsTableAnalyticsController = tryCatch(async (req,res) => {
    const { id, } = req.params;
    const { startDate, endDate, sortKey, sortType, limit, page, } = req.query;

    const response = await getProductsTableAnalyticsService({ 
        storeId: id,
        startDate,
        endDate,
        sortKey,
        sortType,
        limit: parseInt(limit) || 10,
        page: parseInt(page) || 1,
    });

    res.status(200).json(response);
});


const getOrdersTableAnalyticsController = tryCatch(async (req,res) => {
    const { id, } = req.params;
    const { startDate, endDate, sortKey, sortType, limit, page } = req.query;

    const response = await getOrdersTableAnalyticsService({ 
        storeId: id,
        startDate,
        endDate, 
        sortKey,
        sortType,
        limit: parseInt(limit) || 10,
        page: parseInt(page) || 1,
    });

    res.status(200).json(response);
});

const getTermsTableAnalyticsController = tryCatch(async (req,res) => {
    const { id, } = req.params;
    const { startDate, endDate, sortKey, sortType, limit, page, } = req.query;

    const response = await getTermsTableAnalyticsService({ 
        storeId: id,
        startDate,
        endDate,
        sortKey,
        sortType,
        limit: parseInt(limit) || 10,
        page: parseInt(page) || 1,
    });

    res.status(200).json(response);
});

module.exports = {
    getChartAnalyticsController,
    getProductsTableAnalyticsController,
    getOrdersTableAnalyticsController,
    getTermsTableAnalyticsController,
};
