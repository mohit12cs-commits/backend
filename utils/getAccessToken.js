const Token = require("../models/tokenModel");

let accessToken = '';

const getAccessToken = async () => {
  try {

    let token = accessToken;

    if(!token){
        const data = await Token.findOne({});
        if(!data){
          return ""
        }
        return data.token;
    }
    
    return token
  } catch (error) {
    console.error("Error fetching or parsing CSV:", error.message);
    return ""
  }
};

module.exports = { getAccessToken };
