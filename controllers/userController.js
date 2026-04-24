const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const WalletTransaction = require("../models/walletModel");
const Trade = require("../models/tradeModel");
const LimitOrder = require("../models/limitOrderModel");
const { ApiError } = require("../utils/ApiError");
const { ApiResponse } = require("../utils/ApiResponse");
const { asyncHandler } = require("../utils/asyncHandler");
const { default: axios } = require("axios");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const crypto = require("crypto");
const moment = require("moment-timezone");
const Wishlist = require("../models/wishlistModel");
const { connectKiteWebSocket, loadOrders, reloadZerodaSockets } = require("../kiteConnect/socket");
const { pagination } = require("../utils/helper");
// const dataFilePath = path.join(__dirname, "instruments.json");
let optionData = [];
let instrumentsData = [];

try {
  if (fs.existsSync('./option.json')) {
    optionData = JSON.parse(fs.readFileSync('./option.json', "utf8"));
  }
} catch (error) {
  console.log('option.json not found, will be created on first fetch');
}

try {
  if (fs.existsSync('./instruments.json')) {
    instrumentsData = JSON.parse(fs.readFileSync('./instruments.json', "utf8"));
  }
} catch (error) {
  console.log('instruments.json not found, will be created on first fetch');
}

const {isMarketOpen, initialCheck} = require("../utils/checkMarketStatus");

const apiKey = process.env.ZERODHA_API_KEY;
const apiSecret = process.env.ZERODHA_API_SECRET;
const KITE_API_URL = process.env.KITE_API_URL;
let accessToken = '';


function binarySearchInstruments(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
      let mid = Math.floor((left + right) / 2);

      if (arr[mid].instrument_token === target) {
          return arr[mid]; // Found the target
      } else if (arr[mid].instrument_token < target) {
          left = mid + 1; // Search right half
      } else {
          right = mid - 1; // Search left half
      }
  }

  return {}; // Not found
}

const findInstrumentData = async (instrument_token) => {
  try {
    return binarySearchInstruments(instrumentsData, Number(instrument_token));
  } catch (error) {
    console.error("Error fetching or parsing CSV:", error.message);
    throw error;
  }
};

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

const fetchAndConvertCSV = async () => {
    try {
      const response = await axios.get(`${KITE_API_URL}/instruments`, {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${await getAccessToken()}`,
        },
        responseType: "stream",
      });
  
      const csvData = [];
      const writeStream = fs.createWriteStream("instruments.csv");
  
      // Pipe response to a file
      response.data.pipe(writeStream);
  
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Read and parse CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream("instruments.csv")
          .pipe(csv(["instrument_token", "exchange_token", "tradingsymbol", "name", "last_price", "expiry", "strike", "tick_size", "lot_size", "instrument_type", "segment", "exchange"]))
          .on("data", (data) => {
            if (
              data.instrument_type !== 'FUT' &&  
              data.name &&
              !(
                !isNaN(Number(data.name.charAt(0))) || 
               data.name.toLowerCase().includes("mutual") || 
                data.name.startsWith("GOI") || 
                data.name.startsWith("SDL")
              ) && 
              !(
                data.instrument_type === 'EQ' && Number(data.lot_size) > 1
              ) &&
              !(
                (data.exchange === "NFO") && 
                !["NIFTY", "BANKNIFTY"].includes(data.name)
              ) &&
              (data.exchange === "NSE" || 
               data.exchange === "BSE" || 
               data.exchange === "NFO")
            ) {
              csvData.push(data);
            }
            
          })
          .on("end", resolve)
          .on("error", reject);
      });

      csvData.forEach((item) => {
        if(item.name === "BANKNIFTY"){
          item.name = `${item.name} ${moment(item.expiry, "YYYY-MM-DD").format("MMM").toUpperCase()} ${item.strike} ${item.instrument_type}`;
        }
        if(item.name === "NIFTY"){
          item.name = `${item.name} ${moment(item.expiry, "YYYY-MM-DD").format("D MMM").toUpperCase()} ${item.strike} ${item.instrument_type}`;
        }
        item.instrument_token = Number(item.instrument_token);
        item.exchange_token = Number(item.exchange_token);
        item.last_price = Number(item.last_price);
        item.strike = Number(item.strike);
        item.tick_size = Number(item.tick_size);
        item.lot_size = Number(item.lot_size);
      });
  
      // Sort by instrument_token
      csvData.sort((a, b) => a.instrument_token - b.instrument_token);

      fs.writeFileSync("instruments.json", JSON.stringify(csvData, null, 2));
      // fs.writeFileSync("instruments.json", JSON.stringify(csvData, null, 2));
  
    } catch (error) {
      console.error("Error fetching or parsing CSV:", error.message);
      // throw error;
    }
};

async function getLTP(instrument_token) {
  try {
    
    const findData = instrumentsData.find((item) => item.instrument_token === Number(instrument_token));
    // console.log(findData, "findData");

    if(!findData){ 
      throw new ApiError(400, "Instrument token is not valid")
    }
    const response = await axios.get(`${KITE_API_URL}/quote/ltp?i=${findData.exchange}:${findData.tradingsymbol}`, {
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${apiKey}:${await getAccessToken()}`,
      },
    });

    if(response?.data?.status === 'success'){
      // console.log(response.data.data, "responseltp");
      return {ltp : response.data.data[`${findData.exchange}:${findData.tradingsymbol}`].last_price, findData};
    }else{
      throw new ApiError(400, "Instrument token is not valid")
    }

  } catch (error) {
    // console.error("Error fetching LTP:", error);
    throw new Error("Failed to fetch last trading price");
  }
}

const cronAtMarketClose = async() => {
  try {

    const openTrades = await LimitOrder.updateMany( { status: "pending" }, { status: "reject"});

    const openShares = await Trade.aggregate([
      {
          $match: {
              instrument_type: { $in: ["CE", "PE"] },
              type: 'open',
              // expiry: { $lte: new Date(moment.tz("Asia/Kolkata").format()) }
          }
      },
      {
          $group: {
              _id: {
                  userId: "$user",
                  instrument_id: "$instrument_id"
              },
              // totalQuantity: { $sum: "$quantity" },
              // totalBuyAmount: { $sum: { $multiply: ["$quantity", "$price"] } }
          }
      }
    ]);

    // console.log(openShares, "openShares");
    
    if (openShares.length === 0) {
        // console.log("✅ No shares to sell.");
        return;
    }

    openShares.forEach(async (share) => {
      const { userId, instrument_id } = share._id;

      const userTrades = await Trade.find({ user: userId, instrument_id, type: "open" });
      const totalOwned = userTrades.reduce((sum, trade) => sum + trade.quantity, 0);
       
      const { ltp, findData } = await getLTP(instrument_id);

      let totalSaleAmount = ltp * totalOwned * findData.lot_size;
  
      let remaining = totalOwned;
      for (const trade of userTrades) {
        if (remaining <= 0) break;
        if (trade.quantity <= remaining) {
          trade.type = "close";
          remaining -= trade.quantity;
        } else {
          let logic = trade?.sell_quantity || 0
          logic += remaining;
          trade.sell_quantity = logic;

          trade.quantity -= remaining;
          remaining = 0;
        }
        await trade.save();
      }
  
      const user = await User.findById(userId);
      user.walletBalance += totalSaleAmount;
      await user.save();
  
      const transaction = new WalletTransaction({
        user: userId,
        instrument_id,
        tradingsymbol: findData.tradingsymbol,
        exchange: findData.exchange,
        name: findData.name,
        type: "credit",
        amount: totalSaleAmount,
        description: `Sell ${totalOwned} lots of ${findData.name} at ${ltp}`,
      });
      await transaction.save();

    })
 
} catch (error) {
  console.log("Error at market status check",error);
  return false;
}
};


module.exports = {
    createUser: asyncHandler(async(req, res)=>{
        const { name, email, password } = req.body
        // console.log(req.body, "req.body");

        const findUser = await User.findOne({email})
        if(findUser){
            throw new ApiError(400,"Email is already exists")
        }

        const user = await User.create({ name, email, password })

        if(user){
            return res.status(201).json(
                new ApiResponse(
                    201, 
                    {},
                    "User created successfully"
                )
            )
        }else{
            throw new ApiError(400,"User did not create")
        }
    }),

    adminLogin: asyncHandler(async(req, res)=>{
      res.json({ url: `https://kite.zerodha.com/connect/login?v=3&api_key=${process.env.ZERODHA_API_KEY}` })
    }),

    login: asyncHandler(async(req, res)=>{
        const { email, password } = req.body
        // console.log(req.body, "req.body");

        if(!email || !password){
            throw new ApiError(400, "Email or password is required")
        }

        const user = await User.findOne({email})
        if(!user){
            throw new ApiError(404,"User does not exists")
        }

        // const checkPassword = await user.isPasswordCorrect(password);

        if(user.password !== password){
            throw new ApiError(401,"Invalid credentials")
        }

        user.token = await user.generateToken();

        await user.save({ validateBeforeSave: false })

        return res.status(200).json(
            new ApiResponse(
                200, 
                user.toJSON1(),
                "User logged in successfully"
            )
        )
    }),

    logout: asyncHandler(async(req, res)=>{

        const user = await User.findByIdAndUpdate(req.user._id, { token: null })

        return res.status(200).json(
            new ApiResponse(
                200, 
                {},
                "User logged out successfully"
            )
        )
    }),
    
    getSingleUser: asyncHandler(async(req, res)=>{

      const findUser = await User.findById(req.user._id);
      
      if(findUser){

          return res.status(200).json(
              new ApiResponse(
                  200, 
                  findUser,
                  ""
              )
          )
      }else{
          throw new ApiError(400,"User data is not found")
      }
    }),

    redirectUrl: asyncHandler(async(req, res)=>{

      const requestToken = req.query.request_token;
      if (!requestToken) {
        throw new ApiError(400, "Missing request_token")
      }

      const checksum = crypto
        .createHash("sha256")
        .update(apiKey + requestToken + apiSecret)
        .digest("hex");

      const response = await axios.post(
        KITE_API_URL + "/session/token",
        new URLSearchParams({
          api_key: apiKey,
          request_token: requestToken,
          checksum: checksum,
        }),
        {
          headers: {
            "X-Kite-Version": "3",
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      // console.log(response.data, "response");
  
      if(response.data.status === 'success'){
        accessToken = response.data?.data?.access_token || "";
        
        await Token.findOneAndUpdate(
          {}, 
          { token: accessToken }, 
          { new: true, upsert: true }
        );
        reloadZerodaSockets()
        initialCheck();
      }

      res.json({ status: response.data.status });
    }),

    fullMarketQuotes: asyncHandler(async(req, res)=>{

      const { symbols } = req.query;
          
      if (!symbols) {
        return res.status(400).json({ error: "Symbols are required" });
      }
  
      const instruments = symbols.split(",").map((s) => `i=${s}`).join("&");
  
      const response = await axios.get(`${KITE_API_URL}/quote?${instruments}`, {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${await getAccessToken()}`,
        },
      });
  
      res.json(response.data);

    }),

    halfMarketQuotes: asyncHandler(async(req, res)=>{

      const { symbols } = req.query;
          
      if (!symbols) {
        throw new ApiError(400, "Symbols are required")
      }
  
      const instruments = symbols.split(",").map((s) => `i=${s}`).join("&");
  
      const response = await axios.get(`${KITE_API_URL}/quote/ohlc?${instruments}`, {
        headers: {
          "X-Kite-Version": "3",
          Authorization: `token ${apiKey}:${await getAccessToken()}`,
        },
      });
  
      res.json(response.data);
    }),

    historicalData: asyncHandler(async(req, res)=>{
      try {
        
   
      const { instrumentToken, from, to, interval } = req.query;

      if (!instrumentToken || !from || !to) {
          throw new ApiError(400, "Missing required parameters")
      }

      const url = `${KITE_API_URL}/instruments/historical/${instrumentToken}/${interval || 'minute'}?from=${from}&to=${to}`;

          const response = await axios.get(url, {
              headers: {
                  'X-Kite-Version': '3',
                  'Authorization': `token ${apiKey}:${await getAccessToken()}`
              }

            });

          res.json(response.data);

        } catch (error) {
            throw new ApiError(400,error.message || "Error fetching historical data")
        }
    }),

    searchData: asyncHandler(async(req, res)=>{
      const { search, token } = req.query;

      const searchWords = search.split(" ");

      let result = instrumentsData.filter((item) =>
        search
          ? 
          // item.tradingsymbol.toLowerCase().includes(search.toLowerCase()) ||
            // item.name.toLowerCase().includes(search.toLowerCase().replace(/\s/g, ""))
          searchWords.every(word =>item.name.toLowerCase().includes(word.toLowerCase()) || item.tradingsymbol.toLowerCase().includes(word.toLowerCase())) ||
          item.name.toLowerCase().includes(search.toLowerCase()) || item.tradingsymbol.includes(search.toLowerCase())
          : false
      );

      if (token) {
        const tokenResult = instrumentsData.filter(
          (item) => item.instrument_token === Number(token)
        );
        result = [...result, ...tokenResult];
      }

      return res.status(200).json(
        new ApiResponse(
            200, 
            result,
            ""
        )
       )
    }),

    getAccessToken,

    findInstrumentData,

    fetchAndConvertCSV,

    cronAtMarketClose,

    getcsvfile: asyncHandler(async(req, res)=>{

      fetchAndConvertCSV()

      res.json({});
    }),

    addWishlist: asyncHandler(async(req, res)=>{
        const { instrument_token, wishlist_name } = req.params;
        const userId = req.user._id;

        if(!wishlist_name){
          throw new ApiError(400, "Please add wishlist name")
        }
    
        const existingItem = await Wishlist.findOne({ user: userId, instrument_token, wishlist_name });
        if (existingItem){
          throw new ApiError(400, "Stock already in wishlist")
        } 

        const findData = instrumentsData.find((item) => item.instrument_token === Number(instrument_token));
        if(!findData){ 
          throw new ApiError(400, "Instrument token is not valid")
        }

        const wishlistItem = new Wishlist({ user: userId, exchange: findData.exchange, tradingsymbol: findData.tradingsymbol, instrument_type: findData.instrument_type, wishlist_name, name: findData.name, instrument_token });
        await wishlistItem.save();

        return res.status(201).json(
          new ApiResponse(
              201, 
              {},
              "Added to wishlist"
          )
        )
    }),
    
    getWishlist: asyncHandler(async(req, res)=>{
        const userId = req.user._id;
        const wishlist_name = req.params.wishlist_name;

        if(!wishlist_name){
          throw new ApiError(400, "Please add wishlist name")
        }

        const wishlist = await Wishlist.findWithSort({ user: userId, wishlist_name }, 'createdAt', 'desc');

        return res.status(200).json(
          new ApiResponse(
              200, 
              wishlist,
              ""
          )
        )
    }),
    
    deleteWishlist: asyncHandler(async(req, res)=>{

      const wishlistItem = await Wishlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  
      if (!wishlistItem){
        throw new Error("Item not found");
      }
      
      return res.status(200).json(
        new ApiResponse(
            200, 
            {},
            "Removed from wishlist"
        )
      )
    }),

    buyShare: asyncHandler(async(req, res)=>{

      const { instrument_id, quantity, type, show_type } = req.body;
      let price = req.body.price;

      const userId = req.user._id;

      if(await isMarketOpen() === false){
        throw new ApiError(400, "Market is closed")
      }

      if(!(quantity > 0)){
        throw new ApiError(400, "Please add valid quantity")
      }

      const user = await User.findById(userId);
      // console.log(user, "user");
      
      const trade_limit = user?.trade_limit || 3;

      if (!user) throw new ApiError(400, "User not found")

      const startOfDayIST = moment().tz("Asia/Kolkata").startOf("day").toDate();
      const endOfDayIST = moment().tz("Asia/Kolkata").endOf("day").toDate();

      const todayCount = await Trade.countDocuments({
        user: req.user._id, createdAt: { $gte: startOfDayIST, $lt: endOfDayIST }, type: { $in: ["open", "close"] }
      });

      const todayCount1 = await LimitOrder.countDocuments({
        user: req.user._id, status: "pending", createdAt: { $gte: startOfDayIST, $lt: endOfDayIST }
      });

      if(todayCount + todayCount1 >= trade_limit){
        throw new ApiError(400, `You can only buy up to ${trade_limit} shares per day.`)
      }

      const {ltp, findData} = await getLTP(instrument_id);

      if(!['CE', 'PE', 'EQ'].includes(findData.instrument_type)){
        throw new ApiError(400, `You can not buy ${findData.tradingsymbol}`)
      }

      const isOptionTrade = findData.instrument_type !== 'EQ'

      if(isOptionTrade && moment.tz("Asia/Kolkata").isAfter(moment.tz(findData.expiry + " 15:15", "Asia/Kolkata"))){
        throw new ApiError(400, `This option stock is expire`);
      }

      let totalCost = ltp * quantity;
      if(isOptionTrade){
        totalCost = ltp * quantity * findData.lot_size;
      }

      if (user.walletBalance < totalCost) {
        throw new ApiError(400, "Insufficient wallet balance");
      }

    if (type === "market") {

      // let totalCost = ltp * quantity;
      // if(isOptionTrade){
      //   totalCost = ltp * quantity * findData.lot_size;
      // }

      // if (user.walletBalance < totalCost) {
      //   throw new ApiError(400, "Insufficient balance");
      // }

      const input = {
        user: userId,
        instrument_id,
        tradingsymbol: findData.tradingsymbol,
        exchange: findData.exchange,
        name: findData.name,
        quantity,
        price: ltp,
        type: "open",
        buy_type: "buy",
        instrument_type: "EQ",
        show_type: show_type,
        // order_type: "market"
      }

      if(isOptionTrade){
        input.lot_size = findData.lot_size;
        input.instrument_type = findData.instrument_type;
        input.expiry = moment.tz(findData.expiry + " 15:30", "YYYY-MM-DD HH:mm", "Asia/Kolkata").toDate();
      }

      user.walletBalance -= totalCost;
      await user.save();

      const trade = new Trade(input);
      await trade.save();

      const transaction = new WalletTransaction({
        user: userId,
        type: "debit",
        instrument_id,
        tradingsymbol: findData.tradingsymbol,
        exchange: findData.exchange,
        name: findData.name,
        amount: totalCost,
        trade_id: trade._id,
        description: isOptionTrade ? `Buy ${quantity} lots of ${findData.name} at ${ltp}` : `Buy ${quantity} shares of ${findData.name} at ${ltp}`
      });
      await transaction.save();

      return res.status(200).json(
        new ApiResponse(
            200, 
            trade,
            "Trade successful"
        )
      )

    }else{

      if(!(price > 0)){
        throw new ApiError(400, "Please add valid price")
      }     

      const input = {
        user: userId,
        instrument_id,
        tradingsymbol: findData.tradingsymbol,
        exchange: findData.exchange,
        name: findData.name,
        quantity,
        order_type: "limit",
        price,
        status: "pending",
        instrument_type: "EQ",
        buy_type: "buy",
        show_type: show_type,

      }

      if(isOptionTrade){
        input.lot_size = findData.lot_size;
        input.instrument_type = findData.instrument_type;
        input.expiry = moment.tz(findData.expiry + " 15:30", "YYYY-MM-DD HH:mm", "Asia/Kolkata").toDate();
      }

      const limitOrder = new LimitOrder(input);
      await limitOrder.save();

      loadOrders()

      return res.status(200).json(
        new ApiResponse(
            200, 
            {},
            "Order placed successfully"
        )
      )

    }

    }),

    sellShare: asyncHandler(async(req, res)=>{

      const { instrument_id, quantity, type, show_type } = req.body;

      let price = req.body.price

      const userId = req.user._id;

      if(await isMarketOpen() === false){
        throw new ApiError(400, "Market is closed")
      }
      
      if(!(quantity > 0)){
        throw new ApiError(400, "Please add valid quantity")
      }

      const {ltp, findData} = await getLTP(instrument_id);
      
      if(!['CE', 'PE', 'EQ'].includes(findData.instrument_type)){
        throw new ApiError(400, `You can not sell ${findData.tradingsymbol}`)
      }

      const isOptionTrade = findData.instrument_type !== 'EQ'

      // if(isOptionTrade && moment.tz("Asia/Kolkata").isAfter(moment.tz(findData.expiry + " 15:15", "Asia/Kolkata"))){
      //   throw new ApiError(400, `This option stock is expire`);
      // }

      const userTrades = await Trade.find({ user: userId, instrument_id, type: "open" });
      const totalOwned = userTrades.reduce((sum, trade) => sum + trade.quantity, 0);
      
      if (totalOwned < quantity) {
        throw new ApiError(400, `Insufficient shares: You only have ${totalOwned}, but you tried to sell ${quantity}.`);
      }

      if (type === "market") {

        let totalSaleAmount = 0
        if(isOptionTrade){
          totalSaleAmount = ltp * quantity * findData.lot_size;
        }else{
          totalSaleAmount = ltp * quantity;
        }
    
        let remaining = quantity;
        for (const trade of userTrades) {
          let logic = trade?.sell_quantity || 0

          if (remaining <= 0) break;
          if (trade.quantity <= remaining) {

            // logic += trade.quantity;
            // trade.sell_quantity = logic;

            trade.type = "close";
            remaining -= trade.quantity;
          } else {
            // const others = trade
            // delete others._id
            // others.type = "close";
            // const newTrade = new Trade(others);
            // await newTrade.save();

            logic += remaining;
            trade.sell_quantity = logic;

            trade.quantity -= remaining;

            remaining = 0;
          }
          await trade.save();
        }
    
        const user = await User.findById(userId);
        user.walletBalance += totalSaleAmount;
        await user.save();
    
        const transaction = new WalletTransaction({
          user: userId,
          instrument_id,
          tradingsymbol: findData.tradingsymbol,
          exchange: findData.exchange,
          name: findData.name,
          type: "credit",
          amount: totalSaleAmount,
          description: isOptionTrade ? `Sell ${quantity} lots of ${findData.name} at ${ltp}` : `Sell ${quantity} shares of ${findData.name} at ${ltp}`,
        });
        await transaction.save();

        const inputSell = {
          type: "sell",
          instrument_id,
          tradingsymbol: findData.tradingsymbol,
          name: findData.name,
          exchange: findData.exchange,
          price: ltp,
          quantity,
          user: userId,
          buy_type: "buy",
          instrument_type: "EQ",
          show_type: "market",

        }

        if(isOptionTrade){
          inputSell.lot_size = findData.lot_size;
          inputSell.instrument_type = findData.instrument_type;
          inputSell.expiry = moment.tz(findData.expiry + " 15:30", "YYYY-MM-DD HH:mm", "Asia/Kolkata").toDate();
        }

        await Trade.create(inputSell);

        return res.status(200).json(
          new ApiResponse(
              200, 
              {},
              "Sell successful"
          )
        )

      }else{

        // if(type === "market"){
        //   price = ltp
        // }

        let buy_price;
        if(isOptionTrade) {
          const avgBuyPrice = userTrades.reduce((sum, trade) => sum + (trade.price*trade.quantity*trade.lot_size), 0);
          const totalOwned1 = userTrades.reduce((sum, trade) => sum + (trade.quantity*trade.lot_size), 0);
          buy_price = avgBuyPrice/totalOwned1;
        }else{
          const avgBuyPrice = userTrades.reduce((sum, trade) => sum + (trade.price*trade.quantity), 0);
          buy_price = avgBuyPrice/totalOwned;
        }

        if(!(price > 0)){
          throw new ApiError(400, "Please add valid price")
        }     
  
        const input = {
          user: userId,
          instrument_id,
          tradingsymbol: findData.tradingsymbol,
          exchange: findData.exchange,
          name: findData.name,
          quantity,
          order_type: "stopLoss",
          price,
          status: "pending",
          instrument_type: "EQ",
          buy_type: "sell",
          buy_price: buy_price,
          show_type: show_type,
        }

        if(isOptionTrade){
          input.lot_size = findData.lot_size;
          input.instrument_type = findData.instrument_type;
          input.expiry = moment.tz(findData.expiry + " 15:30", "YYYY-MM-DD HH:mm", "Asia/Kolkata").toDate();
        }

        const limitOrder = new LimitOrder(input);
        await limitOrder.save();
  
        loadOrders()

        return res.status(200).json(
          new ApiResponse(
              200, 
              {},
              "Order placed successfully"
          )
        )

      }

    }),

    cancelOrder: asyncHandler(async(req, res)=>{

      const { id } = req.params;

      const limitOrder = await LimitOrder.findOneAndUpdate({ _id: id, user: req.user._id, status: "pending" }, { status: "cancel" })
      // console.log(limitOrder, "limitOrder");
      
      if(limitOrder){

        loadOrders();

        return res.status(200).json(
          new ApiResponse(
              200, 
              {},
              "Order is cancelled successfully"
          )
        )
      }else{
        throw new ApiError(400, "Order is not cancelled")
      }
    
    }),

    modifyOrder: asyncHandler(async(req, res)=>{

      const { id } = req.params;
      const { price, quantity } = req.body;

      const input = {};

      if(price > 0){
        input.price = price;
      }

      if(quantity > 0){
        input.quantity = quantity;
      }

      const findLimitOrder = await LimitOrder.findOne({ _id: id, user: req.user._id, status: "pending" })
      if(!findLimitOrder){
        throw new ApiError(400, "Order Id is not valid");
      }

      const user = await User.findById(req.user._id);

      const {ltp, findData} = await getLTP(findLimitOrder.instrument_id);

      const isOptionTrade = findData.instrument_type !== 'EQ'

      if(findLimitOrder.order_type === "stopLoss"){
        const userTrades = await Trade.find({ user: req.user._id, instrument_id: findLimitOrder.instrument_id, type: "open" });
        const totalOwned = userTrades.reduce((sum, trade) => sum + trade.quantity, 0);
        
        if (totalOwned < quantity) {
          throw new ApiError(400, `Insufficient shares: You only have ${totalOwned}, but you tried to sell ${quantity}.`);
        }
      }else{
        let totalCost = ltp * quantity;
        if(isOptionTrade){
          totalCost = ltp * quantity * findData.lot_size;
        }
  
        if (user.walletBalance < totalCost) {
          throw new ApiError(400, "Insufficient wallet balance");
        }
      }
      
      const limitOrder = await LimitOrder.findOneAndUpdate({ _id: id, user: req.user._id, status: "pending" }, input)
      // console.log(limitOrder, "limitOrder");
      
      if(limitOrder){

        loadOrders();

        return res.status(200).json(
          new ApiResponse(
              200, 
              {},
              "Order is modified successfully"
          )
        )
      }else{
        throw new ApiError(400, "Order is not modified")
      }
    
    }),

    getPortfolio: asyncHandler(async(req, res)=>{
      const { type } = req.query;

      const startOfDayIST = moment().tz("Asia/Kolkata").startOf("day").toDate();
      const endOfDayIST = moment().tz("Asia/Kolkata").endOf("day").toDate();

      if(type === "open"){
        const orders = await LimitOrder.findWithSort({ user: req.user._id, status: "pending" }, 'createdAt', 'desc');

        return res.status(200).json(
          new ApiResponse(
              200, 
              orders,
              ""
          )
        )

      }else if (type === "holding") {
        const userTrades = await Trade.find({ user: req.user._id, type: "open", createdAt: { $lt: startOfDayIST } });

        const portfolioMap = {};
        userTrades.forEach((trade) => {
          // console.log(trade, "trade");
  
            if (!portfolioMap[trade.instrument_id]) {
  
              portfolioMap[trade.instrument_id] = { 
                instrument_id: trade.instrument_id,
                // position: 0, 
                quantity: 0, 
                price: 0,
                total_lot: 0, 
                total_lot_calculation: 0,
                tradingsymbol: trade.tradingsymbol || "",
                name: trade.name || "",
                exchange: trade.exchange || "",
                instrument_type: trade.instrument_type || "",
                buy_type: trade.buy_type || "",
                createdAt: trade.createdAt || "",
                show_type: trade.show_type,

              };
            }

            if (trade.type === "open") {
              if(trade.instrument_type === 'EQ') {
                const current = portfolioMap[trade.instrument_id];
  
                current.price = 
                  ((current.price * current.quantity + trade.price * trade.quantity) / 
                  (current.quantity + trade.quantity)).toFixed(2);
    
                current.quantity += trade.quantity;
                current.createdAt = trade.createdAt;
                current._id = trade._id;
              }else{
                const current = portfolioMap[trade.instrument_id];
  
                current.price = 
                  ((current.price * current.total_lot_calculation + trade.price * trade.quantity * trade.lot_size) / 
                  (current.total_lot_calculation + trade.quantity * trade.lot_size)).toFixed(2);

                current.total_lot = trade.lot_size;
                current.total_lot_calculation += trade.quantity * trade.lot_size;
                current.quantity += trade.quantity;
                current.createdAt = trade.createdAt;
                current._id = trade._id;
              }
            } else {
              // portfolioMap[trade.instrument_id].position += trade.quantity;
              // portfolioMap[trade.instrument_id].quantity -= trade.quantity;
            }
          });

          const portfolio = Object.values(portfolioMap);
  
          return res.status(200).json(
            new ApiResponse(
                200, 
                portfolio,
                ""
            )
          )
      }else if (type === "position"){
        const userTrades = await Trade.find({ user: req.user._id, type: "open", createdAt: { $gte: startOfDayIST, $lt: endOfDayIST }  });

          const portfolioMap = {};
          userTrades.forEach((trade) => {
          // console.log(trade, "trade");
  
            if (!portfolioMap[trade.instrument_id]) {
  
              portfolioMap[trade.instrument_id] = { 
                instrument_id: trade.instrument_id,
                // position: 0, 
                quantity: 0, 
                price: 0,
                total_lot: 0, 
                lot_size: 0, 
                total_lot_calculation: 0,
                tradingsymbol: trade.tradingsymbol || "",
                name: trade.name || "",
                exchange: trade.exchange || "",
                instrument_type: trade.instrument_type || "",
                buy_type: trade.buy_type || "",
                createdAt: trade.createdAt || "",
                show_type: trade.show_type,


              };
            }

            if (trade.type === "open") {
              if(trade.instrument_type === 'EQ') {
                const current = portfolioMap[trade.instrument_id];
  
                current.price = 
                  ((current.price * current.quantity + trade.price * trade.quantity) / 
                  (current.quantity + trade.quantity)).toFixed(2);
    
                current.quantity += trade.quantity;
                current.createdAt = trade.createdAt;
                current._id = trade._id;
              }else{
                const current = portfolioMap[trade.instrument_id];
  
                current.price = 
                  ((current.price * current.total_lot_calculation + trade.price * trade.quantity * trade.lot_size) / 
                  (current.total_lot_calculation + trade.quantity * trade.lot_size)).toFixed(2);

                current.total_lot_calculation += trade.quantity * trade.lot_size;
                current.total_lot = trade.lot_size;
                current.quantity += trade.quantity;
                current.createdAt = trade.createdAt;
                current._id = trade._id;
              }
            } else {
              // portfolioMap[trade.instrument_id].position += trade.quantity;
              // portfolioMap[trade.instrument_id].quantity -= trade.quantity;
            }
          });

          const portfolio = Object.values(portfolioMap);
  
          return res.status(200).json(
            new ApiResponse(
                200, 
                portfolio,
                ""
            )
          )
      }else if (type === "executed"){
        const userTrades = await Trade.find({ user: req.user._id, type: {$in: ["open", "close"]}, createdAt: { $gte: startOfDayIST, $lt: endOfDayIST } });
        // console.log(userTrades);
        
        const portfolioMap = {};
        const userTrades1 = userTrades.map((trade) => {
          // console.log(trade, "trade");
          const total = trade.quantity;
          const total1 = trade.sell_quantity || 0;

          return {
            _id: trade._id,
            instrument_id: trade.instrument_id,
            // position: 0,
            quantity: total + total1, 
            status: "executed",
            price: trade.price,
            total_lot: trade.lot_size,
            total_lot_calculation: 0,
            tradingsymbol: trade.tradingsymbol || "",
            name: trade.name || "",
            exchange: trade.exchange || "",
            instrument_type: trade.instrument_type || "",
            buy_type: trade.buy_type || "",
            createdAt: trade.createdAt || "",
            show_type: trade?.show_type,

          }
  
            // if (!portfolioMap[trade.instrument_id]) {
  
            //   portfolioMap[trade.instrument_id] = { 
            //     _id: trade._id,
            //     instrument_id: trade.instrument_id,
            //     // position: 0, 
            //     quantity: , 
            //     status: "executed",
            //     price: trade.price,
            //     total_lot: trade.lot_size, 
            //     total_lot_calculation: 0,
            //     tradingsymbol: trade.tradingsymbol || "",
            //     name: trade.name || "",
            //     exchange: trade.exchange || "",
            //     instrument_type: trade.instrument_type || "",
            //     buy_type: trade.buy_type || "",
            //     createdAt: trade.createdAt || ""
            //   };

            // }
  
            // if (trade.type === "open") {

            //   if(trade.instrument_type === 'EQ') {
            //     const current = portfolioMap[trade.instrument_id];
  
            //     current.price = 
            //       ((current.price * current.quantity + trade.price * trade.quantity) / 
            //       (current.quantity + trade.quantity)).toFixed(2);
    
            //     current.quantity += trade.quantity;
            //     current.createdAt = trade.createdAt;
            //     current._id = trade._id;
            //   }else{
            //     const current = portfolioMap[trade.instrument_id];
  
            //     current.price = 
            //       ((current.price * current.total_lot_calculation + trade.price * trade.quantity * trade.lot_size) / 
            //       (current.total_lot_calculation + trade.quantity * trade.lot_size)).toFixed(2);

            //     current.total_lot = trade.lot_size;
            //     current.total_lot_calculation += trade.quantity * trade.lot_size;
            //     current.quantity += trade.quantity;
            //     current.createdAt = trade.createdAt;
            //     current._id = trade._id;
            //   }
            // } else {
            //   // portfolioMap[trade.instrument_id].position += trade.quantity;
            //   // portfolioMap[trade.instrument_id].quantity -= trade.quantity;
            // }

        });

        const openTrades = await LimitOrder.findWithSort({ user: req.user._id, status: { $in: ["cancel", "reject"] }, createdAt: { $gte: startOfDayIST, $lt: endOfDayIST } }, 'updatedAt', 'desc');
        // console.log(openTrades);

        const userTradesSell = await Trade.find({ user: req.user._id, type: "sell", createdAt: { $gte: startOfDayIST, $lt: endOfDayIST } });
        const userTradesSell1 = userTradesSell.map((v)=>{
          return {
            _id: v._id,
            instrument_id: v.instrument_id,
            quantity: v.quantity,
            status: "executed",
            price: v.price,
            total_lot: v.quantity * v.lot_size || 0,
            order_type: v.order_type,
            tradingsymbol: v.tradingsymbol || "",
            name: v.name || "",
            exchange: v.exchange || "",
            instrument_type: v.instrument_type,
            buy_type: "sell",
            order_type: v.order_type,
            createdAt: v.createdAt,
            show_type: v.show_type,
            
          }
        })

        // const portfolio = Object.values(portfolioMap);
        // console.log(portfolio, "portfolio");

        // portfolio.concat(openTrades)

        const dataArray = [...userTrades1, ...openTrades, ...userTradesSell1].sort((a, b)=>b.createdAt - a.createdAt);
        
          return res.status(200).json(
            new ApiResponse(
                200, 
                dataArray,
                ""
            )
          )
      }else {
        throw new ApiError(400, "Invalid type")
      }

        // const userTrades = await Trade.find({ user: req.user._id, type: "open" });

        // const portfolioMap = {};

        // userTrades.forEach((trade) => {
        // console.log(trade, "trade");

        //   const tradeDate = new Date(trade.createdAt);
        //   tradeDate.setHours(0, 0, 0, 0);

        //   const isTodayTrade = tradeDate.getTime() === today.getTime();
        //   if ((type === "position" && !isTodayTrade) || (type === "holding" && isTodayTrade)) {
        //     return;
        //   }

        //   if (!portfolioMap[trade.instrument_id]) {

        //     console.log(trade, "trade");  


        //     const findData = instrumentsData.find((item) => item.instrument_token === Number(trade.instrument_id));
        //     portfolioMap[trade.instrument_id] = { 
        //       instrument_id: trade.instrument_id,
        //       // position: 0, 
        //       quantity: 0, 
        //       avgPrice: 0,
        //       tradingsymbol: findData.tradingsymbol || "",
        //       name: findData.name || "",
        //       exchange: findData.exchange || ""
        //     };
        //   }

        //   if (trade.type === "open") {
        //     const current = portfolioMap[trade.instrument_id];

        //     current.avgPrice = 
        //       ((current.avgPrice * current.quantity + trade.price * trade.quantity) / 
        //       (current.quantity + trade.quantity)).toFixed(2);

        //     current.quantity += trade.quantity;
        //   } else {
    }),

    getWalletDetails: asyncHandler(async(req, res)=>{
      const pipeline = await WalletTransaction.aggregate([
        {
          $match: {
            user: req.user._id
          }
        },
        {
          $group: {
            _id: "$user",
            totalCredit: {
              $sum: {
                $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0]
              }
            },
            totalDebit: {
              $sum: {
                $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            user: "$_id",
            balance: { $subtract: ["$totalCredit", "$totalDebit"] }
          }
        }
      ])

      const walletBalance = pipeline?.[0]?.balance || 0
      const transactions = await WalletTransaction.findWithSort({ user: req.user._id }, 'createdAt', 'desc');

      return res.status(200).json(
        new ApiResponse(
          200, 
          {
            walletBalance,
            transactions,
          },
          ""
        )
      )
    }),

    getWalletDetailsForAdmin: asyncHandler(async(req, res)=>{
      const {id} = req.params;
  
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const transactions = await WalletTransaction.findWithSort({ user: id }, 'createdAt', 'desc');
  
          return res.status(200).json(
            new ApiResponse(
                200, 
                {
                  walletBalance: user.walletBalance,
                  transactions,
                },
                ""
            )
          )
  
    }),

    getIndexData: asyncHandler(async(req, res)=>{
     
       const { perPage, page } = pagination(req.query);
       const { search } = req.query; 
 
        let filteredData = instrumentsData.filter(item => 
          item.segment === 'INDICES'
        );
    
        if (search) {
          filteredData = filteredData.filter(item =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.tradingsymbol.toLowerCase().includes(search.toLowerCase())
          );
        }
     
        let paginatedData = filteredData;
        if (perPage && page) {
          const startIndex = (page - 1) * perPage;
          paginatedData = filteredData.slice(startIndex, startIndex + parseInt(perPage));
        }
        
        const totalData = filteredData.length || 0;
  
        if (paginatedData) {
            return res.status(200).json(
            new ApiResponse(
                200,
                {
                    data: paginatedData,  
                    totalData: totalData,
                    perPage,
                    page,
                    totalPages: Math.ceil(totalData / perPage) || 1,
                },
                ""
            )
            );
        } else {
            throw new ApiError(400, "Indexes data is not fetched");
        }
    }),

    getOptionData: asyncHandler(async(req, res)=>{
     
      const { symbol, expiry } = req.query;

      if (!symbol) {
        throw new ApiError(400, "Please provide symbol");
      }

      const getOptionName = optionData.find((v)=>v.tradingsymbol === symbol)?.name || "";
      
      if(!getOptionName){
        throw new ApiError(400, "Options data not found");
      }

      let filteredData = instrumentsData.filter(item =>
        item.name === getOptionName && ["CE", "PE"].includes(item.instrument_type)
      );

      // console.log(filteredData.length, "11111111111111111");
  
      let allExpiries = []
      let selectedExpiry = expiry;
      if (!expiry) {
        allExpiries = [...new Set(filteredData.map(item => item.expiry))];
        allExpiries.sort((a, b) => new Date(a) - new Date(b));
        // console.log(allExpiries, "allExpiries");

        selectedExpiry = allExpiries[0];
        // console.log(selectedExpiry, "selectedExpiry");

        if (!selectedExpiry) {
          throw new ApiError(400, "No future expiry available");
        }
      }
  
      filteredData = filteredData.filter(item =>
        item.expiry === selectedExpiry
      );
  
      let groupedData = {};
      filteredData.forEach(item => {
        if (!groupedData[item.strike]) {
          groupedData[item.strike] = {
            strike_price: item.strike,
            CE: null,
            PE: null
          };
        }
  
        if (item.instrument_type === 'CE') {
          groupedData[item.strike].CE = item;
        }
        if (item.instrument_type === 'PE') {
          groupedData[item.strike].PE = item;
        }
      });

      const result = Object.values(groupedData).sort((a, b) => a.strike_price - b.strike_price);

      return res.status(200).json(
        new ApiResponse(
            200,
            {
              data: result,  
              expiryDates : allExpiries,
              currentexpiryDate : selectedExpiry
            },
            ""
        )
        );
    }),

    checkMarketStatus: asyncHandler(async(req, res)=>{
      return res.status(200).json(
        new ApiResponse(
            200, 
            { marketStatus: await isMarketOpen() },
            ""
        )
      )
    }),


}