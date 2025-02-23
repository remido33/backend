const cron = require('node-cron');
const { getRedisHash, deleteRedisHash, getAllRedisKeys, setRedisHash } = require('../../../../shared_utils/redisHelpers');
const pool = require('../../helpers/db');
const executeQueryWithoutPool = require('../../helpers/executeQueryWithoutPool');

const normalizeQuery = (query) => {
    let normalized = query
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .normalize('NFKC');

    if (normalized.length > 50) {
        normalized = normalized.slice(0, 47) + '...';
    }

    return normalized;
};

const transferTermsToDb = async () => {
    const client = await pool.connect(); // Acquire a client

    try {
        const keys = await getAllRedisKeys('terms*');
        if (keys.length === 0) return;

        for (const key of keys) {
            const { storeId, query, platformId, timestamp } = await getRedisHash(key);
            const date = new Date(parseInt(timestamp, 10));

            try {
                const actionTime = date.toISOString();
                const normalizedQuery = normalizeQuery(query);

                const termsData = [storeId, normalizedQuery, platformId, actionTime];

                await client.query('BEGIN');

                const termsQuery = `
                    INSERT INTO terms 
                    (store_id, term, platform_id, timestamp) 
                    VALUES ($1, $2, $3, $4)
                `;

                await executeQueryWithoutPool({ client, query: termsQuery, params: termsData });

                await client.query('COMMIT');

                // Delete the Redis key only if the transaction succeeds
                await deleteRedisHash(key);

            } catch (error) {
                await client.query('ROLLBACK');
                
                await setRedisHash(`broken_:${key}`, {
                    storeId,
                    query,
                    platformId,
                    timestamp,
                });

            }
        }

    } catch (error) {
        console.error('Error transferring data to the database:', error);
    } finally {
        client.release(); // Release the client
    }
};

cron.schedule('*/10 * * * * *', async () => {
    try {
        await transferTermsToDb();
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});
