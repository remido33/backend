const router = require('express').Router({ mergeParams: true });
const validateParams = require("../../../../shared_utils/validateParams");
const { verifyToken } = require('../../../../shared_utils/verifyToken');
const { getChartAnalyticsController, getOrdersTableAnalyticsController, getProductsTableAnalyticsController, getTermsTableAnalyticsController } = require('../../controllers/store/analytics');
const { sortTypesArray } = require('../../helpers/extraData');

router.get(
    '/charts',
    validateParams([
        {
            key: 'query',
            value: 'startDate',
            type: 'string',
        },
        {
            key: 'query',
            value: 'endDate',
            type: 'string',
        }
    ]),
    verifyToken,
    getChartAnalyticsController,
);

router.get(
    '/table/orders',
    validateParams([
        {
            key: 'query',
            value: 'startDate',
            type: 'string',
        },
        {
            key: 'query',
            value: 'sortKey',
            validate: (key) => key === 'total' || key === 'count' || key === 'timestamp',
        },
        {
            key: 'query',
            value: 'sortType',
            validate: (type) => sortTypesArray.includes(type),
        },
        {
            key: 'query',
            value: 'page',
            type: 'number',
        },
    ]),
    verifyToken,
    getOrdersTableAnalyticsController,
);

router.get(
    '/table/products',
    validateParams([
        {
            key: 'query',
            value: 'startDate',
            type: 'string',
        },
        {
            key: 'query',
            value: 'sortKey',
            validate: (key) => key === 'views' || key === 'atc' || key === 'purchase',
        },
        {
            key: 'query',
            value: 'sortType',
            validate: (type) => sortTypesArray.includes(type),
        },
        {
            key: 'query',
            value: 'page',
            type: 'number',
        },
    ]),
    verifyToken,
    getProductsTableAnalyticsController,
);

router.get(
    '/table/terms',
    validateParams([
        {
            key: 'query',
            value: 'startDate',
            type: 'string',
        },
        {
            key: 'query',
            value: 'sortKey',
            validate: (key) => key === 'total' || key === 'ios' || key === 'android',
        },
        {
            key: 'query',
            value: 'sortType',
            validate: (type) => sortTypesArray.includes(type),
        },
        {
            key: 'query',
            value: 'page',
            type: 'number',
        },
    ]),
    verifyToken,
    getTermsTableAnalyticsController,
);
    
module.exports = router;