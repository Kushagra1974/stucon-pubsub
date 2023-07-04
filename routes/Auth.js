import express from 'express'
import { User } from '../modles/Schema.js'
import { Hash, Token } from '../classes/Helper.js';
import { errorMessage } from '../error/errorMeg.js';

const authRouter = express.Router();

authRouter.post('/signup', async (req, res) => {
    const { userName, educationInstitute, employer, password, email } = req.body;
    if (userName && password && educationInstitute && email && employer) {
        try {
            const prevSavedUser = await User.findOne({ email })
            if (prevSavedUser) res.status(403).json("user alredy exist")
            else {
                const user = new User({ userName, password, email, educationInstitute, employer });
                const savedUser = await user.save();
                const { token, error } = Token.genrateToken(savedUser._id);
                delete user.password;
                if (token)
                    res.status(201).json({ token, user })
                else {
                    res.status(500).json(errorMessage, errorMessage.SERVER_ERROR)
                }
            }
        } catch (err) {
            console.log(err);
            res.status(500).json({ errorMessage: errorMessage.SERVER_ERROR })
        }
    } else res.status(401).json({ errorMessage: errorMessage.NO_CREDENTIAL })
})

authRouter.post('/login', async (req, res) => {
    const { password, email } = req.body
    if (password && email) {
        try {
            const savedUser = await User.findOne({ email })
            const hashedPassword = savedUser?.password;
            const match = await Hash.compareHashPassword(password, hashedPassword);
            if (!savedUser) res.status(401).json("User Not Found");
            else if (!match) res.status(401).json("Email or Password is incorrect ")
            else if (match && savedUser) {
                const { token, error } = Token.genrateToken(savedUser._id)
                delete savedUser.password
                if (token) {
                    res.status(201).json({ token, user: savedUser })
                }
                else {
                    res.status(401).json({ isError: true, errorMessage: errorMessage.TOKEN_EXPIRED })
                }
            }
        } catch (err) {
            console.log(err)
            res.status(500).json({ isError: true, errorMessage: errorMessage.SERVER_ERROR })
        }
    }
    else {
        res.status(401).json({ isError: true, errorMessage: errorMessage.NO_CREDENTIAL })
        console.log("NO CREDENTIAL")
    }
})

export { authRouter }
