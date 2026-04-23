const { db } = require('../database/firebaseConnect');

class Token {
    constructor(data) {
        this.id = data.id || null;
        this.token = data.token || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('tokens');
    }

    static async create(data) {
        const token = new Token(data);
        await token.save();
        return token;
    }

    async save() {
        this.updatedAt = new Date();
        const tokenData = {
            token: this.token,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await Token.getCollection().doc(this.id).update(tokenData);
            return this;
        } else {
            tokenData.createdAt = this.createdAt;
            const docRef = await Token.getCollection().add(tokenData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        const doc = await Token.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new Token({ id: doc.id, ...doc.data() });
    }

    static async findOne(query) {
        let queryRef = Token.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.limit(1).get();
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return new Token({ id: doc.id, ...doc.data() });
    }

    static async deleteOne(query) {
        const token = await Token.findOne(query);
        if (token) {
            await Token.getCollection().doc(token.id).delete();
            return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
    }
}

module.exports = Token;



