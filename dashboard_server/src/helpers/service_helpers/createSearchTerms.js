
const elastic = require('../../../../shared_utils/elastic');

const createSearchTerms = async ({ storeId, parsedProducts }) => {
   
    const terms = generateTermCounts(parsedProducts, 3);    

    await createSearchTermIndex(storeId);
    await storeSearchTerms({ storeId, terms });

    return { message: `Genereated ${storeId}` }
};

module.exports = createSearchTerms;

const createSearchTermIndex = async (storeId) => {
    const indexName = `${storeId}_search_terms`;
    const exists = await elastic.indices.exists({ index: indexName });
    if (exists) {
        await elastic.indices.delete({ index: indexName });
    }
    await elastic.indices.create({
        index: indexName,
        body: {
            mappings: {
                properties: {
                    term: { 
                        type: "text",
                        fields: {
                            raw: { type: "keyword" }
                        }
                    },
                    type: { type: "keyword" },
                    count: { type: "integer" }
                }
            }
        }
    });
};


const storeSearchTerms = async ({ storeId, terms }) => {
    const indexName = `${storeId}_search_terms`;
    const bulkOps = terms.flatMap(({ term, type, count }) => [
        { update: { _id: `${term}##${type}`, _index: indexName } },
        { script: { source: "ctx._source.count += params.count", params: { count } }, upsert: { term, type, count } }
    ]);
    if (bulkOps.length > 0) {
        await elastic.bulk({ refresh: true, body: bulkOps });
    }
};


const stopWords = new Set([
    "and", "the", "a", "of", "for", "in", "to", "with", "on", "by", "is", "at", "as", 
    "an", "it", "this", "that", "from", "up", "down", "be", "have", "are", "was", "were",
    "not", "you", "he", "she", "they", "we", "or", "which", "who", "whom", "hasn't", "wasn't", 
    "weren't", "isn't", "can't", "couldn't", "don't", "doesn't", "didn't", "size", "one"
]);

const tokenize = (text) => {
    return text
        .toLowerCase()
        .split(/\W+/)
        .filter(token => 
            token.length > 1 &&
            !stopWords.has(token) &&
            !/^\d+$/.test(token)
        );
};

const generateNGrams = (tokens, maxN = 3) => {
    const ngrams = [];
    for (let n = 1; n <= maxN; n++) {
        for (let i = 0; i <= tokens.length - n; i++) {
            ngrams.push(tokens.slice(i, i + n).join(" "));
        }
    }
    return ngrams;
};

// Improved term generation:
const generateTermCounts = (products) => {
    const termCounts = {};

    products.forEach(product => {
        // Dynamically derive the product type without hardcoding.

        // Process product title separately (generate unigrams and bigrams)
        if (product.title && typeof product.title === "string" && product.title.trim().length > 0) {
            const titleTokens = tokenize(product.title);
            generateNGrams(titleTokens, 2).forEach(term => {
                if (term.split(" ").length <= 2) {
                    // Create a composite key from term and normalized type.
                    const key = `${term}##${product.type}`;
                    termCounts[key] = (termCounts[key] || 0) + 1;
                }
            });
        }

        // For vendor, type, and tags, only generate unigrams
        const otherFields = [
            product.vendor, 
            product.type, 
            ...(product.tags || [])
        ].filter(field => typeof field === "string" && field.trim().length > 0);
        
        otherFields.forEach(field => {
            tokenize(field).forEach(token => {
                const key = `${token}##${product.type}`;
                termCounts[key] = (termCounts[key] || 0) + 1;
            });
        });

        // Process variant fields as unigrams
        if (Array.isArray(product.variants)) {
            product.variants.forEach(variant => {
                ["title", "color", "size"].forEach(fieldKey => {
                    if (variant[fieldKey] && typeof variant[fieldKey] === "string" && variant[fieldKey].trim().length > 0) {
                        tokenize(variant[fieldKey]).forEach(token => {
                            const key = `${token}##${product.type}`;
                            termCounts[key] = (termCounts[key] || 0) + 1;
                        });
                    }
                });
            });
        }
    });

    return Object.entries(termCounts)
        .map(([compositeKey, count]) => {
            // Split compositeKey back into term and type.
            const [term, type] = compositeKey.split("##");
            return { term, type, count };
        })
        .filter(entry => entry.count >= 3)
        .filter(entry => entry.term.length > 1);
};
