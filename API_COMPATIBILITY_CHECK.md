# 📱 Mobile App API Compatibility Check

## Mobile App APIs vs Backend Routes

### ✅ **User APIs (Mobile App)**

| Mobile App Endpoint | Method | Backend Route | Status | Notes |
|---------------------|--------|---------------|--------|-------|
| `/api/user/login` | POST | ✅ `/api/user/login` | ✅ **Compatible** | User login |
| `/api/user/logout` | POST | ✅ `/api/user/logout` | ✅ **Compatible** | User logout |
| `/api/user` | GET | ✅ `/api/user` | ✅ **Compatible** | Get user profile |
| `/api/search` | GET | ✅ `/api/search` | ✅ **Compatible** | Search instruments |
| `/api/ohlc` | GET | ✅ `/api/ohlc` | ✅ **Compatible** | Get OHLC data |
| `/api/historical` | GET | ✅ `/api/historical` | ✅ **Compatible** | Get historical data |
| `/api/wishlist/:name/:token` | POST | ✅ `/api/wishlist/:wishlist_name/:instrument_token` | ✅ **Compatible** | Add to wishlist |
| `/api/wishlist/:name` | GET | ✅ `/api/wishlist/:wishlist_name` | ✅ **Compatible** | Get wishlist |
| `/api/wishlist/:id` | DELETE | ✅ `/api/wishlist/:id` | ✅ **Compatible** | Delete from wishlist |
| `/api/portfolio?type=holding` | GET | ✅ `/api/portfolio` | ✅ **Compatible** | Get holdings |
| `/api/portfolio?type=position` | GET | ✅ `/api/portfolio` | ✅ **Compatible** | Get positions |
| `/api/portfolio?type=open` | GET | ✅ `/api/portfolio` | ✅ **Compatible** | Get open orders |
| `/api/portfolio?type=executed` | GET | ✅ `/api/portfolio` | ✅ **Compatible** | Get executed orders |
| `/api/buy` | POST | ✅ `/api/buy` | ✅ **Compatible** | Buy shares |
| `/api/sell` | POST | ✅ `/api/sell` | ✅ **Compatible** | Sell shares |
| `/api/order/cancel/:id` | POST | ✅ `/api/order/cancel/:id` | ✅ **Compatible** | Cancel order |
| `/api/order/modify/:id` | POST | ✅ `/api/order/modify/:id` | ✅ **Compatible** | Modify order |
| `/api/wallet` | GET | ✅ `/api/wallet` | ✅ **Compatible** | Get wallet transactions |

---

## 🔍 **Detailed API Analysis**

### 1. **User Authentication**
```dart
// Mobile App
POST /api/user/login
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 14

---

### 2. **Search API**
```dart
// Mobile App
GET /api/search?search=NIFTY
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 21

---

### 3. **OHLC Data**
```dart
// Mobile App
GET /api/ohlc?symbols=NSE:NIFTY 50,NSE:NIFTY BANK
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 22

---

### 4. **Historical Data**
```dart
// Mobile App
GET /api/historical?instrumentToken=123&from=2024-01-01&to=2024-12-31&interval=minute
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 24

---

### 5. **Wishlist Management**
```dart
// Mobile App - Add to Wishlist
POST /api/wishlist/watchlist1/256265

// Mobile App - Get Wishlist
GET /api/wishlist/watchlist1

// Mobile App - Delete from Wishlist
DELETE /api/wishlist/507f1f77bcf86cd799439011
```
**Backend:** ✅ All available in `routes/usersRoute.js` lines 26-28

---

### 6. **Portfolio APIs**
```dart
// Mobile App - Holdings
GET /api/portfolio?type=holding

// Mobile App - Positions
GET /api/portfolio?type=position

// Mobile App - Open Orders
GET /api/portfolio?type=open

// Mobile App - Executed Orders
GET /api/portfolio?type=executed
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 32

---

### 7. **Buy/Sell APIs**
```dart
// Mobile App - Buy
POST /api/buy
{
  "instrument_id": 256265,
  "quantity": 10,
  "type": "market",
  "show_type": "market"
}

// Mobile App - Sell
POST /api/sell
{
  "instrument_id": 256265,
  "quantity": 10,
  "type": "market",
  "show_type": "market"
}
```
**Backend:** ✅ Both available in `routes/usersRoute.js` lines 30-31

---

### 8. **Order Management**
```dart
// Mobile App - Cancel Order
POST /api/order/cancel/507f1f77bcf86cd799439011

// Mobile App - Modify Order
POST /api/order/modify/507f1f77bcf86cd799439011
{
  "price": 150.50,
  "quantity": 5
}
```
**Backend:** ✅ Both available in `routes/usersRoute.js` lines 38-39

---

### 9. **Wallet API**
```dart
// Mobile App
GET /api/wallet
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 33

---

### 10. **User Profile**
```dart
// Mobile App
GET /api/user
```
**Backend:** ✅ Available in `routes/usersRoute.js` line 17

---

## ⚠️ **Controller Issues to Fix**

While all routes are defined, some controller methods need MongoDB→Firebase updates:

### **userController.js Issues:**

1. **Line ~1257:** `.sort()` → Should use `findWithSort()`
   ```javascript
   // Current (MongoDB)
   const openTrades = await LimitOrder.find({...}).sort({updatedAt: -1});
   
   // Should be (Firebase)
   const openTrades = await LimitOrder.findWithSort({...}, 'updatedAt', 'desc');
   ```

2. **Line ~1370:** `new ObjectId()` in aggregation
   ```javascript
   // Current (MongoDB)
   user: new ObjectId(req.user._id)
   
   // Should be (Firebase)
   user: req.user._id  // Already a string in Firebase
   ```

3. **Line ~1403:** `.sort()` → Should use `findWithSort()`
   ```javascript
   // Current (MongoDB)
   const transactions = await WalletTransaction.find({...}).sort({createdAt: -1});
   
   // Should be (Firebase)
   const transactions = await WalletTransaction.findWithSort({...}, 'createdAt', 'desc');
   ```

4. **Line ~1425:** `.sort()` → Should use `findWithSort()`
   ```javascript
   // Current (MongoDB)
   const transactions = await WalletTransaction.find({...}).sort({createdAt: -1});
   
   // Should be (Firebase)
   const transactions = await WalletTransaction.findWithSort({...}, 'createdAt', 'desc');
   ```

5. **Line 1015-1028:** Syntax error in `getPortfolio` function - needs fixing

6. **Line 347:** `.select()` method
   ```javascript
   // Current (MongoDB)
   const findUser = await User.findById(req.user._id).select('email name walletBalance');
   
   // Should be (Firebase)
   const findUser = await User.findById(req.user._id);
   // Then manually select fields if needed
   ```

7. **Line 571:** `findOneAndDelete()` → Should use `findOne()` + `delete()`
   ```javascript
   // Current (MongoDB)
   const wishlistItem = await Wishlist.findOneAndDelete({...});
   
   // Should be (Firebase)
   const wishlistItem = await Wishlist.findOne({...});
   if (wishlistItem) {
     await Wishlist.getCollection().doc(wishlistItem.id).delete();
   }
   ```

8. **Line 394, 931, 995:** `findOneAndUpdate()` → Should use `findOne()` + `save()`
   ```javascript
   // Current (MongoDB)
   await Token.findOneAndUpdate({}, { token: accessToken }, { new: true, upsert: true });
   
   // Should be (Firebase)
   let token = await Token.findOne({});
   if (!token) {
     token = new Token({ token: accessToken });
   } else {
     token.token = accessToken;
   }
   await token.save();
   ```

9. **Line 190:** `updateMany()` → Already implemented in Firebase models ✅

10. **Line 192-210:** `aggregate()` → Needs custom implementation
    ```javascript
    // MongoDB aggregation not supported in Firestore
    // Need to fetch data and process in JavaScript
    ```

---

## ✅ **Summary**

### **Routes:** 100% Compatible ✅
All mobile app endpoints are defined in the backend routes.

### **Models:** 100% Converted ✅
All 7 models are converted to Firebase Firestore.

### **Controllers:** ~85% Complete ⚠️
Most controller logic works, but needs these updates:
- Replace `.sort()` with `findWithSort()`
- Replace `.select()` with manual field selection
- Replace `findOneAndUpdate()` with `findOne()` + `save()`
- Replace `findOneAndDelete()` with `findOne()` + `delete()`
- Remove `new ObjectId()` usage
- Fix aggregation queries
- Fix syntax errors

---

## 🚀 **Next Steps**

1. **Fix remaining controller issues** (listed above)
2. **Test all APIs** with Postman or mobile app
3. **Deploy to production**

---

## 📝 **Testing Checklist**

- [ ] User login/logout
- [ ] Search instruments
- [ ] Get OHLC data
- [ ] Get historical data
- [ ] Add/get/delete wishlist
- [ ] Get portfolio (holding/position/open/executed)
- [ ] Buy shares (market/limit)
- [ ] Sell shares (market/stoploss)
- [ ] Cancel/modify orders
- [ ] Get wallet transactions
- [ ] Get user profile

---

**All mobile app APIs are supported by the backend routes!** 🎉

The main work remaining is fixing the controller methods to use Firebase instead of MongoDB methods.
