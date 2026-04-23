var express = require('express');
const {  adminAuth } = require('../middleware/authentication');
const { userLoginValidator } = require('../validators/userValidation');
const validate = require('../validators/validate');
const { login, logout, register, getUsers, editUser } = require('../controllers/adminController');
const { getWalletDetailsForAdmin } = require('../controllers/userController');
var router = express.Router();

router.post('/register', register)
router.post('/login', userLoginValidator(), validate, login)
router.post('/logout', adminAuth, logout)

// USER 
router.post('/user/:id', adminAuth, editUser)
router.get('/user', adminAuth, getUsers)

router.get('/wallet/:id', adminAuth, getWalletDetailsForAdmin)


module.exports = router;
