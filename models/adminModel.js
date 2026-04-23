const { db } = require('../database/firebaseConnect');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class Admin {
    constructor(data) {
        this.id = data.id || null;
        this.email = data.email || '';
        this.name = data.name || '';
        this.password = data.password || '';
        this.token = data.token || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('admins');
    }

    static async create(data) {
        const admin = new Admin(data);
        
        // Hash password before saving
        if (admin.password) {
            admin.password = await bcrypt.hash(admin.password, 10);
        }
        
        await admin.save();
        return admin;
    }

    async save() {
        this.updatedAt = new Date();
        const adminData = {
            email: this.email.toLowerCase().trim(),
            name: this.name.trim(),
            password: this.password,
            token: this.token,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await Admin.getCollection().doc(this.id).update(adminData);
            return this;
        } else {
            adminData.createdAt = this.createdAt;
            const docRef = await Admin.getCollection().add(adminData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        const doc = await Admin.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new Admin({ id: doc.id, ...doc.data() });
    }

    static async findOne(query) {
        let queryRef = Admin.getCollection();
        
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
        return new Admin({ id: doc.id, ...doc.data() });
    }

    static async deleteOne(query) {
        const admin = await Admin.findOne(query);
        if (admin) {
            await Admin.getCollection().doc(admin.id).delete();
            return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
    }

    async generateToken() {
        return jwt.sign(
            {
                _id: this.id,
                email: this.email,
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
            token: this.token
        };
    }
}

module.exports = Admin;



