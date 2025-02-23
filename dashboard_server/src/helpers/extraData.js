const getError = require("../../../shared_utils/getError");

const plans = [
    { id: 1, value: 'basic' },
    { id: 2, value: 'advanced' }, 
];

const analyticActions = ['views', 'atc', 'viewsPop', 'atcPop'];

const storeSettingsKeys = ['filters', 'collections'];

const sortTypesArray = ['asc', 'desc'];

module.exports = {
    plans,
    analyticActions,
    storeSettingsKeys,
    sortTypesArray,
}