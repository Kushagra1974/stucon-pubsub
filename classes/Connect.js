import mongoose from 'mongoose'

async function connectToDB() {
    console.log("wating for DB-connection");
    await mongoose.connect(
        process.env.MONGO_DB
    );
    console.log("connected to DB");
}

export { connectToDB } 