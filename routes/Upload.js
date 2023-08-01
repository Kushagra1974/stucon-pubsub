import express from "express"
import multer from "multer"

import { uploadToBLob } from "../utils/uploadToblob.js"
import { verifyToken } from "../middleware/verify.js"
import { Categories } from "../modles/Schema.js"
import { CategoryImages } from "../modles/Schema.js"
import { GlobalNotification } from "../modles/Schema.js"

export const uploadRouter = express.Router()

const storage = multer.memoryStorage()
const upload = multer({ storage })



uploadRouter.post("/:userId", verifyToken, upload.array("file"), async (req, res) => {
    const category = req.body.filename
    const userId = req.params.userId
    if (category.length <= 0) res.status(401).json({ isError: true, errorMessage: "fileName required" })
    try {
        const urlPromises = [];
        for (let i = 0; i < req.files.length; i++) {
            let file = req.files[i];
            const url = await uploadToBLob(file)
            urlPromises.push(url)
            await CategoryImages.updateOne({ category }, { $push: { images: url } }, { upsert: true })
        }
        const newGLobalNoti = new GlobalNotification({ user: userId, type: "FILE_UPLOAD" })
        await newGLobalNoti.save()
        res.status(201).json({ message: "file uploded sucessfully ", urls: urlPromises })
        // console.log(urlPromises)
    } catch (err) {
        console.log(err)
        res.status(500).json("Server Error")
    }
})

uploadRouter.get("/categories/images/:category", async (req, res) => {
    try {
        const category = req.params.category
        const data = await CategoryImages.findOne({ category });
        if (data)
            res.status(200).json(data);
    }
    catch (err) {
        console.log(err.message, err.stack);
        res.status(500).json("Internal Server Error")
    }
})

uploadRouter.get("/categories", async (req, res) => {
    try {
        const categories = await Categories.find()
        res.status(200).json({ categories })
    }
    catch (err) {
        console.log(err)
        res.status(500).json("Server Error")
    }
})

