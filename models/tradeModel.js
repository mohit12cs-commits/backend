const { db } = require('../database/firebaseConnect');

class Trade {
    constructor(data) {
        this.id = data.id || null;
        this.type = data.type || '';
        this.instrument_id = data.instrument_id || 0;
        this.tradingsymbol = data.tradingsymbol || '';
        this.name = data.name || '';
        this.exchange = data.exchange || '';
        this.price = data.price || 0;
        this.quantity = data.quantity || 0;
        this.sell_quantity = data.sell_quantity || 0;
        this.user = data.user || '';
        this.buy_type = data.buy_type || '';
        this.marginBlocked = data.marginBlocked || 0;
        this.expiry = data.expiry || null;
        this.lot_size = data.lot_size || 0;
        this.instrument_type = data.instrument_type || '';
        this.order_type = data.order_type || '';
        this.show_type = data.show_type || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('trades');
    }

    static async create(data) {
        const trade = new Trade(data);
        await trade.save();
        return trade;
    }

    async save() {
        this.updatedAt = new Date();
        const tradeData = {
            type: this.type,
            instrument_id: this.instrument_id,
            tradingsymbol: this.tradingsymbol,
            name: this.name,
            exchange: this.exchange,
            price: this.price,
            quantity: this.quantity,
            sell_quantity: this.sell_quantity,
            user: this.user,
            buy_type: this.buy_type,
            marginBlocked: this.marginBlocked,
            expiry: this.expiry,
            lot_size: this.lot_size,
            instrument_type: this.instrument_type,
            order_type: this.order_type,
            show_type: this.show_type,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await Trade.getCollection().doc(this.id).update(tradeData);
            return this;
        } else {
            tradeData.createdAt = this.createdAt;
            const docRef = await Trade.getCollection().add(tradeData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        const doc = await Trade.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new Trade({ id: doc.id, ...doc.data() });
    }

    static async findOne(query) {
        let queryRef = Trade.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.limit(1).get();
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return new Trade({ id: doc.id, ...doc.data() });
    }

    static async find(query = {}) {
        let queryRef = Trade.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object') {
                if (value.$gte) queryRef = queryRef.where(key, '>=', value.$gte);
                if (value.$lt) queryRef = queryRef.where(key, '<', value.$lt);
                if (value.$in) queryRef = queryRef.where(key, 'in', value.$in);
            } else {
                queryRef = queryRef.where(key, '==', value);
            }
        }
        
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new Trade({ id: doc.id, ...doc.data() }));
    }

    static async deleteMany(query) {
        const trades = await Trade.find(query);
        const batch = db.batch();
        
        trades.forEach(trade => {
            batch.delete(Trade.getCollection().doc(trade.id));
        });
        
        await batch.commit();
        return { deletedCount: trades.length };
    }

    static async updateOne(query, updateData) {
        const trade = await Trade.findOne(query);
        if (!trade) return null;
        
        Object.assign(trade, updateData);
        await trade.save();
        return trade;
    }

    static async countDocuments(query = {}) {
        let queryRef = Trade.getCollection();
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object') {
                if (value.$gte) queryRef = queryRef.where(key, '>=', value.$gte);
                if (value.$lt) queryRef = queryRef.where(key, '<', value.$lt);
                if (value.$in) queryRef = queryRef.where(key, 'in', value.$in);
            } else {
                queryRef = queryRef.where(key, '==', value);
            }
        }
        const snapshot = await queryRef.get();
        return snapshot.size;
    }

    static async findWithSort(query = {}, sortField = 'createdAt', sortOrder = 'desc') {
        let queryRef = Trade.getCollection();
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object') {
                if (value.$gte) queryRef = queryRef.where(key, '>=', value.$gte);
                if (value.$lt) queryRef = queryRef.where(key, '<', value.$lt);
                if (value.$in) queryRef = queryRef.where(key, 'in', value.$in);
            } else {
                queryRef = queryRef.where(key, '==', value);
            }
        }
        queryRef = queryRef.orderBy(sortField, sortOrder);
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new Trade({ id: doc.id, ...doc.data() }));
    }
}

module.exports = Trade;
  

