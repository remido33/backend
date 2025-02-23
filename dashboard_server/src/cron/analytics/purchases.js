const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { getRedisHash, deleteRedisHash, getAllRedisKeys, setRedisHash } = require('../../../../shared_utils/redisHelpers');
const pool = require('../../helpers/db');
const executeQueryWithoutPool = require('../../helpers/executeQueryWithoutPool');

const transferPurchases = async () => {
    const client = await pool.connect(); // Acquire a client

    try {
        const keys = await getAllRedisKeys('purchase*');
        if (keys.length === 0) return;

        for (const key of keys) {
            const uniqueId = uuidv4();

            const { storeId, products: stringifiedProducts, platformId, timestamp, total } = await getRedisHash(key);
            const products = JSON.parse(stringifiedProducts);
            const date = new Date(parseInt(timestamp, 10));
            const actionTime = date.toISOString();
            
            try {

                const purchaseProductsData = products.map(({ id, variantId, count }) => [
                    uniqueId,
                    id,
                    variantId,
                    count
                ]);

                await client.query('BEGIN');

                const purchasesQuery = `
                    INSERT INTO purchases
                    (id, store_id, timestamp, total, platform_id)
                    VALUES ($1, $2, $3, $4, $5)
                `;

                const purchaseData = [uniqueId, storeId, actionTime, total, platformId];

                await executeQueryWithoutPool({ 
                    client, 
                    query: purchasesQuery,
                    params: purchaseData 
                });

                const purchaseProductsQuery = `
                    INSERT INTO purchase_products
                    (purchase_id, product_id, variant_id, count)
                    VALUES ${purchaseProductsData.map((_, i) => 
                        `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
                `;

                await executeQueryWithoutPool({ 
                    client, 
                    query: purchaseProductsQuery, 
                    params: purchaseProductsData.flat() 
                });

                await client.query('COMMIT');

            } catch (error) {
                await client.query('ROLLBACK');

                await setRedisHash(`broken_:${key}`, {
                    storeId, 
                    products, 
                    platformId, 
                    timestamp
                });
            }

            await deleteRedisHash(key);
        }

    } catch (error) {
        console.error('Error transferring data to the database:', error);
    } finally {
        client.release(); // Release the client
    }
};

cron.schedule('*/10 * * * * *', async () => {
    try {
        await transferPurchases();
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});
