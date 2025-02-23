const executeQueryWithoutPool = require('../executeQueryWithoutPool');
const getError = require('../../../../shared_utils/getError');
const pool = require('../db');
const { encrypt } = require('../../../../shared_utils/encrypt');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const elastic = require('../../../../shared_utils/elastic')
const { decrypt } = require('../../../../shared_utils/encrypt');
const { 
    validateCollections, 
    saveCollections, 
    buildUpdatedCollections, 
    deleteCollectionSets 
} = require('./collectionsHelpers');
const { 
    updateRedisHash, 
    getRedisHash 
} = require('../../../../shared_utils/redisHelpers');
const createSearchTerms = require('./createSearchTerms');

const checkUserExistsById = async (client, id) => {
    const result = await executeQueryWithoutPool({
        client,
        query: 'SELECT 1 FROM users WHERE id = $1',
        params: [id]
    });

    if (result.rows.length === 0) throw getError(404, 'User not found.');
};

const checkStoreExistsById = async (client, id) => {
    const result = await executeQueryWithoutPool({
        client,
        query: 'SELECT 1 FROM stores WHERE id = $1',
        params: [id]
    });
    if (result.rows.length === 0) throw getError(404, 'Store not found.');
};

const checkStoresExist = async (client, storeIds) => {
    const result = await executeQueryWithoutPool({
        client,
        query: 'SELECT id FROM stores WHERE id = ANY($1)',
        params: [storeIds]
    });

    const existingStoreIds = result.rows.map(row => row.id);
    const nonExistentStoreIds = storeIds
        .filter(id => !existingStoreIds
            .find((existingStoreId) => existingStoreId === parseInt(id)));

    if (nonExistentStoreIds.length > 0) {
        throw getError(400, 'One or more store IDs do not exist.');
    }

    return existingStoreIds;
};

const updateStoreApiKey = async ({ id, apiKey }) => {
    const client = await pool.connect();
    try {
        const encryptedApiKey = encrypt(apiKey);
        await client.query('BEGIN');
        await executeQueryWithoutPool({
            client,
            query: 'UPDATE stores SET api_key = $1 WHERE id = $2',
            params: [encryptedApiKey, id],
        });
        await updateRedisHash(`store:${id}`, [{ key: 'apiKey', value: encryptedApiKey }]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const updateStoreFilters = async ({ id, filters }) => {

    if (!Array.isArray(filters)) {
        throw getError(400, 'Filters should be an array.');
    }

    const isValid = filters.every(filter => {
        const keys = Object.keys(filter);
        return keys.length === 3 
            && keys.includes('title') 
            && keys.includes('field')
            && keys.includes('id');
    });

    if (!isValid) {
        throw getError(400, 'Each filter must contain exactly the keys "id", "title", and "field".');
    }

    const updatedFilters = filters.map(filter => 
        filter.id.length === 0 ? {  ...filter, id: uuidv4(),} : filter
    );
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const jsonFilters = JSON.stringify(updatedFilters);
        await executeQueryWithoutPool({
            client,
            query: 'UPDATE stores SET filters = $1 WHERE id = $2',
            params: [jsonFilters, id],
        });

        await updateRedisHash(`store:${id}`, [{ key: 'filters', value: jsonFilters }]);
        await client.query('COMMIT');
        
        return updatedFilters;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const updateStoreCollections = async ({ id: storeId, collections }) => {
    if (!Array.isArray(collections)) {
      throw getError(400, 'Collections should be an array.');
    }
  
    validateCollections(collections);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { apiKey, storeName, collections: currentCollections } = await getRedisHash(
            `store:${storeId}`, 
            ['apiKey', 'storeName', 'collections']
        );
        
        const decryptedApiKey = decrypt(apiKey);
        
        const collectionsToSet = collections.flatMap(collection => [
            collection.ref, 
            ...collection.children.map(nested => nested.ref)
        ]);
        
        const existingCollections = JSON.parse(currentCollections).flatMap(collection => [
            collection.ref, 
            ...collection.children.map(nested => nested.ref)
        ]);

        if (new Set(collectionsToSet).size !== collectionsToSet.length) {
            throw getError(400, 'Duplicate collections found.');
        }

        const deleteCollections = existingCollections.filter(id => !collectionsToSet.includes(id));
        
        await deleteCollectionSets({
            deleteCollections,
            storeId,
        });

        const pushCollections = collectionsToSet.filter(id => !existingCollections.includes(id));
        
        await saveCollections({
            pushCollections,
            storeId,
            storeName,
            apiKey: decryptedApiKey,
        });

        const updatedCollections = buildUpdatedCollections(collections);
        const jsonCollections = JSON.stringify(updatedCollections);

        await executeQueryWithoutPool({
            client,
            query: 'UPDATE stores SET collections = $1 WHERE id = $2',
            params: [jsonCollections, storeId],
        });

        await updateRedisHash(`store:${storeId}`, [{ key: 'collections', value: jsonCollections }]);
        await client.query('COMMIT');

        return updatedCollections;
      
    } catch (error) {
        await client.query('ROLLBACK');
    
        if (error?.response?.status === 404) {
            throw getError(404, 'Collection not found.');
        }
        
        if(error?.error) {
            throw error;
        };

        throw getError(500, 'Error updating collections.');
    } finally {
        client.release();
    }
};

const parseProduct = (product) => {
    const { 
        id, 
        title, 
        vendor, 
        product_type,
        created_at, 
        updated_at, 
        tags, 
        status, 
        images, 
        options, 
        variants 
    } = product;

    let optionMapping = {};
    options.forEach((option) => {
        const optionName = option.name.toLowerCase();
        optionMapping[optionName] = option.position;
    });

    const prices = variants.map(v => parseFloat(v.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const mainImage = images.length > 0 ? images[0].src : null;
    const allImages = images.map(img => img.src);
    const available = variants.some(variant => variant.inventory_quantity > 0);

    const variantDetails = variants.map((variant) => {
        const variantData = {
            id: variant.id,
            title: variant.title,
            price: variant.price,
            compare_at_price: variant.compare_at_price,
            quantity: variant.inventory_quantity,  // Количество на складе
            image: variant.image_id 
                ? images.find(img => img.id === variant.image_id)?.src || null
                : images.length > 0 
                    ? images[0].src 
                    : null,
        
        };

        options.forEach((option, index) => {
            const optionKey = option.name.toLowerCase();
            const optionValue = variant[`option${index + 1}`];
            if (optionValue) {
                variantData[optionKey] = optionValue;
            }
        });

        return variantData;
    });

    return { 
        id, 
        title,
        vendor,
        type: normalizeProductType(product_type),
        createdAt: created_at,
        updatedAt: updated_at,
        minPrice,
        maxPrice,
        tags,
        status,
        available, 
        mainImage,
        images: allImages,
        variants: variantDetails,
    };
};

const normalizeProductType = (typeStr) => {
    if (!typeStr || typeof typeStr !== 'string') return 'other';
    // Split on ">" (or any delimiter you use) and take the first segment.
    let primary = typeStr.split('>')[0].trim().toLowerCase();
    // Remove trailing possessive endings (e.g. "women's" becomes "women")
    primary = primary.replace(/['’]s\b/g, '');
    return primary;
};

const setElastic = async ({ storeId, apiKey, storeName, }) => {
    try {
        const products = await fetchAllProducts({ storeName, apiKey });

        const parsedProducts = products.map((product) => ({
            ...parseProduct(product),
            collections: [],
        }));

        const indexName = `${storeId}_products`;

        const exists = await elastic.indices.exists({ index: indexName });
        if (exists) {
            await elastic.indices.delete({ index: indexName });
        }

        await elastic.indices.create({
            index: indexName,
            body: {
                mappings: {
                    dynamic_templates: [
                        {
                            strings_as_keyword: {
                                match_mapping_type: "string",
                                mapping: {
                                    type: "keyword"
                                }
                            }
                        }
                    ],
                    properties: {
                        id: { type: 'keyword' },
                        title: { type: 'text' },
                        vendor: { type: 'keyword' },
                        type: { type: 'keyword' },  // Added product_type field
                        createdAt: { type: 'date' },
                        updatedAt: { type: 'date' },
                        minPrice: { type: 'scaled_float', scaling_factor: 100 },
                        maxPrice: { type: 'scaled_float', scaling_factor: 100 },
                        tags: { type: 'text' },
                        status: { type: 'keyword' },
                        available: { type: 'boolean' },
                        mainImage: { type: 'keyword' },
                        images: { type: 'keyword' },
                        collections: { type: 'keyword' },
                        variants: {
                            type: 'nested',
                            properties: {
                                id: { type: 'keyword' },
                                title: { type: 'text' },
                                price: { type: 'scaled_float', scaling_factor: 100 },
                                compare_at_price: { type: 'scaled_float', scaling_factor: 100 },
                                quantity: { type: 'integer' },
                                image: { type: 'keyword' },
                                options: { 
                                    type: 'object',
                                    dynamic: true 
                                }
                            }
                        }
                    }
                }
            }
        });

        
        {/* 
         await elastic.indices.create({
            index: indexName,
            body: {
                mappings: {
                    dynamic_templates: [
                        {
                            strings_as_keyword: {
                                match_mapping_type: "string",
                                mapping: {
                                    type: "keyword"
                                }
                            }
                        }
                    ],
                    properties: {
                        id: { type: 'keyword' },
                        title: { type: 'text' },
                        vendor: { type: 'keyword' },
                        created_at: { type: 'date' },
                        updated_at: { type: 'date' },
                        tags: { type: 'text' },
                        status: { type: 'keyword' },
                        available: { type: 'boolean' },
                        price: { type: 'keyword' },
                        mainImage: { type: 'keyword' },
                        images: { type: 'keyword' },
                        collections: { type: 'keyword' },
                        variants: {
                            type: 'nested',
                            properties: {
                                id: { type: 'keyword' },
                                title: { type: 'text' },
                                price: { type: 'keyword' },
                                compare_at_price: { type: 'keyword' },
                                quantity: { type: 'integer' },
                                image: { type: 'keyword' },
                                options: { 
                                    type: 'object',
                                    dynamic: true 
                                }
                            }
                        }
                    }
                }
            }
        });

        */}
        for (const product of parsedProducts) {
            await elastic.index({
                index: indexName,
                id: product.id,
                body: product,
            });
        }
    
        await createSearchTerms({
            storeId,
            parsedProducts,
        });
        
    } catch (err) {
        throw err;
    }
};

const fetchAllProducts = async ({ storeName, apiKey }) => {
    let products = [];
    let url = `https://${storeName}.myshopify.com/admin/api/2023-04/products.json`;
    let hasNextPage = true;

    while (hasNextPage) {
        try {
            const response = await axios.get(url, {
                auth: {
                    username: '',
                    password: apiKey,
                },
                params: {
                    limit: 250, // Shopify allows a maximum of 250 items per page
                    ...(url.includes('page_info') ? {} : { page_info: '' }) // Handle pagination
                }
            });

            products = products.concat(response.data.products);

            // Check if there is a next page
            const linkHeader = response.headers.link || '';
            hasNextPage = linkHeader.includes('rel="next"');

            // Extract the next page URL from the `link` header
            if (hasNextPage) {
                const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
                if (matches && matches[1]) {
                    url = matches[1];
                }
            }
        } catch (error) {
            console.error(`Error fetching products from Shopify:`, error.message);
            throw error;
        }
    }

    return products;
};


module.exports = {
    checkUserExistsById,
    checkStoreExistsById,
    checkStoresExist,
    updateStoreFilters,
    updateStoreCollections,
    updateStoreApiKey,
    setElastic,
    parseProduct,
    fetchAllProducts,
}