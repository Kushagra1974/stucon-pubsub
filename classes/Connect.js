import mongoose from 'mongoose'

async function connectToDB() {
    try {
        console.log("wating for DB-connection");
        await mongoose.connect(
            process.env.MONGO_DB
        );
        console.log("connected to DB");
    }
    catch (err) {
        console.log(err);
    }
}

export { connectToDB } 