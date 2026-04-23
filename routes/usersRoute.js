var express = require('express');
const { login, logout, redirectUrl, halfMarketQuotes, fullMarketQuotes, getAccessToken, createUser, adminLogin, getcsvfile, searchData, historicalData, addWishlist, getWishlist, deleteWishlist, getWalletDetails, getPortfolio, sellShare, buyShare, getSingleUser, getOptionData, getIndexData, cancelOrder, modifyOrder, checkMarketStatus } = require('../controllers/userController');
const { auth } = require('../middleware/authentication');
const { userRegisterValidator, userLoginValidator } = require('../validators/userValidation');
const validate = require('../validators/validate');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post('/admin/create/user', userRegisterValidator(), validate, createUser)
router.get('/admin/login/zeroda', adminLogin)
router.post('/user/login', userLoginValidator(), validate, login)
router.post('/user/logout', auth, logout)

router.get('/user', auth, getSingleUser) 

router.get('/redirect', redirectUrl)
router.get('/quote', auth, fullMarketQuotes)
router.get('/search', auth, searchData)
router.get('/ohlc', auth, halfMarketQuotes)
router.get('/csv', getcsvfile)
router.get('/historical', auth, historicalData)

router.post('/wishlist/:wishlist_name/:instrument_token', auth, addWishlist)
router.get('/wishlist/:wishlist_name', auth, getWishlist)
router.delete('/wishlist/:id', auth, deleteWishlist)

router.post('/buy', auth, buyShare)
router.post('/sell', auth, sellShare)
router.get('/portfolio', auth, getPortfolio)
router.get('/wallet', auth, getWalletDetails)

router.get('/indexes', auth, getIndexData)
router.get('/option', auth, getOptionData)

router.post('/order/cancel/:id', auth, cancelOrder)
router.post('/order/modify/:id', auth, modifyOrder)

router.get('/market/status', auth, checkMarketStatus)


module.exports = router;
