import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'


class Token {
    /**
     * 
     * @param {*} id 
     * @returns {token :String, error : String}
     */
    static genrateToken = (id) => {
        try {
            const token = jwt.sign(
                { userId: id },
                process.env.SECRET_HASH_KEY,
                {
                    expiresIn: "2h",
                }
            );
            return { token, error: null };
        } catch (err) {
            console.error(err)
            return { token: null, error: err }
        }
    }
    /**
     * 
     * @param {*} token 
     * @returns {data :String , error : String}
     */
    static decodeToken = (token) => {
        try {
            const decodedData = jwt.verify(token, process.env.SECRET_HASH_KEY)
            return { data: decodedData.userId, error: null };
        } catch (err) {
            console.error(err);
            return { data: null, error: err.message };
        }
    }
}


class Hash {
    /**
     * 
     * @param {*} password 
     * @returns {String} hashPassword
     */
    static generateHashPassword = async (password) => {
        try {
            const salt = await bcrypt.genSalt(Number(process.env.SALT_ROUND))
            const hashPassword = await bcrypt.hash(password, salt);
            return hashPassword;
        } catch (err) { console.error(err) }
    }
    /**
     * 
     * @param {*} password 
     * @param {*} hashedPassword 
     * @returns {Boolean} match
     */
    static compareHashPassword = async (password, hashedPassword) => {
        try {
            const match = await bcrypt.compare(password, hashedPassword);
            return match
        }
        catch (err) { console.error(err) }
    }
}


export { Token, Hash }