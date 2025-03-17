const pool = require('../dashboard_server/src/helpers/db');
const getError = require('./getError');

const executeQuery = async (query, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result;
    } catch (error) {
        if(error.code === '23505') {
            throw getError(409, 'Source already exists.')
        }
        if(error.code === '23503') {
            throw getError(404, 'Source was not found.')
        }
        throw getError(500, 'Database query failed');
    } finally {
        client.release();
    }
};

module.exports = executeQuery;
