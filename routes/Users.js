import express from "express";
import { User } from "../modles/Schema.js"
import { Connection } from "../modles/Schema.js";


export const userRouter = express.Router()

userRouter.route("/get-all-user").get(async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        console.log(err);
        res.status(500).json("Internal Error")
    }
})

userRouter.route("/get-user-name/:userId").get(async (req, res) => {

    const userId = req.params.userId;
    console.log(1, { userId });
    try {
        const userName = await User.findById(userId).select("userName");
        res.status(200).json(userName)
    } catch (err) {
        console.log(err);
    }
})

userRouter.route("/get-user-info/:userId/:reqestedProfileId/").get(async (req, res) => {
    try {
        const userId = req.params.userId;
        const reqestedProfileId = req.params.reqestedProfileId
        const fullUserdetails = await User.findById(reqestedProfileId, "userName email educationInstitute employer")
        const unCompleteUserDetails = await User.findById(reqestedProfileId, "userName educationInstitute employer")
        if (userId === reqestedProfileId) {
            return res.status(200).json(fullUserdetails)
        }
        else {
            const friends = await Connection.find({ user: userId })
            const result = friends.find((frnd => frnd.friend.toString() === reqestedProfileId))
            if (result) {
                return res.status(200).json(fullUserdetails)
            } else {
                return res.status(200).json(unCompleteUserDetails)
            }
        }
    } catch (err) {
        console.log(err);
        res.status(500).json("Server Error")
    }
})
