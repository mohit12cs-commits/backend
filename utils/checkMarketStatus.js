const moment = require("moment-timezone");
const axios = require("axios");
const { getAccessToken } = require("../utils/getAccessToken");
const KITE_API_URL = process.env.KITE_API_URL;
const apiKey = process.env.ZERODHA_API_KEY;

let marketStatus = null;

async function fetchMarketStatus() {
  try {
    // console.log("Fetching market status...");
    // const response = await axios.get("https://www.nseindia.com/api/marketStatus", {
    //   headers: {
    //     "User-Agent": "Mozilla/5.0",
    //     "Accept": "application/json",
    //     "Referer": "https://www.nseindia.com/"
    //   },
    // });

    // const marketData = response.data.marketState.find((item) => item.market === "Capital Market");
    
    // console.log(marketData.marketStatus, "marketData.marketStatus");
    
    // if (marketData) {
    //   marketStatus = marketData.marketStatus !== "Close";
    // } else {
    //   marketStatus = false;
    // }

    const response = await axios.get(`${KITE_API_URL}/quote?i=NSE:INFY`, {
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${apiKey}:${await getAccessToken()}`,
      },
    });
    
    const result = response?.data?.data?.["NSE:INFY"]?.last_trade_time;

    const lastTradeTimeUTC = moment.tz(result, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata").utc();
    const nowUTC = moment.utc();
    const diffInMinutes = nowUTC.diff(lastTradeTimeUTC, "minutes");
    
    const isRecentTrade = diffInMinutes < 5;
    marketStatus = isRecentTrade;
    lastMarketCheck = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
  } catch (error) {
    console.error("Error fetching market status:", error.message);
    marketStatus = false;
  }
}

async function isMarketOpen() {
  try {
    // const now = moment().tz("Asia/Kolkata");
    // const dayOfWeek = now.day();

    // if (dayOfWeek === 0) return false;

    // if (!openTime || !closeTime || lastMarketCheck !== now.format("YYYY-MM-DD")) {
    //   updateMarketTimes();
    // }

    // if (now.isBefore(openTime)) {
    //   return false;
    // }

    // if (lastMarketCheck !== now.format("YYYY-MM-DD")) {
    //   await fetchMarketStatus();
    // }

    // return true;
    return marketStatus;
  } catch (error) {
    console.error("Error at market status check", error);
    return false;
  }
}

async function isMarketClose() {
  try {
    marketStatus = false;
  } catch (error) {
    console.error("Error at market status check", error);
    return false;
  }
}

async function initialCheck(){
  try {
  // console.log("initially check market status");
    
  const now = moment().tz("Asia/Kolkata");
  const dayOfWeek = now.day();

  if (dayOfWeek === 0){
    marketStatus = false;
  } 

  // const openTime = moment(now.format('YYYY-MM-DD') + " " + "09:15", "YYYY-MM-DD HH:mm").tz("Asia/Kolkata");
  // const closeTime = moment(now.format('YYYY-MM-DD') + " " + "15:30", "YYYY-MM-DD HH:mm").tz("Asia/Kolkata");

  const openTime = moment.tz(`${now.format('YYYY-MM-DD')} 09:15`, "YYYY-MM-DD HH:mm", "Asia/Kolkata");
  const closeTime = moment.tz(`${now.format('YYYY-MM-DD')} 15:30`, "YYYY-MM-DD HH:mm", "Asia/Kolkata");
  if (now.isBetween(openTime, closeTime)) {
    fetchMarketStatus();
  } else {
    marketStatus = false;
  }
} catch (error) {
  console.log("Error at market status check",error);
  return false;
}
};

initialCheck();

module.exports = { isMarketOpen, fetchMarketStatus, initialCheck, isMarketClose };
