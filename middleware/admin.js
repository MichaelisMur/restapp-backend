const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    let {role} = req.user;

    if (role != "admin") {
        return res.status(401).send("Not enough rights");
    }

    return next();
};

module.exports = verifyToken;
