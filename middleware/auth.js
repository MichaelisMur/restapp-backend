const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    let access_token = req.body.access_token;
    let refresh_token = req.body.refresh_token;
  
    if (!access_token) {
      return res.status(403).send("An access token is required for authentication");
    }
  
    try {
      const accessDecoded = jwt.verify(access_token, "process.env.TOKEN_KEY");
      req.user = {access_token, refresh_token, id: accessDecoded.id,
        role: accessDecoded.role, email: accessDecoded.email,
        restaurant_id: accessDecoded.restaurant_id};
    } catch (err) {
        try {
          const refreshDecoded = jwt.verify(refresh_token, "process.env.TOKEN_KEY");
          console.log("refreshing both")
          
          access_token = jwt.sign({ id: refreshDecoded.id, email: refreshDecoded.email,
            role: refreshDecoded.role, restaurant_id: refreshDecoded.restaurant_id},
            "process.env.TOKEN_KEY", {expiresIn: "2h"}
          );
          refresh_token = jwt.sign({ id: refreshDecoded.id,
            email: refreshDecoded.email, restaurant_id: refreshDecoded.restaurant_id}, 
            "process.env.TOKEN_KEY", { expiresIn: '100d' }
          );
          req.user = { access_token, refresh_token, id: refreshDecoded.id,
            role: refreshDecoded.role, email: refreshDecoded.email,
            restaurant_id: refreshDecoded.restaurant_id };
        }
        catch (err) {
          return res.status(401).send("Invalid Token");
        }
    }
    console.log(req.user)
    return next();
};

module.exports = verifyToken;
