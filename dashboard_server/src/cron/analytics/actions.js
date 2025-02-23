const cron = require('node-cron');
const { getRedisHash, deleteRedisHash, getAllRedisKeys, setRedisHash } = require('../../../../shared_utils/redisHelpers');
const pool = require('../../helpers/db');
const executeQueryWithoutPool = require('../../helpers/executeQueryWithoutPool');

const transferAnalyticsToDB = async () => {
    const client = await pool.connect();

    try {
        const keys = await getAllRedisKeys('analytics*');
        if (keys.length === 0) return;

        for (const key of keys) {
            const { storeId, actionId, productId, platformId, timestamp } = await getRedisHash(key);
            const date = new Date(parseInt(timestamp, 10));

            try {
                const actionTime = date.toISOString();

                const analyticsData = [storeId, actionId, productId, platformId, actionTime];

                await client.query('BEGIN');

                const analyticsQuery = `
                    INSERT INTO analytics 
                    (store_id, action_id, product_id, platform_id, timestamp) 
                    VALUES ($1, $2, $3, $4, $5)
                `;

                await executeQueryWithoutPool({ client, query: analyticsQuery, params: analyticsData });

                await client.query('COMMIT');

                // Delete the Redis key only if the transaction succeeds
                await deleteRedisHash(key);

            } catch (error) {
                await client.query('ROLLBACK');


                await setRedisHash(`broken_:${key}`, {
                    storeId,
                    actionId,
                    productId,
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
        await transferAnalyticsToDB();
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});
