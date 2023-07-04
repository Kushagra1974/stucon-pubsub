import mongoose from "mongoose"

const db = mongoose.connection.useDb("stucon")


export { db }
