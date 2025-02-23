const router = require('express').Router();
const { 
    createUserController,
    verifyUserController,
    loginUserController,
    updateUserStoresController,
    getUserStoresController,
    deleteUserController,
} = require("../controllers/user");
const validateParams = require("../../../shared_utils/validateParams");
const { verifyToken, verifyAdminToken } = require('../../../shared_utils/verifyToken');
const { isEmail, isStringOfNumbersSeparatedByComma } = require('../../../shared_utils/validators');

router.post(
    '/',
    validateParams([
        { 
            key: 'body', 
            value: 'email', 
            validate: (value) => isEmail(value),
        },
        {
            key: 'body',
            value: 'storeIds',
            validate: (value) => isStringOfNumbersSeparatedByComma(value),
        }
    ]), 
    verifyAdminToken,
    createUserController
);

router.post(
    '/login',
    validateParams([
        { 
            key: 'body', 
            value: 'email', 
            validate: (value) => isEmail(value),
        },
    ]),
    loginUserController,
);

router.post(
    '/:id/verify',
    validateParams([
        {
            key: 'body',
            value: 'token',
            validate: (value) => value.toString().length === 6,
        }
    ]),
    verifyUserController,
);

router.delete(
    '/:id',
    verifyAdminToken,
    deleteUserController,
);

router.patch(
    '/:id/stores',
    validateParams([
        {
            key: 'body',
            value: 'storeIds',
            validate: (value) => isStringOfNumbersSeparatedByComma(value),
        }
    ]),
    verifyAdminToken,
    updateUserStoresController,
);

router.get(
    '/:id/stores',
    // verifyToken,
    getUserStoresController,
);


/* 
router.post(
    '/:id/validate',
    validateParams([
        {
            key: 'body',
            value: 'auth',
            type: 'string',
        }
    ]),
    validateUserController,
)    
*/

module.exports = router;