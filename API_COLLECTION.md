# Backend API Collection
**Base URL:** `https://backend-dwca.onrender.com`

## Authentication
Most endpoints require authentication via JWT token. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📱 User Routes

### 🔐 Authentication

#### Create User (Admin Only)
```http
POST /api/admin/create/user
```
**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### User Login
```http
POST /api/user/login
```
**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### User Logout
```http
POST /api/user/logout
```
**Headers:** `Authorization: Bearer <token>`

#### Get Single User
```http
GET /api/user
```
**Headers:** `Authorization: Bearer <token>`

---

### 📈 Market Data

#### Zerodha Admin Login
```http
GET /api/admin/login/zeroda
```

#### Redirect URL
```http
GET /api/redirect
```

#### Full Market Quotes
```http
GET /api/quote
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?instrument_token=256265`

#### Search Instruments
```http
GET /api/search
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?q=RELIANCE`

#### OHLC Data
```http
GET /api/ohlc
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?instrument_token=256265`

#### Historical Data
```http
GET /api/historical
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?instrument_token=256265&interval=day&from=2024-01-01&to=2024-01-31`

#### Get Index Data
```http
GET /api/indexes
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?page=1&perPage=20&search=NIFTY`

#### Get Option Data
```http
GET /api/option
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?symbol=NIFTY&expiry=2024-01-25`

#### Market Status
```http
GET /api/market/status
```
**Headers:** `Authorization: Bearer <token>`

---

### 💼 Trading

#### Buy Share
```http
POST /api/buy
```
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "instrument_token": "256265",
  "quantity": 10,
  "price": 2500,
  "order_type": "LIMIT",
  "buy_type": "regular"
}
```

#### Sell Share
```http
POST /api/sell
```
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "instrument_token": "256265",
  "quantity": 10,
  "price": 2500,
  "order_type": "LIMIT",
  "buy_type": "regular"
}
```

#### Get Portfolio
```http
GET /api/portfolio
```
**Headers:** `Authorization: Bearer <token>`
**Query:** `?type=holding` (holding, position, executed, open)

#### Get Wallet Details
```http
GET /api/wallet
```
**Headers:** `Authorization: Bearer <token>`

---

### 📋 Order Management

#### Cancel Order
```http
POST /api/order/cancel/:id
```
**Headers:** `Authorization: Bearer <token>`
**Params:** `id` (order ID)

#### Modify Order
```http
POST /api/order/modify/:id
```
**Headers:** `Authorization: Bearer <token>`
**Params:** `id` (order ID)
**Body:**
```json
{
  "price": 2500,
  "quantity": 10
}
```

---

### ⭐ Wishlist

#### Add to Wishlist
```http
POST /api/wishlist/:wishlist_name/:instrument_token
```
**Headers:** `Authorization: Bearer <token>`
**Params:** 
- `wishlist_name` (e.g., "favorites")
- `instrument_token` (e.g., "256265")

#### Get Wishlist
```http
GET /api/wishlist/:wishlist_name
```
**Headers:** `Authorization: Bearer <token>`
**Params:** `wishlist_name`

#### Delete from Wishlist
```http
DELETE /api/wishlist/:id
```
**Headers:** `Authorization: Bearer <token>`
**Params:** `id` (wishlist item ID)

---

### 📄 Data Export

#### Get CSV File
```http
GET /api/csv
```
**No authentication required**

---

## 👨‍💼 Admin Routes

### 🔐 Admin Authentication

#### Admin Register
```http
POST /api/admin/register
```
**Body:**
```json
{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "admin123"
}
```

#### Admin Login
```http
POST /api/admin/login
```
**Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

#### Admin Logout
```http
POST /api/admin/logout
```
**Headers:** `Authorization: Bearer <admin_token>`

---

### 👥 User Management

#### Get All Users
```http
GET /api/admin/user
```
**Headers:** `Authorization: Bearer <admin_token>`

#### Edit User
```http
POST /api/admin/user/:id
```
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id` (user ID)
**Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "walletBalance": 10000
}
```

---

### 💰 Wallet Management

#### Get User Wallet Details (Admin)
```http
GET /api/admin/wallet/:id
```
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id` (user ID)

---

## 📊 Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "message": "Success message"
}
```

### Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "errors": []
}
```

---

## 🚀 Rate Limiting

- **Limit:** 500 requests per 15 minutes per IP
- **Headers:** Rate limit info included in response headers

---

## 📝 Notes

1. **Authentication:** Most endpoints require JWT authentication
2. **Admin Routes:** Require admin authentication and permissions
3. **Market Data:** Some endpoints may require active market hours
4. **Trading:** Real trading operations with Zerodha integration
5. **Base URL:** `https://backend-dwca.onrender.com`

---

## 🔧 Testing

Use tools like Postman, Insomnia, or curl to test these endpoints. Make sure to:

1. Replace `<token>` with actual JWT tokens
2. Replace placeholder IDs and tokens with real values
3. Test in order: Authentication → Market Data → Trading
4. Handle rate limiting appropriately
