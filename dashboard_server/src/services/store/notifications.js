const getError = require('../../../../shared_utils/getError');
const pool = require('../../helpers/db');
const executeQueryWithoutPool = require('../../helpers/executeQueryWithoutPool');
const { Expo } = require('expo-server-sdk');

// Initialize Expo client
const expo = new Expo();

const sendNotificationService = async ({ storeId, title, subtitle, body }) => {
    const client = await pool.connect();
    try {

        const result = await executeQueryWithoutPool({
            client,
            query: 'SELECT token FROM notifications WHERE store_id = $1',
            params: [storeId],
        });

        const tokens = result.rows.map(row => row.token).filter(token => Expo.isExpoPushToken(`ExponentPushToken[${token}]`));

        if (!tokens.length) {
            throw getError(404, 'No valid tokens found for this store.')
        }

        const messages = tokens.map(token => ({
            to: token,
            title,
            subtitle,
            body,
            sound: 'default',
        }));

        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }

        const badTokens = [];

        tickets.forEach((ticket, index) => {
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                badTokens.push(tokens[index]);
            }
        });

        if (badTokens.length > 0) {
            await executeQueryWithoutPool({
                client,
                query: 'DELETE FROM notifications WHERE token = ANY($1)',
                params: [badTokens],
            });
        }

        return {
            ok: true,
            message: 'Notifications sent successfully',
            sentCount: tokens.length - badTokens.length,
            failedCount: badTokens.length,
        };

    } catch (error) {
        if(error?.error) {
            throw error;
        };

        throw getError(500, 'Error pushing notifications.');
    } finally {
        client.release();
    }
};

module.exports = {
    sendNotificationService,
};