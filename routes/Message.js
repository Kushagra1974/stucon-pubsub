import express from 'express'
import { verifyToken } from '../middleware/verify.js'
import { Message } from '../modles/Schema.js'

const messageRouter = express.Router()

const addTypeToObj = (messageArray, store, type) => {
    messageArray.forEach(msg => {
        store.push({ ...msg._doc, type })
    });
}

messageRouter.get('/get-all-message/:sender/:receiver', verifyToken, async (req, res) => {
    const { sender, receiver } = req.params;
    try {
        const sendMessags = await Message.find({ sender, receiver });
        const receivedMessags = await Message.find({ receiver: sender, sender: receiver });
        const messages = []


        addTypeToObj(receivedMessags, messages, "received");
        addTypeToObj(sendMessags, messages, "send");

        messages.sort((a, b) => {
            return (new Date(a.createdAt) - new Date(b.createdAt))
        })
        res.status(200).json(messages)
    } catch (err) {
        res.status(500).json('Internal Server Error')
        console.log(err);
    }
})

messageRouter.get('/get-read-messages/:sender/:receiver', verifyToken, async (req, res) => {
    const { sender, receiver } = req.params;
    try {
        const sendMessags = await Message.find({ sender, receiver });
        const receivedMessags = await Message.find({ receiver: sender, sender: receiver, isRead: true });
        const messages = []
        addTypeToObj(receivedMessags, messages, "received");
        addTypeToObj(sendMessags, messages, "send");

        messages.sort((a, b) => {
            return (new Date(a.createdAt) - new Date(b.createdAt))
        })
        res.status(200).json(messages)
    } catch (err) {
        res.status(500).json('Internal Server Error')
        console.log(err);
    }
})

messageRouter.get('/get-unread-messages/:sender/:receiver', verifyToken, async (req, res) => {
    const { sender, receiver } = req.params;
    try {
        const receivedMessags = await Message.find({ receiver: sender, sender: receiver, isRead: false });
        const messages = []
        addTypeToObj(receivedMessags, messages, "received");
        messages.sort((a, b) => {
            return (new Date(a.createdAt) - new Date(b.createdAt))
        })
        res.status(200).json(messages)
    } catch (err) {
        res.status(500).json('Internal Server Error')
        console.log(err);
    }
})

messageRouter.get('/get-unread-messages-count/:sender/:receiver', verifyToken, async (req, res) => {
    const { sender, receiver } = req.params;
    try {
        const receivedMessags = await Message.find({ receiver: sender, sender: receiver, isRead: false });
        const unreadMessagesLength = receivedMessags.length;
        res.status(200).json(unreadMessagesLength);
    } catch (err) {
        res.status(500).json('Internal Server Error')
        console.log(err);
    }
})

messageRouter.post('/send-message', verifyToken, (req, res) => {
    const { userId, friendId, message } = req.body;
    if (userId && friendId && message) {
        const message = Message({ sender: userId, reciver: friendId, message })
        message.then((msg) => {
            res.status(msg).json("message send");
        }).catch((err) => {
            console.log(err);
            return res.status(500).json("Internal Error")
        })
    } else {
        res.status(403).json("All details are nessary")
    }
})

export { messageRouter }