const getError = require('../../../shared_utils/getError');
const elastic = require('../../../shared_utils/elastic');
const { getSortCriteria, parseAggs } = require('../helpers/serviceHelpers');
const { getRedisHash } = require('../../../shared_utils/redisHelpers');
const axios = require('axios');
const { decrypt, encrypt } = require('../../../shared_utils/encrypt');

const getProductService = async ({ storeId, productId }) => {
    try {
        const response = await elastic.get({
            index: `${storeId}_products`,
            id: productId
          });
        
        return response._source;
      } catch (error) {
        // can be product or store index
        if(error.statusCode === 404) {
            throw getError(404, 'Document was not found.');
        }
        throw getError(500, 'Error when getting a product.');
      }
};

const createCheckoutService = async ({ storeId, items }) => {
    
    const { accessToken, storeName } = await getRedisHash(`store:${storeId}`, ['accessToken', 'storeName'])
    const storefrontUrl = `https://${storeName}.myshopify.com/api/2023-07/graphql.json`;

    const lineItems = items.map(item => `{
        variantId: "gid://shopify/ProductVariant/${item.variantId}",
        quantity: ${item.quantity}
    }`).join(',');

    const query = `
        mutation {
            checkoutCreate(input: {
                lineItems: [${lineItems}]
            }) {
                checkout {
                    id
                    webUrl
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;
    
    try {
        const { data } = await axios.post(storefrontUrl, { query }, {
            headers: {
                'X-Shopify-Storefront-Access-Token': decrypt(accessToken),
                'Content-Type': 'application/json',
            },
        });

        const { checkout, userErrors } = data.data.checkoutCreate;

        if(userErrors.length > 0) {
            return getError(500, 'Checkout creation failed.')
        }
        
        return checkout;
    } catch (error) {
        throw getError(500, 'Checkout creation failed.');
    }
};

const getMultipleProductsService = async ({ storeId, productIds, fields }) => {
    try {
        const response = await elastic.mget({
            body: {
                docs: productIds.map(id => ({
                    _index: `${storeId}_products`,
                    _id: id,
                    _source: ["id", ...fields],
                }))
            }
        });

        const products = response.docs
            .filter(doc => doc.found)
            .map(doc => doc._source);

        return products;
    } catch (error) {
        throw getError(500, 'Error when getting multiple products.');
    }
};

const getRecommendationService = async ({ storeId, productIds, fields, }) => {

    try {
        
        const query = {
            _source: ["id", ...fields],
            query: {
                bool: {
                    must: [
                        {
                            more_like_this: {
                                fields: ["type", "title", "vendor", "description"],
                                like: productIds.map(id => ({ _id: id })),
                                min_term_freq: 1,
                                max_query_terms: 12,
                            },
                        },
                    ],
                },
            },
            size: 12
        };

        {/* 
                    should: [
                    {
                        nested: {
                            path: "variants",
                            query: {
                                bool: {
                                    should: [
                                        { terms: { "variants.color": ["White"] } },
                                    ],
                                },
                            },
                            boost: 2,
                        },
                    },
                ],
        */}
        const recommendationsResponse = await elastic.search({
            index: `${storeId}_products`,
            body: query
        });

        const recommendedProducts = recommendationsResponse.hits.hits.map(hit => hit._source);
        return recommendedProducts;
    } catch (error) {
        console.error(error?.meta?.body?.error);
        throw getError(500, 'Error when getting product recommendations.');
    }
};

const getSearchResultsService = async ({ 
    storeId,
    query,
    offset,
    limit, 
    sortBy = 'relevance',
    aggs,
    fields,
}) => {
    try {
        let searchQuery = {
            _source: ["id", ...fields],
            query: {
                bool: {
                    should: [
                        {
                            match_phrase_prefix: {
                                title: {
                                    query: query,
                                    boost: 3,
                                }
                            }
                        },
                        {
                            match: {
                                title: {
                                    query: query,
                                    boost: 2,
                                    fuzziness: "AUTO",
                                    operator: "or",
                                }
                            }
                        },
                        {
                            match: {
                                vendor: {
                                    query: query,
                                    boost: 1.5,
                                    fuzziness: "AUTO",
                                    operator: "or",
                                }
                            }
                        },
                        {
                            match: {
                                'variants.title': {
                                    query: query,
                                    fuzziness: "AUTO",
                                    operator: "or",
                                }
                            }
                        },
                        { 
                            prefix: { 
                                "tags": query.toLowerCase() 
                            } 
                        },
                    ],
                    minimum_should_match: 1,
                }
            },
            from: offset * limit,
            size: limit,
            sort: getSortCriteria(sortBy),
        };

        parseAggs({ aggs, searchQuery });
        
        console.log(JSON.stringify(searchQuery))
        const data = await elastic.search({ 
            index: `${storeId}_products`, 
            body: searchQuery
        });

        const hits = data.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source,
        }));

        const aggregations = data.aggregations && Object.keys(data.aggregations).map(key => {
            const agg = data.aggregations[key];
            
            return {
                label: key,
                values: agg?.filtered_data 
                    ? agg.filtered_data[key].buckets
                    : agg[key].buckets,
            }
        });
        
        return { 
            items: hits, 
            filters: aggregations,
            total: data.hits.total.value,
        };

    } catch (error) {
        console.error('Error executing search:', error);
        throw getError(500, 'Error executing search.');
    }
};

const getSuggestionsService = async ({ storeId, query, type, excludeTypes = [], limit }) => {
    const indexName = `${storeId}_search_terms`;

    try {
        const boolQuery = {
            bool: {
                should: [
                    { wildcard: { "term": `*${query.toLowerCase()}*` } },
                    { prefix: { "term": query.toLowerCase() } },
                    { match: { "term": query.toLowerCase() } }
                ],
                minimum_should_match: 1,
            }
        };

        if (type) {
            boolQuery.bool.filter = { term: { "type": type.toLowerCase() } };
        }

        if (excludeTypes && excludeTypes.length > 0) {
            boolQuery.bool.must_not = { 
                terms: { 
                    "type": excludeTypes.map(t => t.toLowerCase()) 
                }
            };
        }

        // If we need to reference raw term subfield for exact matching, we can modify it:
        const response = await elastic.search({
            index: indexName,
            body: {
                query: boolQuery,
                size: limit * 2,
                _source: ["term", "count", "type"]
            }
        });

        let suggestions = response.hits.hits.map(hit => hit._source);
        suggestions = suggestions.filter((value, index, self) => 
            index === self.findIndex((t) => (t.term === value.term))
        );
        
        suggestions.sort((a, b) => b.count - a.count);
        return suggestions.slice(0, limit);
    } catch (error) {
        console.error("Error fetching search suggestions:", error);
        throw new Error("Could not fetch search suggestions.");
    }
};


const getCollectionProductsService = async ({ 
    storeId, 
    refId,
    offset, 
    limit, 
    sortBy = 'relevance', 
    aggs,
    fields,
}) => {
    
    try {
        let searchQuery = {
            _source: ["id", ...fields],
            query: {
                bool: {
                    should: [
                        {
                            term: { collections: refId },
                        },
                        
                    ]
                }
            },
            from: offset * limit,
            size: limit,
            sort: getSortCriteria(sortBy),
        };

        parseAggs({ aggs, searchQuery });

    
        const data = await elastic.search({ 
            index: `${storeId}_products`, 
            body: searchQuery
        });

        const hits = data.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source,
        }));

        const aggregations = data.aggregations && Object.keys(data.aggregations).map(key => {
            const agg = data.aggregations[key];
            
            return {
                label: key,
                values: agg?.filtered_data 
                    ? agg.filtered_data[key].buckets
                    : agg[key].buckets,
            }

        });
        
        return { 
            items: hits, 
            filters: aggregations,
            total: data.hits.total.value,
        };
    } catch (error) {
        console.error('Error fetching collection products:', error);
        throw getError(500, 'Error fetching collection products.');
    }
};

module.exports = {
    getProductService,
    createCheckoutService,
    getMultipleProductsService,
    getSearchResultsService,
    getCollectionProductsService,
    getSuggestionsService,
    getRecommendationService,
};
