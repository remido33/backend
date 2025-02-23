
const buildAggs = (aggs) => {
    let convertedAggs = {};

    const variantAggs = aggs
        .filter(({ key }) => key.includes('variants.'))
        .map(({ key }) => ({ 
            [key]: { 
                nested: {
                    path: 'variants',
                },
                aggs: {
                    [key]: {
                        terms: {
                            field: key,
                            size: 10,
                        }
                    }
                }
            }
        })
    );

    const defaultAggs = aggs
        .filter(({ key }) => !key.includes('variants'))
        .map(({ key }) => {
            const otherAggs = aggs.filter(({ key: compareKey }) => compareKey !== key);
            
            const variantTerms = buildTerms({ aggs: otherAggs, includesVariants: true });
            const defaultTerms = buildTerms({ aggs: otherAggs });
            
            const readyAggs =  {
                [key]: {
                    global: {},
                    aggs: variantTerms.length > 0 || defaultTerms?.length > 0 ? {
                        filtered_data: {
                            filter: {
                                bool: {
                                    must: [
                                        ...defaultTerms,
                                    ]
                                }
                            },
                            aggs: {
                                [key]: {
                                    terms: {
                                        field: key,
                                        size: 10,
                                    }
                                }
                            },
                        }
                    } : {
                        [key]: {
                            terms: {
                                field: key,
                                size: 10,
                            }
                        }
                    }
                }
            };

            if(variantTerms.length > 0) {
                readyAggs[key].aggs.filtered_data.filter.bool.must.push({
                    nested: {
                        path: 'variants',
                        query: {
                            bool: {
                                must: [...variantTerms]
                            }
                        }
                    }
                })
            };

            return readyAggs;
    });

    if(variantAggs.length > 0 || defaultAggs.length > 0) {
        [...defaultAggs, ...variantAggs,].forEach(item => {
            const [key, value] = Object.entries(item)[0];
            convertedAggs[key] = value;
          });
    }

    return convertedAggs;
};

const buildTerms = ({ aggs, includesVariants = false }) => {
    const terms = includesVariants
        ? aggs.filter(({ key }) => key.includes('variants.'))
        : aggs.filter(({ key }) => !key.includes('variants.'))
    
    let newTerms = [];

    terms.forEach(({ key, values }) => {

        if(values.length > 0) {
            if(key.includes('_in')) {
                return values.map((v) => newTerms.push({
                    wildcard: {
                        [key.split('_in')[0]]: v,
                    }
                }))
            }
            if (key.includes('_ex')) {
                return values.map((v) => newTerms.push({
                    bool: {
                        must_not: [
                            {
                                wildcard: {
                                    [key.split('_ex')[0]]: v, // Exclude the values
                                }
                            }
                        ]
                    }
                }));
            }
            else {
                return newTerms.push({ 
                    terms: { 
                        [key]: values, 
                    }
                })
            }
        }
    });
    
    return newTerms.filter(Boolean);
};

const buildFilters = (aggs) => {
    const variantTerms = buildTerms({ aggs, includesVariants: true });
    const filters = buildTerms({ aggs, });

    if(variantTerms.length > 0) {
        filters.push({
            nested: {
                path: 'variants',
                query: [...variantTerms]
            }
        })
    };
    
    return filters;
};

const parseAggs = ({ aggs, searchQuery, }) => {
    if(aggs && aggs?.length > 0) {
        const aggsArray = aggs.split('&');
        const formattedAggs = aggsArray.map((i) => {
            const [key, values] = i.split('=');
            return {
                key,
                values: values?.split(',') || []
            }
        });

        const readyFilters = buildFilters(formattedAggs);

        if(readyFilters.length > 0) {
            searchQuery.query.bool.filter = readyFilters;
        }

        searchQuery.aggs = buildAggs(formattedAggs);
    };
};

const getSortCriteria = (sortBy) => {
    switch (sortBy) {
        case 'newest':
            return [
                {
                    'created_at': {
                        order: 'desc'
                    }
                }
            ];

        case 'priceHighToLow':
            return [
                {
                    'minPrice': {
                        order: 'desc'
                    }
                }
            ];

        case 'priceLowToHigh':
            return [
                {
                    'minPrice': {
                        order: 'asc'
                    }
                }
            ];

        case 'relevance':
        default:
            return [
                {
                    '_score': {
                        order: 'desc'
                    }
                }
            ];
    }
};

module.exports = {
    getSortCriteria,
    parseAggs,
}