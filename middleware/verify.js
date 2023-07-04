import { Token } from "../classes/Helper.js";
import { User } from "../modles/Schema.js";
import { errorMessage } from "../error/errorMeg.js";

export const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(" ")[1];
    if (token) {
        try {
            const { data, error } = Token.decodeToken(token)
            if (error) {
                res.status(403).json({ isError: true, errorMessage: errorMessage.TOKEN_EXPIRED })
                console.log(error)
            }
            else if (data) {
                const user = await User.findById(data);
                if (user) {
                    req.user = user
                    next()
                } else {
                    return res.status(403).json({ isError: true, errorMessage: errorMessage.INVALID_CREDENTIAL })
                }
            } else if (error) {
                console.log("err", err)
            }
        }
        catch (e) {
            console.error(e, "error")
            return res.status(403).json({ isError: true, errorMessage: errorMessage.INVALID_CREDENTIAL })
        }
    }
    else return res.status(403).json({ isError: true, errorMessage: 'token missing' })
}
