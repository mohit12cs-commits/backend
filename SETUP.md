# 🚀 Quick Setup Guide

## ✅ Firebase Migration Complete!

All MongoDB code has been converted to Firebase Firestore. Follow these steps to get started:

---

## Step 1: Copy Environment Variables

Copy the `.env.example` to `.env`:

```bash
cp .env.example .env
```

Your Firebase credentials are already configured in `.env.example`:
- ✅ FIREBASE_PROJECT_ID
- ✅ FIREBASE_PRIVATE_KEY_ID
- ✅ FIREBASE_PRIVATE_KEY
- ✅ FIREBASE_CLIENT_EMAIL
- ✅ FIREBASE_CLIENT_ID
- ✅ FIREBASE_CLIENT_CERT_URL

**Important:** Update the `TOKEN_SECRET` in your `.env` file with a secure random string.

---

## Step 2: Install Dependencies

```bash
npm install
```

This will install:
- ✅ `firebase-admin@^12.0.0` (NEW)
- ✅ All other existing dependencies
- ❌ `mongoose` (REMOVED)

---

## Step 3: Start the Server

```bash
npm run dev
```

You should see:
```
Firebase connected successfully
```

---

## 🔍 Verify Migration

### Test Firebase Connection

The server should start without errors and show:
```
Firebase connected successfully
```

### Test API Endpoints

1. **User Login:**
```bash
POST http://localhost:3000/api/user/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

2. **Admin Login:**
```bash
POST http://localhost:3000/api/admin/login
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

---

## 📝 Key Changes

### ID Field
- **Before (MongoDB):** `user._id` (ObjectId)
- **After (Firebase):** `user.id` (string)

### Collections
All data is now stored in Firestore collections:
- `users`
- `admins`
- `trades`
- `limitOrders`
- `walletTransactions`
- `wishlists`
- `tokens`

---

## 🐛 Troubleshooting

### Error: "Firebase connection error"
**Solution:** Check your `.env` file has all Firebase credentials.

### Error: "Cannot find module 'firebase-admin'"
**Solution:** Run `npm install`

### Error: "Cannot find module 'mongoose'"
**Solution:** This is expected! Mongoose has been removed. Run `npm install` to clean up.

---

## ✅ You're Ready!

Your backend is now running on Firebase Firestore! 🎉

All APIs work exactly the same way, just with Firebase as the database instead of MongoDB.
