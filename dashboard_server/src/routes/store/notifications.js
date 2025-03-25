const router = require('express').Router({ mergeParams: true });
const validateParams = require("../../../../shared_utils/validateParams");
const { verifyToken } = require('../../../../shared_utils/verifyToken');
const { sendNotificationController, registerNotificationTokenController } = require('../../controllers/store/notifications');

router.post(
    '/send',
    validateParams([
        {
            key: 'body',
            value: 'title',
            type: 'string',
        },
    ]),
    verifyToken,
    sendNotificationController,
);

router.post(
    '/register',
    validateParams([
        { 
            key: 'body', 
            value: 'token', 
            type: 'string',
        },
        {
            key: 'body',
            value: 'platformId',
            validate: (pl) => pl === 1 || pl === 2
        },
    ]),
    registerNotificationTokenController
);

    
module.exports = router;