const pool = require('../../helpers/db');
const getError = require('../../../../shared_utils/getError');
const elastic = require('../../../../shared_utils/elastic');
const executeQueryWithoutPool = require('../../helpers/executeQueryWithoutPool');
const executeQuery = require('../../../../shared_utils/executeQuery');
const { deleteCollectionSets, saveCollections } = require('../../helpers/service_helpers/collectionsHelpers'); 
const { 
    checkStoreExistsById, 
    updateStoreFilters, 
    updateStoreCollections, 
    setElastic,
    parseProduct, 
} = require('../../helpers/service_helpers');
const { 
    setRedisHash, 
    getRedisHash, 
    deleteRedisHash, 
    deleteKeysByPattern,
    updateRedisHash,
} = require('../../../../shared_utils/redisHelpers');
const { 
    encrypt,
    decrypt,
} = require('../../../../shared_utils/encrypt');

const createStoreService = async ({ storeName, accountName, planId, apiKey, accessToken }) => {

    await setElastic({ 
        storeId: 2,
        apiKey, 
        storeName 
    });
    return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const encryptedApiKey = encrypt(apiKey);
        const encryptedAccessToken = encrypt(accessToken)
        const query = 'INSERT INTO stores (store_name, account_name, current_plan_id, api_key, filters, collections, access_token) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id';
        const params = [storeName, accountName, planId, encryptedApiKey, '[]', '[]', encryptedAccessToken];
        
        const result = await executeQueryWithoutPool({ client, query, params });
        const storeId = result.rows[0].id;


        await setRedisHash(`store:${storeId}`, {
            loading_filters: 'false',
            loading_collections: 'false',
            apiKey: encryptedApiKey,
            accessToken: encryptedAccessToken,
            storeName: storeName,
            accountName: accountName,
            filters: '[]',
            collections: '[]',
        });

        await setElastic({ 
            storeId,
            apiKey, 
            storeName 
        });

        
        await client.query('COMMIT');

        return { id: storeId, };
    } catch (error) {
        await client.query('ROLLBACK');
        console.log(error);
        throw getError(500, 'Error creating store.');
    } finally {
        client.release();
    }
};

const getStoreService = async ({ id }) => {
    const { 
        loading_filters, 
        loading_collections, 
        filters, 
        collections 
    } = await getRedisHash(
        `store:${id}`, 
        ['loading_filters', 'loading_collections', 'filters', 'collections']
    );

    return {
        loading: {
            filters: loading_filters === 'true',
            collections: loading_collections === 'true',
        },
        filters: JSON.parse(filters),
        collections: JSON.parse(collections),
    };
};

const updateStoreService = async ({ id, updates }) => {
    const updatingKeys = updates.map(({ key }) => key);

    const existingLoadingKeys = await getRedisHash(
        `store:${id}`, 
        updatingKeys.map(key => `loading_${key}`)
    );

    const isAlreadyUpdating = Object.values(existingLoadingKeys).some(value => value === 'true');

    if (isAlreadyUpdating) {
        throw getError(409, 'Another update is already in progress.');
    }

    await updateRedisHash(
        `store:${id}`, 
        updatingKeys.map(key => ({ key: `loading_${key}`, value: 'true' }))
    );

    try {
        let result;

        for (const { key, value } of updates) {
            switch (key) {
                case 'filters':
                    result = { filters: await updateStoreFilters({ id, filters: value }) };
                    break;

                case 'collections':
                    result = { collections: await updateStoreCollections({ id, collections: value }) };
                    break;

                default:
                    throw getError(500, `Unhandled key: ${key}`);
            }
        }

        return result;
    } catch (err) {
        throw err;
    } finally {

        await updateRedisHash(
            `store:${id}`, 
            updatingKeys.map(key => ({ key: `loading_${key}`, value: 'false' }))
        );

    }
};

const deleteStoreService = async ({ id }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Ensure the store exists
        await checkStoreExistsById(client, id);

        // Step 1: Delete related data
        await executeQueryWithoutPool({
            client,
            query: 'DELETE FROM user_store_access WHERE store_id = $1',
            params: [id],
        });

        await executeQueryWithoutPool({
            client,
            query: 'DELETE FROM terms WHERE store_id = $1',
            params: [id],
        });

        await executeQueryWithoutPool({
            client,
            query: 'DELETE FROM analytics WHERE store_id = $1',
            params: [id],
        });

        // Step 2: Select all purchase IDs for the store
        const purchases = await executeQueryWithoutPool({
            client,
            query: 'SELECT id FROM purchases WHERE store_id = $1',
            params: [id],
        });

        const purchaseIds = purchases.rows.map((row) => row.id);

        if (purchaseIds.length > 0) {
            // Step 3: Delete purchase_products for all purchase IDs
            await executeQueryWithoutPool({
                client,
                query: 'DELETE FROM purchase_products WHERE purchase_id = ANY($1::uuid[])',
                params: [purchaseIds],
            });
        }

        // Step 4: Delete purchases for the store
        await executeQueryWithoutPool({
            client,
            query: 'DELETE FROM purchases WHERE store_id = $1',
            params: [id],
        });

        // Step 5: Delete the store itself
        await executeQueryWithoutPool({
            client,
            query: 'DELETE FROM stores WHERE id = $1',
            params: [id],
        });

        // Step 6: Delete Elasticsearch index and Redis keys
        // await elastic.indices.delete({ index: `${id}_products` });
        await deleteRedisHash(`store:${id}`);
        await deleteKeysByPattern(`store:${id}:collections`);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting store:', error);
        throw getError(500, 'Error deleting store.');
    } finally {
        client.release();
    }
};

const getPurchaseByIdService = async ({ storeId, purchaseId }) => {
    const result = await executeQuery(`
        SELECT product_id, variant_id, count 
        FROM purchase_products 
        WHERE purchase_id = $1`, 
        [purchaseId]
    );

    if(result.rows.length === 0) {
        throw getError(404, 'No products found for this purchase.');
    }

    const productIds = result.rows.map(row => row.product_id);

    try {


        const response = await elastic.mget({
            body: {
                docs: productIds.map(id => ({
                    _index: `${storeId}_products`,
                    _id: id,
                    _source: ["id", "title", "mainImage"],
                }))
            }
        });


        const products = response.docs
            .filter(doc => doc.found)
            .map(doc => doc._source);

        const purchaseDetails = result.rows.map(row => {
            const product = products.find(p => p.id.toString() === row.product_id);
            return {
                id: row.product_id,
                variant_id: row.variant_id,
                count: row.count,
                title: product ? product.title : null,
                mainImage: product ? product.mainImage : null,
            };
        });

        return purchaseDetails;

    } catch (error) {
        throw getError(500, 'Error when retrieving product details from Elasticsearch.');
    }
};


const createProductWebhookService = async ({ storeId, data }) => {
    const product = parseProduct(data);

    await elastic.index({
        index: `${storeId}_products`,
        id: product.id,
        body: {
            ...product,
            collections: [],
        },
    });

}

const updateProductWebhookService = async ({ storeId, data }) => {
    const product = parseProduct(data);
    
    await elastic.update({
        index: `${storeId}_products`,
        id: product.id,
        body: {
            doc: product,
            doc_as_upsert: true,
        }
    });
};

const deleteProductWebhookService = async ({ storeId, deleteId }) => {
    await elastic.delete({
        index: `${storeId}_products`,
        id: deleteId,
    });
}

const updateCollectionWebhookService = async ({ storeId, updateId }) => {

    const { storeName, apiKey, collections } = await getRedisHash(`store:${storeId}`, ['storeName', 'apiKey', 'collections']);

    const existingCollections = JSON.parse(collections);

    const found = existingCollections.some((collection) => 
        collection.ref === deleteId || 
        collection?.nested?.some((nested) => nested.ref === deleteId)
    );

    if(found) {
        await saveCollections({
            pushCollections: [updateId],
            storeId,
            storeName,
            apiKey: decrypt(apiKey),
        });
    }
}

const deleteCollectionWebhookService = async ({ storeId, deleteId }) => {
    const { collections } = await getRedisHash(
        `store:${storeId}`, 
        ['collections']
    );
    const existingCollections = JSON.parse(collections);

    const found = existingCollections.some((collection) => 
        collection.ref === deleteId || 
        collection?.nested?.some((nested) => nested.ref === deleteId)
    );

    if(found) {

        const client = await pool.connect();

        const collectionsToSet = existingCollections.map(collection => {
            if(collection.ref !== deleteId) {
                return {
                    ...collection,
                }
            }
            else if(collection?.nested?.find((nested) => nested.ref === deleteId)) {
                return {
                    ...collection,
                    nested: collection.nested.filter(({ ref }) => ref !== deleteId),
                }
            }
        }).filter(Boolean);

        const jsonCollections = JSON.stringify(collectionsToSet);

        try {

            await deleteCollectionSets({
                deleteCollections: [deleteId],
                storeId,
            });
    
            await executeQueryWithoutPool({
                client,
                query: 'UPDATE stores SET collections = $1 WHERE id = $2',
                params: [jsonCollections, storeId],
            });
    
            await updateRedisHash(`store:${storeId}`, [{ key: 'collections', value: jsonCollections }]);
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.log(error);
            /* alert! webhook did not work! */
        } finally {
            client.release();
        }
        
    }
};

module.exports = {
    createStoreService,
    getStoreService,
    updateStoreService,
    deleteStoreService,
    getPurchaseByIdService,
    createProductWebhookService,
    updateProductWebhookService,
    deleteProductWebhookService,
    updateCollectionWebhookService,
    deleteCollectionWebhookService,
};
