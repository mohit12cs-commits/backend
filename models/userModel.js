const { db } = require('../database/firebaseConnect');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class User {
    constructor(data) {
        this.id = data.id || null;
        this.email = data.email || '';
        this.name = data.name || '';
        this.phone = data.phone || '';
        this.password = data.password || '';
        this.token = data.token || '';
        this.role = data.role || '';
        this.isBlocked = data.isBlocked || 'init';
        this.walletBalance = data.walletBalance || 0;
        this.trade_limit = data.trade_limit || 3;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('users');
    }

    static async create(data) {
        const user = new User(data);
        
        // Hash password before saving
        if (user.password) {
            user.password = await bcrypt.hash(user.password, 10);
        }
        
        await user.save();
        return user;
    }

    static async findByIdAndUpdate(id, updateData) {
        const user = await User.findById(id);
        if (!user) return null;
        
        Object.assign(user, updateData);
        await user.save();
        return user;
    }

    async save() {
        this.updatedAt = new Date();
        const userData = {
            email: this.email.toLowerCase().trim(),
            name: this.name.trim(),
            phone: this.phone || '',
            password: this.password,
            token: this.token,
            role: this.role,
            isBlocked: this.isBlocked,
            walletBalance: this.walletBalance,
            trade_limit: this.trade_limit,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await User.getCollection().doc(this.id).update(userData);
            return this;
        } else {
            userData.createdAt = this.createdAt;
            const docRef = await User.getCollection().add(userData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return null;
        }
        
        const doc = await User.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new User({ id: doc.id, ...doc.data() });
    }

    static async findOne(query) {
        let queryRef = User.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            if (key === 'email') {
                queryRef = queryRef.where(key, '==', value.toLowerCase());
            } else {
                queryRef = queryRef.where(key, '==', value);
            }
        }
        
        const snapshot = await queryRef.limit(1).get();
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return new User({ id: doc.id, ...doc.data() });
    }

    static async find(query = {}) {
        let queryRef = User.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new User({ id: doc.id, ...doc.data() }));
    }

    static async deleteOne(query) {
        const user = await User.findOne(query);
        if (user) {
            await User.getCollection().doc(user.id).delete();
            return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
    }

    static async countDocuments(query = {}) {
        let queryRef = User.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            if (key === '$gte' || key === '$lt' || key === '$in') continue;
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.get();
        return snapshot.size;
    }

    static async findWithSort(query = {}, sortField = 'createdAt', sortOrder = 'desc') {
        let queryRef = User.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object' && value.$in) {
                queryRef = queryRef.where(key, 'in', value.$in);
            } else {
                queryRef = queryRef.where(key, '==', value);
            }
        }
        
        queryRef = queryRef.orderBy(sortField, sortOrder);
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new User({ id: doc.id, ...doc.data() }));
    }

    static async findWithPagination(query = {}, page = 1, limit = 10, sortField = 'createdAt', sortOrder = 'desc') {
        let queryRef = User.getCollection();
        
        // Handle search with $or
        if (query.$or) {
            // Firestore doesn't support $or directly, we'll fetch all and filter in JS
            const snapshot = await queryRef.get();
            let users = snapshot.docs.map(doc => new User({ id: doc.id, ...doc.data() }));
            
            // Filter by $or conditions
            users = users.filter(user => {
                return query.$or.some(condition => {
                    return Object.entries(condition).every(([key, regex]) => {
                        if (regex instanceof RegExp) {
                            return regex.test(user[key]);
                        }
                        return user[key] === regex;
                    });
                });
            });
            
            // Sort
            users.sort((a, b) => {
                if (sortOrder === 'desc') {
                    return b[sortField] - a[sortField];
                }
                return a[sortField] - b[sortField];
            });
            
            // Paginate
            const start = (page - 1) * limit;
            return users.slice(start, start + limit);
        }
        
        // Normal query
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        queryRef = queryRef.orderBy(sortField, sortOrder);
        queryRef = queryRef.limit(limit);
        queryRef = queryRef.offset((page - 1) * limit);
        
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new User({ id: doc.id, ...doc.data() }));
    }

    async generateToken() {
        return jwt.sign(
            {
                _id: this.id,
                email: this.email,
                role: this.role,
            },
            process.env.TOKEN_SECRET
        );
    }

    async isPasswordCorrect(password) {
        return await bcrypt.compare(password, this.password);
    }

    toJSON1() {
        return {
            _id: this.id,
            email: this.email,
            name: this.name,
            token: this.token,
        };
    }
}

module.exports = User;



