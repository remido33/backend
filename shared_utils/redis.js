const Redis = require('ioredis');

let redis;

const initializeRedis = () => {
    try {
        const redisURL = process.env.REDIS_URL;

        redis = new Redis(redisURL, {
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        redis.on('connect', () => {
            console.log('Connected to Redis');
        });

        redis.on('error', (error) => {
            console.error('Redis error:', error);
        });

        redis.on('end', () => {
            console.log('Redis connection closed');
        });

        redis.on('reconnecting', () => {
            console.log('Reconnecting to Redis...');
        });
    } catch (error) {
        console.error('Unable to connect to Redis:', error);
    }
};

initializeRedis();

module.exports = redis;
