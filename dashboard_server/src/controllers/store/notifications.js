const tryCatch = require("../../../../shared_utils/tryCatch");
const { 
    sendNotificationService, 
} = require("../../services/store/notifications");
const executeQuery = require('../../../../shared_utils/executeQuery');

const sendNotificationController = tryCatch(async (req,res) => {
    const { id, } = req.params;
    const { title, subtitle = '', body = '' } = req.body;
    
    const response = await sendNotificationService({
        storeId: id, 
        title, 
        subtitle, 
        body,
    });

    res.status(200).json(response);
});

const registerNotificationTokenController = tryCatch(async (req, res) => {
    const { id: storeId } = req.params;
    const { token, platformId } = req.body;
    const userAgent = req.headers['user-agent'];
    
    if (!userAgent || !/(Expo|android|iphone|ipad)/i.test(userAgent)) {
        return res.status(400).json({ error: "Invalid client" });
    }
    
    await executeQuery(
        'INSERT INTO notifications (store_id, platform_id, token) VALUES ($1, $2, $3)',
        [storeId, platformId, token]
    );    

    res.status(204).end();
});

module.exports = {
    sendNotificationController,
    registerNotificationTokenController,
}