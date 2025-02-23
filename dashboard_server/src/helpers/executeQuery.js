const pool = require('./db');
const getError = require('../../../shared_utils/getError');

const executeQuery = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result;
    } catch (error) {
        console.error(error);
        throw getError(500, 'Database query failed');
    } finally {
        client.release();
    }
};

module.exports = executeQuery;
