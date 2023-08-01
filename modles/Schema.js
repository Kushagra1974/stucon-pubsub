import mongoose from "mongoose";

import { Hash } from "../classes/Helper.js";

import { db } from "../classes/Config.js";


export const isValidObjectId = (id) => {

    const ObjectId = mongoose.Types.ObjectId
    if (ObjectId.isValid(id)) {
        if ((String)(new ObjectId(id)) === id)
            return true;
        return false;
    }
    return false;
}

const userSchema = mongoose.Schema({
    userName: {
        type: String, required: true
    },
    email: { type: String, required: true },
    password: {
        type: String, required: true
    },
    educationInstitute: {
        type: String, required: true,
    },
    employer: {
        type: String, required: true
    }
})
userSchema.pre("save", async function () {
    this.password = await Hash.generateHashPassword(this.password)
})
const User = db.model("User", userSchema)



const messageSchema = mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    receiver: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    message: { type: String, required: true },
    isRead: { type: Boolean, required: true },

}, {
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
})
const Message = db.model("Message", messageSchema);


const categoryImagesSchema = mongoose.Schema({
    category: { type: String, required: true },
    images: [{ type: String, required: true }]
})
const CategoryImages = db.model("CategoryImages", categoryImagesSchema);


const categoriesSchema = mongoose.Schema({
    name: { type: String, required: true }
})
const Categories = db.model("Categorie", categoriesSchema);


const connectionRequest = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    friend: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" }
}, {
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
})

const ConnectionRequest = db.model("ConnectioReqest", connectionRequest);

const GlobalNotificationSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    type: { type: String, required: true },
}, {
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
})

const GlobalNotification = db.model("PaperUploadNotification", GlobalNotificationSchema)

const UserNotificationSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    friend: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    type: { type: String, required: true }
}, {
    timestamps: {
        createdAt: true,
        updatedAt: false,
    }
})

const UserNotification = db.model("UserNotification", UserNotificationSchema);

const connectionSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    friend: { type: mongoose.Schema.Types.ObjectId, require: true, ref: "User" }
})
const Connection = db.model("Connection", connectionSchema);


export { User, Message, Categories, CategoryImages, Connection, ConnectionRequest, GlobalNotification, UserNotification }
