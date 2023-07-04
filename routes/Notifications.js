import express from "express";
import { verifyToken } from '../middleware/verify.js'
import { GlobalNotification, UserNotification } from "../modles/Schema.js";

export const notificationRouter = express.Router();

notificationRouter.route("/get-notification/:userId").get(async (req, res) => {
    try {
        const userId = req.params.userId
        const glbNotification = await GlobalNotification.find().populate({ path: "user", select: "userName email educationInstitute employer" }).select('user type createdAt');
        const userNotification = await UserNotification.find({ user: userId }).populate({ path: "friend", select: "userName email educationInstitute employer" }).select('friend type createdAt')
        const allNotifications = [];
        glbNotification.forEach(user => allNotifications.push(user));
        userNotification.forEach(user => allNotifications.push(user));
        allNotifications.sort((x, y) => {
            const xDate = new Date(x.createdAt)
            const yDate = new Date(y.createdAt)
            return xDate < yDate
        })
        res.status(200).json(allNotifications)
    } catch (err) {
        res.status(500).json("Sever Error")
        console.log(err)
    }
})

notificationRouter.get("/get-global-notification", async (req, res) => {
    try {
        const glbNotification = await GlobalNotification.find().populate({ path: "user", select: "userName email educationInstitute employer" }).select('user type createdAt');
        // console.log(glbNotification);
        res.status(200).json(glbNotification)
    } catch (err) {
        res.status(500).json("Server Error")
        console.log(err);
    }
})

notificationRouter.get("/get-local-notification/:userId", verifyToken, async (req, res) => {
    try {
        const userId = req.params.userId
        const userNotification = await UserNotification.find({ user: userId }).populate({ path: "friend", select: "userName email educationInstitute employer" }).select('friend type createdAt')
        res.status(200).json(userNotification)
    } catch (err) {
        res.status(500).json("Server Error")
        console.log(err);
    }
})
