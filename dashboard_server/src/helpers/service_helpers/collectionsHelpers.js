const { v4: uuidv4 } = require('uuid');
const getError = require('../../../../shared_utils/getError');
const axios = require('axios');
const elastic = require('../../../../shared_utils/elastic');

const deleteCollectionSets = async ({ deleteCollections, storeId }) => {
    if (deleteCollections?.length > 0) {
        for (const collectionId of deleteCollections) {
            try {
                const searchResult = await elastic.search({
                    index: `${storeId}_products`,
                    body: {
                        query: {
                            term: {
                                collections: collectionId
                            }
                        }
                    }
                });

                const productsToUpdate = searchResult.hits.hits;

                if (productsToUpdate.length > 0) {
                    for (const product of productsToUpdate) {
                        const productId = product._id;
                        const collections = product._source.collections || [];
                        const updatedCollections = collections.filter(id => id !== collectionId);

                        await elastic.update({
                            index: `${storeId}_products`,
                            id: productId,
                            body: {
                                doc: {
                                    collections: updatedCollections,
                                }
                            }
                        });
                    }
                }

            } catch (error) {
                console.error(`Error removing collection ${collectionId} from products in store ${storeId}:`, error.message);
            }
        }
    }
};

const validateCollections = (collections) => {
    const isValid = collections.every(collection => {
        const keys = Object.keys(collection);
        return keys.includes('id')
            && keys.includes('title')
            && keys.includes('ref')
            && keys.includes('children');
    });

    if (!isValid) {
        throw getError(400, 'Each collection must contain "id", "title", "ref", and "children" keys.');
    }
};

const saveCollections = async ({ pushCollections, storeId, storeName, apiKey }) => {
    const indexName = `${storeId}_products`;

    if(pushCollections?.length > 0) {
        for (const collectionId of pushCollections) {
            try {
                let hasNextPage = true;
                let url = `https://${storeName}.myshopify.com/admin/api/2023-04/collections/${collectionId}/products.json`;
                
                while (hasNextPage) {
                    const { data, headers } = await axios.get(url, {
                        auth: {
                            username: '',
                            password: apiKey,
                        },
                        params: {
                            limit: 250,
                        },
                    });
    
                    const productIds = data.products.map(({ id }) => id);
    
                    if (productIds.length > 0) {
                        const bulkBody = [];
    
                        for (const productId of productIds) {
                            const productCollections = await getProductCollections({ indexName, productId });
                            const updatedCollections = Array.from(new Set([...productCollections, collectionId]));
    
                            bulkBody.push({
                                update: {
                                    _index: indexName,
                                    _id: productId,
                                }
                            });
    
                            bulkBody.push({
                                doc: {
                                    collections: updatedCollections,
                                },
                            });
                        }
    
                        if (bulkBody.length > 0) {
                            await elastic.bulk({ body: bulkBody })
                                .catch(error => {
                                    console.error('Elasticsearch bulk update failed:', error.message);
                                });
                        }
                    }
    
                    const linkHeader = headers.link || '';
                    hasNextPage = linkHeader.includes('rel="next"');
    
                    if (hasNextPage) {
                        const matches = linkHeader.match(/<([^>]+)>; rel="next"/);
                        if (matches && matches[1]) {
                            url = matches[1];
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching or updating products for store ${storeName} (ID: ${storeId}), collection ${collectionId}:`, error.message);
            }
        }
    }
};

const getProductCollections = async ({ indexName, productId }) => {
    try {
        const product = await elastic.get({
            index: indexName,
            id: productId,
        });

        return product._source?.collections || [];
    } catch (error) {
        console.error(`Product ID ${productId} not found in Elasticsearch.`);
        return [];
    }
};

const buildUpdatedCollections = (collections) => {
    return collections
        .map(collection => {
            const updatedChildren = collection.children
                .map(nested => ({
                    id: nested.id || uuidv4(),
                    title: nested.title,
                    ref: nested.ref,
                    children: nested.children,
                }));

            return {
                id: collection.id || uuidv4(),
                title: collection.title,
                ref: collection.ref,
                children: updatedChildren,
            };
        });
};

module.exports = {
    deleteCollectionSets,
    validateCollections,
    saveCollections,
    buildUpdatedCollections,
}