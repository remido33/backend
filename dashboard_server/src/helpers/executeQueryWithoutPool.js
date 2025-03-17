const getError = require('../../../shared_utils/getError');

const executeQueryWithoutPool = async ({ client, query, params = [] }) => {
    try {
        const result = await client.query(query, params);
        return result;
    } catch (error) {
        if(error.code === '23503') {
            throw getError(404, 'Source was not found.')
        }
        if(error.code === '23505') {
            throw getError(409, 'Source already exists.')
        }
        throw getError(500, 'Database query failed');
    }
};

module.exports = executeQueryWithoutPool;

