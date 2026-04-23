const { KiteTicker } = require('kiteconnect');

const accessToken = process.env.ACCESS_TOKEN;
const apiKey = process.env.ZERODHA_API_KEY;

const ticker = new KiteTicker({
  api_key: apiKey,
  access_token: process.env.ACCESS_TOKEN,
});

ticker.connect();
ticker.on("ticks", onTicks);
ticker.on("connect", subscribe);
ticker.on("disconnect", onDisconnect);
ticker.on("error", onError);
ticker.on("close", onClose);
ticker.on("order_update", onTrade);

function onTicks(ticks){
  console.log("Ticks", ticks);
}

function subscribe(){
  const tokens = [738561, 256265];
  ticker.subscribe(tokens);
  ticker.setMode(ticker.modeFull, tokens);
}

function onDisconnect(error){
  console.log("Closed connection on disconnect", error);
}

function onError(error){
  console.log("Closed connection on error", error);
}

function onClose(reason){
  console.log("Closed connection on close", reason);
}

function onTrade(order){
  console.log("Order update", order);
}



