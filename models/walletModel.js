const { db } = require('../database/firebaseConnect');

class WalletTransaction {
    constructor(data) {
        this.id = data.id || null;
        this.type = data.type || '';
        this.instrument_id = data.instrument_id || 0;
        this.tradingsymbol = data.tradingsymbol || '';
        this.exchange = data.exchange || '';
        this.name = data.name || '';
        this.amount = data.amount || 0;
        this.description = data.description || '';
        this.user = data.user || '';
        this.admin = data.admin || '';
        this.trade_id = data.trade_id || '';
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }

    static getCollection() {
        return db.collection('walletTransactions');
    }

    static async create(data) {
        const transaction = new WalletTransaction(data);
        await transaction.save();
        return transaction;
    }

    async save() {
        this.updatedAt = new Date();
        const transactionData = {
            type: this.type,
            instrument_id: this.instrument_id,
            tradingsymbol: this.tradingsymbol,
            exchange: this.exchange,
            name: this.name,
            amount: this.amount,
            description: this.description,
            user: this.user,
            admin: this.admin,
            trade_id: this.trade_id,
            updatedAt: this.updatedAt
        };

        if (this.id) {
            await WalletTransaction.getCollection().doc(this.id).update(transactionData);
            return this;
        } else {
            transactionData.createdAt = this.createdAt;
            const docRef = await WalletTransaction.getCollection().add(transactionData);
            this.id = docRef.id;
            return this;
        }
    }

    static async findById(id) {
        const doc = await WalletTransaction.getCollection().doc(id).get();
        if (!doc.exists) return null;
        return new WalletTransaction({ id: doc.id, ...doc.data() });
    }

    static async find(query = {}) {
        let queryRef = WalletTransaction.getCollection();
        
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new WalletTransaction({ id: doc.id, ...doc.data() }));
    }

    static async deleteMany(query) {
        const transactions = await WalletTransaction.find(query);
        const batch = db.batch();
        
        transactions.forEach(transaction => {
            batch.delete(WalletTransaction.getCollection().doc(transaction.id));
        });
        
        await batch.commit();
        return { deletedCount: transactions.length };
    }

    static async aggregate(pipeline) {
        // Firestore doesn't support aggregation pipelines like MongoDB
        // We need to implement this manually based on the pipeline
        const transactions = await WalletTransaction.find({});
        
        // Simple aggregation implementation for wallet balance calculation
        const result = {};
        
        transactions.forEach(transaction => {
            if (!result[transaction.user]) {
                result[transaction.user] = {
                    _id: transaction.user,
                    totalCredit: 0,
                    totalDebit: 0
                };
            }
            
            if (transaction.type === 'credit') {
                result[transaction.user].totalCredit += transaction.amount;
            } else if (transaction.type === 'debit') {
                result[transaction.user].totalDebit += transaction.amount;
            }
        });
        
        return Object.values(result).map(item => ({
            user: item._id,
            balance: item.totalCredit - item.totalDebit
        }));
    }

    static async findWithSort(query = {}, sortField = 'createdAt', sortOrder = 'desc') {
        let queryRef = WalletTransaction.getCollection();
        for (const [key, value] of Object.entries(query)) {
            queryRef = queryRef.where(key, '==', value);
        }
        queryRef = queryRef.orderBy(sortField, sortOrder);
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => new WalletTransaction({ id: doc.id, ...doc.data() }));
    }
}

module.exports = WalletTransaction;
  

