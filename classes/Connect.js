import mongoose from 'mongoose'

class Connect {
    static async connectToDB() {
        try {
            await mongoose.connect(
                process.env.MONGO_DB,
                {
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                }
            );

            console.log('connected to ATLAS')
        } catch (err) {
            console.error(err);
        }
    }
}




export { Connect }