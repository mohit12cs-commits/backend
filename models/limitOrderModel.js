const { db } = require('../database/firebaseConnect');

class LimitOrder {
    constructor(data) {
        this.id = data.id || null;
        this.status = data.status || 'pending';
        this.instrument_id = data.instrument_id || 0;
        this.tradingsymbol = data.tradingsymbol || '';
        this.name = data.name || '';
        this.exchange = data.exchange || '';
        this.price = data.price || 0;
        this.quantity = data.quantity || 0;
        this.lot_size = data.lot_size || 0;
        this.expiry = data.expiry || null;
        this.marginBlocked = data.marginBlocked || 0;
        this.instrument_type = data.instrument_type || '';
        this.order_type = data.order_type || '';
        this.buy_type = data.buy_type || '';
        this.show_type = data.show_type || '';
        this.user = data.user || '';
        this.buy_price = data.buy_price || 0;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('limitOrders');
    }

    static async create(data) {
        const order = new LimitOrder(data);
        await order.save();
        return order;
    }

    async save() {
        this.updatedAt = new Date();
        const orderData = {
            status: this.status,
            instrument_id: this.instrument_id,
            tradingsymbol: this.tradingsymbol,
            name: this.name,
            exchange: this.exchange,
            price: this.price,
            quantity: this.quantity,
            lot_size: this.lot_size,
            expiry: this.expiry,
            marginBlocked: this.marginBlocked,
            instrument_type: this.instrument_type,
            order_type: this.order_type,
            buy_type: this.buy_type,
            show_type: this.show_type,
            user: this.user,
            buy_price: this.buy_price,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await LimitOrder.getCollection().doc(this.id).update(orderData);
            return this;
        } else {
            orderData.createdAt = this.createdAt;
            const docRef = await LimitOrder.getCollection().add(orderData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        const doc = await LimitOrder.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new LimitOrder({ id: doc.id, ...doc.data() });
    }

    static async findOne(query) {
        let queryRef = LimitOrder.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.limit(1).get();
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return new LimitOrder({ id: doc.id, ...doc.data() });
    }

    static async find(query = {}) {
        let queryRef = LimitOrder.getCollection();
        
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
        return snapshot.docs.map(doc => new LimitOrder({ id: doc.id, ...doc.data() }));
    }

    static async findOneAndUpdate(query, updateData) {
        const order = await LimitOrder.findOne(query);
        if (!order) return null;
        
        Object.assign(order, updateData);
        await order.save();
        return order;
    }

    static async updateMany(query, updateData) {
        const orders = await LimitOrder.find(query);
        const batch = db.batch();
        
        orders.forEach(order => {
            Object.assign(order, updateData);
            order.updatedAt = new Date();
            batch.update(LimitOrder.getCollection().doc(order.id), {
                ...updateData,
                updatedAt: order.updatedAt
            });
        });
        
        await batch.commit();
        return { modifiedCount: orders.length };
    }

    static async countDocuments(query = {}) {
        let queryRef = LimitOrder.getCollection();
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
        let queryRef = LimitOrder.getCollection();
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
        return snapshot.docs.map(doc => new LimitOrder({ id: doc.id, ...doc.data() }));
    }
}

module.exports = LimitOrder;


  
  

