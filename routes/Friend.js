import express, { request, response } from "express"
import { verifyToken } from "../middleware/verify.js";
import { User } from "../modles/Schema.js";
import { Connection } from "../modles/Schema.js"
import { ConnectionRequest } from "../modles/Schema.js";
import { UserNotification } from "../modles/Schema.js";
import { Message } from "../modles/Schema.js"

export const friendRouter = express.Router();

friendRouter.route("/send-connection-request").post(verifyToken, async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        const prevReq = await ConnectionRequest.findOne({ user: userId, friend: friendId })
        if (prevReq) {
            return res.status(403).json("Friend Request Pending")
        }
        const newConnectionReq = new ConnectionRequest({ user: userId, friend: friendId });
        await newConnectionReq.save();
        res.status(202).json("Request Send")
    } catch (err) {
        console.log(err)
    }
})

friendRouter.route("/get-friend-request/:userId").get(async (req, res) => {

    try {
        const userId = req.params.userId
        const users = await ConnectionRequest.find({ friend: userId }).populate({ path: 'user', select: 'userName educationInstitute employer' }).select('user')
        const sendData = [];

        console.log(userId, users);

        if (users) {
            users.forEach(({ user }) => sendData.push({ _id: user._id, userName: user.userName, employer: user.employer, educationInstitute: user.educationInstitute }))
        }
        res.status(200).json(sendData)
    } catch (err) {
        console.log(err);
    }
})

friendRouter.route("/accept-connection-request").post(verifyToken, async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await ConnectionRequest.findOneAndDelete({ friend: userId, user: friendId })
        await ConnectionRequest.findOneAndDelete({ friend: friendId, user: userId })
        const newConnection = new Connection({ user: userId, friend: friendId });
        const inverseNewConnection = new Connection({ user: friendId, friend: userId })
        await newConnection.save();
        await inverseNewConnection.save();
        const newuserNoftifi = new UserNotification({ user: friendId, friend: userId, type: "CONNECTION_REQUEST_ACCEPTED" })
        await newuserNoftifi.save()
        res.status(201).json("Request_Accepted")
    } catch (err) {
        console.log(err)
    }
})

friendRouter.route("/get-my-friends/:userId").get(async (req, res) => {
    try {
        const userId = req.params.userId
        if (!userId) return res.status(400).json('User Id Required')
        const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')

        const sendData = [];
        friends.forEach(({ friend }) => {
            sendData.push({ friend: { ...friend._doc } })
        })
        res.status(200).json(sendData)
    } catch (err) {
        res.status(500).json("Internal Server Error")
        console.log(err)
    }
})

friendRouter.route("/get-user-with-unread-messages/:userId").get(async (req, res) => {
    const userId = req.params.userId
    try {
        const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
        const idArray = [];
        friends.forEach((user) => {
            idArray.push(user.friend.id)
        })

        let count = 0;
        const resolveQuery = await Promise.all(idArray.map((friendId) => {
            return Message.find({ receiver: userId, sender: friendId, isRead: false });
        }))

        resolveQuery.forEach(users => {
            if (users.length > 0) count++;
        })
        res.status(200).json(count);
        console.log(96, count);

    } catch (err) {
        res.status(500).json("Server Error")
        console.log(err);
    }
})

friendRouter.route("/find-friends/:keyword/:userId").get(async (req, res) => {
    try {
        const keyword = req.params.keyword
        const userId = req.params.userId
        const allUsers = [];
        const nameUserAsKeyword = await User.find({ userName: { $regex: `^${keyword}` } }).select('userName educationInstitute employer')
        const employerUserAsKeyword = await User.find({ employer: { $regex: `^${keyword}` } }).select('userName educationInstitute employer')
        const educationInstituteUserAsKeyword = await User.find({ educationInstitute: { $regex: `^${keyword}` } }).select('userName educationInstitute employer')
        if (nameUserAsKeyword) nameUserAsKeyword.forEach(dt => dt._id.toString() !== userId && allUsers.push(dt));
        if (employerUserAsKeyword) employerUserAsKeyword.forEach(dt => dt._id.toString() !== userId && allUsers.push(dt));
        if (educationInstituteUserAsKeyword) educationInstituteUserAsKeyword.forEach(dt => dt._id.toString() !== userId && allUsers.push(dt));

        const friends = await Connection.find({ user: userId }).populate({ path: 'friend', select: 'userName email educationInstitute employer' }).select('friend')
        //contain user friends 
        const filterUserFriends = [];
        friends.forEach(({ friend }) => {
            filterUserFriends.push({ ...friend._doc })
        })

        filterUserFriends.sort((a, b) => {
            a._id.toString() > b._id.toString();
        })

        allUsers.sort((a, b) => {
            a._id.toString() > b._id.toString();
        })
        // console.log(filterUserFriends[0]._id.toString() > allUsers[allUsers.length - 1], filterUserFriends[filterUserFriends.length - 1] < allUsers[0]);

        if (allUsers.length === 0) return res.status(200).json(allUsers)
        if (filterUserFriends.length === 0) return res.status(200).json(allUsers);

        if (filterUserFriends[0]._id.toString() > allUsers[allUsers.length - 1]._id.toString() || filterUserFriends[filterUserFriends.length - 1]._id.toString() < allUsers[0]._id.toString()) return res.status(200).json(allUsers)

        let frndsIdx = 0;
        let userIdx = 0;
        const userLength = allUsers.length;
        const frndsLength = filterUserFriends.length

        const filterUsers = [];

        console.log(filterUserFriends, allUsers);

        while (frndsIdx < frndsLength && frndsIdx >= 0 && userIdx >= 0 && userIdx < userLength) {
            const currentUser = allUsers[userIdx];
            const currentFriend = filterUserFriends[frndsIdx];
            const currentUserId = currentUser._id.toString()
            const currentFriendId = currentFriend._id.toString();
            if (currentUserId === currentFriendId) {
                filterUsers.push({ ...currentUser._doc, isFriend: true });
                userIdx++;
                frndsIdx++;
            }
            else if (currentUserId < currentFriendId) {
                userIdx++;
                filterUsers.push(currentUser)
            }
            else {
                frndsIdx++;
            }
        }

        for (let i = userIdx; i < userLength; i++) {
            filterUsers.push(allUsers[i])
        }
        res.status(200).json(filterUsers)
    }
    catch (err) {
        console.log(err)
        res.status(500).json("Serve Error")
    }
})