

const storeId = z.string().regex(/^\d+$/, 'Invalid id format');


module.exports = {
    storeId
}