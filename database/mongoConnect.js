const mongoose = require('mongoose');

const connectDb = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            process.env.DATABASE
        )
        console.log('MongoDb connected: ', process.env.DATABASE);
    } catch (error) {
        console.log('MongoDb connection error: ', error.message);
        process.exit(1);
    }
}

connectDb();
