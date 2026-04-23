const { db } = require('../database/firebaseConnect');

class Wishlist {
    constructor(data) {
        this.id = data.id || null;
        this.instrument_token = data.instrument_token || 0;
        this.tradingsymbol = data.tradingsymbol || '';
        this.exchange = data.exchange || '';
        this.instrument_type = data.instrument_type || '';
        this.name = data.name || '';
        this.user = data.user || '';
        this.wishlist_name = data.wishlist_name || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('wishlists');
    }

    static async create(data) {
        const wishlist = new Wishlist(data);
        await wishlist.save();
        return wishlist;
    }

    async save() {
        this.updatedAt = new Date();
        const wishlistData = {
            instrument_token: this.instrument_token,
            tradingsymbol: this.tradingsymbol,
            exchange: this.exchange,
            instrument_type: this.instrument_type,
            name: this.name,
            user: this.user,
            wishlist_name: this.wishlist_name,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await Wishlist.getCollection().doc(this.id).update(wishlistData);
            return this;
        } else {
            wishlistData.createdAt = this.createdAt;
            const docRef = await Wishlist.getCollection().add(wishlistData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        const doc = await Wishlist.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new Wishlist({ id: doc.id, ...doc.data() });
    }

    static async findOne(query) {
        let queryRef = Wishlist.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.limit(1).get();
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return new Wishlist({ id: doc.id, ...doc.data() });
    }

    static async find(query = {}) {
        let queryRef = Wishlist.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new Wishlist({ id: doc.id, ...doc.data() }));
    }

    static async deleteMany(query) {
        const wishlists = await Wishlist.find(query);
        const batch = db.batch();
        
        wishlists.forEach(wishlist => {
            batch.delete(Wishlist.getCollection().doc(wishlist.id));
        });
        
        await batch.commit();
        return { deletedCount: wishlists.length };
    }

    static async findWithSort(query = {}, sortField = 'createdAt', sortOrder = 'desc') {
        let queryRef = Wishlist.getCollection();
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        queryRef = queryRef.orderBy(sortField, sortOrder);
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new Wishlist({ id: doc.id, ...doc.data() }));
    }
}

module.exports = Wishlist;



