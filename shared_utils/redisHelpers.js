
const redis = require('./redis');
const getError = require("./getError");

const catchError = ({ error, fallbackMessage }) => {
    if(error?.error) {
        const { message, status } = error?.error;
        throw getError(status, message)
    }
    else {
        throw getError(500, fallbackMessage); // Set Hash failed 
    }
}

const setRedisHash = async (key, values, expirationInSeconds) => {
    try {
        await new Promise((resolve, reject) => {
            redis.hset(key, values, (error, result) => {
                if (error) {
                    reject(getError(500, 'Data update failed.')); // Set Hash failed.
                } else {
                    resolve();
                }
            });
        });

        if (expirationInSeconds) {
            await new Promise((resolve, reject) => {
                redis.expire(key, (Math.floor(Date.now() / 1000) + expirationInSeconds), (expireError) => {
                    if (expireError) {
                        reject(getError(500, 'Data update failed.')); // Set Hash with exparation failed.
                    } else {
                        resolve();
                    }
                });
            });
        }

        return { ok: true }
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data update failed.'
        });
       
    }
};

{/*

const userId = '123';
const defaultStoreId = '456';
const expirationInSeconds = 3600; // 1 hour

await setHash(userId, {
    id: userId,
    storeId: defaultStoreId,
}, optional: expirationInSeconds)


const fieldsToRetrieve = ['id', 'storeId'];

await getHash(userId, optional: fieldsToRetrieve);

*/}

const getRedisHash = async (key, fieldsToRetrieve) => {
    try {
        let values;
        if (!fieldsToRetrieve || fieldsToRetrieve.length === 0) {
            values = await new Promise((resolve, reject) => {
                redis.hgetall(key, (error, result) => {
                    if (error) {
                        reject(getError(500, 'Data retrieval failed.'));
                    } else {
                        resolve(result);
                    }
                });
            });
        } else {
            values = await new Promise((resolve, reject) => {
                redis.hmget(key, fieldsToRetrieve, (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
        }
        
        if (fieldsToRetrieve && fieldsToRetrieve.length > 0 && values.every(value => value === null)) {
            throw getError(404, 'Data was not found.');
        }

        const hashValues = {};
        if (values) {
            if (!fieldsToRetrieve || fieldsToRetrieve.length === 0) {
                Object.assign(hashValues, values);
            } else {
                for (let i = 0; i < fieldsToRetrieve.length; i++) {
                    hashValues[fieldsToRetrieve[i]] = values[i];
                }
            }
        }

        return hashValues;
    } catch (error) {

        catchError({ 
            error, 
            fallbackMessage: 'Data retrieval failed.',
        });
    }
};

{/*
const updates = [
    { key: 'field1', value: 'updated_value1' },
    { key: 'field2', value: 'updated_value2' },
];
*/}

const updateRedisHash = async (key, updates) => {

    try {
        if (!updates?.length || !Array.isArray(updates)) {
            throw getError(400, 'Invalid request data.');
        }

        // Check if the hash exists
        const exists = await new Promise((resolve, reject) => {
            redis.exists(key, (err, exists) => {
                if (err) {
                    reject(getError(500, 'Updating data failed. Step 1.'));
                } else {
                    resolve(exists === 1);
                }
            });
        });

        if (exists) {
            const existingFields = await new Promise((resolve, reject) => {
                redis.hkeys(key, (err, fields) => {
                    if (err) {
                        reject(getError(500, 'Updating data failed. Step 2.'));
                    } else {
                        resolve(fields);
                    }
                });
            });

            // Check if all the fields exist in the hash
            const missingFields = updates.filter(update => !existingFields.includes(update.key));
            if (missingFields.length > 0) {
                throw getError(500, `Fields do not exist in the hash: ${missingFields.map(field => field.key).join(', ')}.`);
            }

            // Update fields with the correct value types
            const fieldValues = updates.reduce((result, update) => {
                result[update.key] = typeof update.value === 'string' ? update.value : JSON.stringify(update.value);
                return result;
            }, {});

            await new Promise((resolve, reject) => {
                redis.hset(key, fieldValues, (err, reply) => {
                    if (err) {
                        reject(getError(500, 'Updating data failed. Step 3.'));
                    } else {
                        resolve(reply);
                    }
                });
            });

            // Get the new data after the update
            const newData = await new Promise((resolve, reject) => {
                redis.hgetall(key, (err, data) => {
                    if (err) {
                        reject(getError(500, 'Updating data failed. Step 4.'));
                    } else {
                        resolve(data);
                    }
                });
            });

            return {
                key: key,
                newData: newData
            };
        } else {
            throw getError(404, `Hash doesn't exist.`);
        }
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data update failed.',
        });
            
    }
};

const deleteRedisHash = async (key) => {
    try {
        await new Promise((resolve, reject) => {
            redis.del(key, (error, result) => {
                if (error) {
                    reject(getError(500, 'Delete data failed.'));
                } else {
                    resolve(result);
                }
            });
        });

        return { ok: true };
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data delete failed.',
        });
    }
};

const setRedisText = async (key, value, expirationInSeconds) => {
    try {
        await new Promise((resolve, reject) => {
            redis.set(key, value, (error, result) => {
                if (error) {
                    reject(getError(500, 'Data update failed.')); // Set text failed.
                } else {
                    resolve(result);
                }
            });
        });

        if (expirationInSeconds) {
            await new Promise((resolve, reject) => {
                redis.expire(key, expirationInSeconds, (expireError) => {
                    if (expireError) {
                        reject(getError(500, 'Data update failed.')); // Set text with expiration failed.
                    } else {
                        resolve();
                    }
                });
            });
        }

        return { ok: true };
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data update failed.',
        });
    }
};

const getRedisText = async (key) => {
    try {
        return await new Promise((resolve, reject) => {
            redis.get(key, (err, result) => {
                if (err) {
                    reject(getError(500, 'Get text data failed.'));
                } else {
                    resolve(result);
                }
            });
        });
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data retrieval failed.',
        });
    }
};

const deleteRedisText = async (key) => {
    try {
        await new Promise((resolve, reject) => {
            redis.del(key, (error, result) => {
                if (error) {
                    reject(getError(500, 'Delete text failed.'));
                } else {
                    resolve(result);
                }
            });
        });

        return { ok: true };
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data delete failed.',
        });
    }
};

const getRedisSet = async (key) => {
    try {
        return await new Promise((resolve, reject) => {
            redis.smembers(key, (err, members) => {
                if (err) {
                    reject(getError(500, 'Get set data failed.'));
                } else {
                    resolve(members);
                }
            });
        });
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data retrieval failed.',
        });
    }
};

const setRedisSet = async (key, members) => {
    try {
        await new Promise((resolve, reject) => {
            redis.sadd(key, members, (err, result) => {
                if (err) {
                    reject(getError(500, 'Set members failed.'));
                } else {
                    resolve(result);
                }
            });
        });
        
        return { ok: true };
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data update failed.',
        });
    }
};

const deleteKeysByPattern = async (prefix) => {
    try {
        const pattern = `${prefix}*`;
        let cursor = '0';
        let keys = [];

        do {
            const reply = await new Promise((resolve, reject) => {
                redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100', (error, result) => {
                    if (error) {
                        reject(getError(500, 'Scan failed.'));
                    } else {
                        resolve(result);
                    }
                });
            });

            cursor = reply[0];
            keys = keys.concat(reply[1]);
        } while (cursor !== '0');

        if (keys.length > 0) {
            await new Promise((resolve, reject) => {
                redis.del(keys, (error, result) => {
                    if (error) {
                        reject(getError(500, 'Delete keys failed.'));
                    } else {
                        resolve(result);
                    }
                });
            });
        }

        return { ok: true };
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data delete failed.',
        });
    }
};

const getAllRedisKeys = async (pattern) => {
    let cursor = '0';
    const keys = [];

    try {
        do {
            const result = await new Promise((resolve, reject) => {
                redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100, (err, res) => {
                    if (err) {
                        reject(getError(500, 'Scan failed'));
                    } else {
                        resolve(res);
                    }
                });
            });

            cursor = result[0];
            keys.push(...result[1]);
            
        } while (cursor !== '0');

        return keys;
    } catch (error) {
        catchError({ 
            error, 
            fallbackMessage: 'Data retrieval failed.',
        });
    }
};

module.exports = {
    setRedisHash,
    getRedisHash,
    deleteRedisHash,
    updateRedisHash,
    setRedisText,
    getRedisText,
    deleteRedisText,
    getRedisSet,
    setRedisSet,
    deleteKeysByPattern,
    getAllRedisKeys,
};