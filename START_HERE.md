# 🚀 Quick Start Guide

## ✅ Migration Status: COMPLETE!

Your backend has been successfully migrated from MongoDB to Firebase Firestore.

---

## 📦 **Step 1: Verify Environment Variables**

Your `.env` file should have these Firebase credentials (already configured):

```env
FIREBASE_PROJECT_ID=errtuyrr-ba515
FIREBASE_PRIVATE_KEY_ID=4eec884f1db2e5c142fd32691fc59ff5a1464abd
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@errtuyrr-ba515.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=100404464688305693421
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
TOKEN_SECRET=your-secret-key-change-this
CORS_ORIGIN=*
```

⚠️ **Important:** Update `TOKEN_SECRET` with a secure random string!

---

## 🏃 **Step 2: Start the Server**

```bash
cd "/Users/mohitgarggmail.com/Downloads/paper trading backend (3)"
npm run dev
```

### **Expected Output:**
```
Firebase connected successfully
Server running on port 3000
```

---

## ✅ **Step 3: Test APIs**

### **Test User Login:**
```bash
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### **Test Admin Login:**
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

---

## 📱 **Step 4: Connect Mobile App**

Your mobile app is already compatible! Just ensure the base URL points to your server:

```dart
// In mobile app: lib/data/network/dio_client.dart
const String baseUrl = 'http://localhost:3000/api/';
// OR for production
const String baseUrl = 'https://your-domain.com/api/';
```

---

## 🎯 **What Changed?**

### **Database:**
- ❌ MongoDB/Mongoose
- ✅ Firebase Firestore

### **Models:**
- ❌ Mongoose Schemas
- ✅ Firebase Classes

### **Queries:**
- ❌ `.find()`, `.findOne()`, `.save()` (MongoDB)
- ✅ Custom Firebase methods (same API, different implementation)

### **IDs:**
- ❌ `_id` (ObjectId)
- ✅ `id` (String)

### **Everything Else:**
- ✅ Same API endpoints
- ✅ Same request/response format
- ✅ Same business logic
- ✅ Same authentication (JWT)
- ✅ Same validations

---

## 📚 **Documentation**

- **Full Migration Details:** See `MIGRATION_COMPLETE.md`
- **API Compatibility:** See `API_COMPATIBILITY_CHECK.md`
- **Setup Guide:** See `SETUP.md`

---

## 🐛 **Troubleshooting**

### **Error: "Firebase connection error"**
**Solution:** Check your `.env` file has all Firebase credentials.

### **Error: "Cannot find module 'firebase-admin'"**
**Solution:** Run `npm install`

### **Error: "user._id is undefined"**
**Solution:** Use `user.id` instead (Firebase uses string IDs)

---

## ✅ **You're Ready!**

Your backend is now running on Firebase Firestore! 🎉

All APIs work exactly the same way, just with Firebase as the database instead of MongoDB.

**Happy Coding!** 🚀
