const WebSocket = require("ws");
const Token = require("../models/tokenModel");
const User = require("../models/userModel");
const LimitOrder = require("../models/limitOrderModel");
const Trade = require("../models/tradeModel");
const WalletTransaction = require("../models/walletModel");
const moment = require("moment-timezone");
const { isMarketOpen } = require("../utils/checkMarketStatus");

const apiKey = process.env.ZERODHA_API_KEY;
let pendingOrders = {}; 
const accessToken = '';

let wsKiteConnect;
let connectKiteWebSocket;
let loadPendingOrders; 

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

function handleJSONMessage(message, clientServer) {
    try {
        switch (message.type) {
    
            case 'error':
                console.error('Error:', message.data);
                break;
            case 'message':
                console.log('Message:', message.data);
                break;
            default:
                console.log('Unknown message type:', message);
        }
    } catch (error) {
        console.error('Error handling JSON message:', error);
    }
}

function handleBinaryMessage(buffer, clientServer) {
    try {
        let offset = 0;
        
        if (buffer.length < 2) {
            // console.error("Buffer too small to contain packet count");
            return;
        }

        const packetCount = buffer.readInt16BE(offset);
        offset += 2;

        // console.log(`Received ${packetCount} packets`);
        let packetArr = [];

        for (let i = 0; i < packetCount; i++) {
            if (offset + 2 > buffer.length) {
                // console.error("Unexpected end of buffer while reading packet length");
                return;
            }

            const packetLength = buffer.readInt16BE(offset);
            offset += 2;

            if (offset + packetLength > buffer.length) {
                // console.error(`Packet length (${packetLength}) exceeds remaining buffer size (${buffer.length - offset})`);
                return;
            }

            const packet = buffer.slice(offset, offset + packetLength);
            offset += packetLength;

            const parsedData = parseQuotePacket(packet);
            if(parsedData){
                packetArr.push(parsedData);
            }
        }

        return packetArr;

        // orderExuctionCheck(packetArr);

        // broadcastData(packetArr, clientServer);
    } catch (error) {
        console.error('Error handling binary message:', error);
    }
}

function parseQuotePacket(buffer) {
    try {
        let offset = 0;
        let data = {};


        if (buffer.length >= 28 && buffer.length <= 32) { // Index packet
            const fields = [
                'instrumentToken', 'lastTradedPrice', 'highPrice', 'lowPrice', 'openPrice', 'closePrice', 'priceChange', 'exchangeTimestamp'
            ];

            for (let i = 0; i < fields.length; i++) {
                if (buffer.length >= offset + 4) {
                    data[fields[i]] = buffer.readInt32BE(offset) / (i > 0 && i < 6 ? 100 : 1);
                    offset += 4;
                }
            }
        } else { // Tradeable instrument packet
            const fields = [
                'instrumentToken', 'lastTradedPrice', 'lastTradedQuantity', 'averageTradedPrice', 'volumeTraded',
                'totalBuyQuantity', 'totalSellQuantity', 'openPrice', 'highPrice', 'lowPrice', 'closePrice',
                'lastTradedTimestamp', 'openInterest', 'openInterestDayHigh', 'openInterestDayLow', 'exchangeTimestamp'
            ];

            for (let i = 0; i < fields.length; i++) {
                if (buffer.length >= offset + 4) {
                    data[fields[i]] = buffer.readInt32BE(offset) / (i > 0 && i < 11 ? 100 : 1);
                    offset += 4;
                }
            }

            // if (buffer.length >= offset + 120) {
            //     data.marketDepth = buffer.slice(offset, offset + 120);
            // }
        }

        // console.log("Parsed Quote Data:", data);
        return data;
    } catch (error) {
        console.error('Error parsing quote packet:', error);
        return {};
    }
}

function broadcastData(data, clientServer) {
    // if (!data) return;
    const jsonData = JSON.stringify(data || {});
    clientServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
        }
    });
}

async function executeOrder(order, ltp) {
    try {
      const user = await User.findById(order.user);
      const isOptionTrade = order.instrument_type !== 'EQ';

      if (order.order_type === "limit") {

        let totalCost = 0
        if(isOptionTrade){
          totalCost = ltp * order.quantity * order.lot_size;
        }else{
          totalCost = ltp * order.quantity;
        }

        if (user.walletBalance >= totalCost) {

          const input = {
            tradingsymbol: order.tradingsymbol,
            exchange: order.exchange,
            buy_type: "buy",
            instrument_type: "EQ",
            user: order.user,
            instrument_id: order.instrument_id,
            name: order.name,
            quantity: order.quantity,
            price: ltp,
            type: "open",
            order_type: "limit",
            show_type: order?.show_type || "limit",


          }

          if(isOptionTrade){
            input.lot_size = order.lot_size;
            input.instrument_type = order.instrument_type;
            input.expiry = order.expiry;
          }

            user.walletBalance -= totalCost;
            await user.save();
      
            const trade = new Trade(input);
            await trade.save();

            const transaction = new WalletTransaction({
              user: order.user,
              type: "debit",
              instrument_id: order.instrument_id,
              tradingsymbol: order?.tradingsymbol,
              exchange: order?.exchange,
              name: order?.name,
              amount: totalCost,
              trade_id: trade._id,
              description: isOptionTrade ? `Buy ${order.quantity} lots of ${order.name} at ${ltp}` : `Buy ${order.quantity} shares of ${order.name} at ${ltp}`
            });
            await transaction.save();
      
            await LimitOrder.findByIdAndUpdate(order._id, { status: "executed" });
      
            // console.log(`✅ Executed limit order for ${order.quantity} shares of ${order.instrument_id} at ${order.price}`);
        } else {
          await LimitOrder.findByIdAndUpdate(order._id, { status: "reject" });
          // console.log(`❌ User ${order.user} has insufficient balance for order on ${order.instrument_id}`);
        }

      } else if (order.order_type === "stopLoss") {
        const userTrades = await Trade.find({ user: order.user, instrument_id: order.instrument_id, type: "open" });
  
        const totalOwned = userTrades.reduce((sum, trade) => sum + trade.quantity, 0);
    
        if (totalOwned < order.quantity) {
            // console.log(`Insufficient shares to sell`);
            await LimitOrder.findByIdAndUpdate(order._id, { status: "reject" });
            return;
        }

        let totalSaleAmount = 0
        if(isOptionTrade){
          totalSaleAmount = order.price * order.quantity * order.lot_size;
        }else{
          totalSaleAmount = order.price * order.quantity;
        }

        let remaining = order.quantity;
        for (const trade of userTrades) {
          let logic = trade?.sell_quantity || 0


          if (remaining <= 0) break;
          if (trade.quantity <= remaining) {

            // logic += trade.quantity;
            // trade.sell_quantity = logic;

            trade.type = "close";
            remaining -= trade.quantity;
          } else {

            logic += remaining;
            trade.sell_quantity = logic;

            trade.quantity -= remaining;
            remaining = 0;
          }
          await trade.save();
        }
  
        // const totalSaleAmount = ltp * order.quantity;
        user.walletBalance += totalSaleAmount;
        await user.save();

        const transaction = new WalletTransaction({
          user: order.user,
          instrument_id: order.instrument_id,
          tradingsymbol: order?.tradingsymbol,
          exchange: order?.exchange,
          name: order?.name,
          type: "credit",
          amount: totalSaleAmount,
          description: isOptionTrade ? `Sell ${order.quantity} lots of ${order.name} at ${order.price}` : `Sell ${order.quantity} shares of ${order.name} at ${order.price}`,
        });
        await transaction.save();
    
        await LimitOrder.findByIdAndUpdate(order._id, { status: "executed" });

        const inputSell = {
          type: "sell",
          instrument_id: order.instrument_id,
          tradingsymbol: order.tradingsymbol,
          name: order.name,
          exchange: order.exchange,
          price: order.price,
          quantity: order.quantity,
          user: order.user,
          buy_type: "sell",
          instrument_type: "EQ",
          order_type: "limit",
          show_type: order?.show_type,

        } 

          if(isOptionTrade){
            inputSell.lot_size = order.lot_size;
            inputSell.instrument_type = order.instrument_type;

            const expiryDate = moment(order.expiry).tz("Asia/Kolkata").format("YYYY-MM-DD");
            inputSell.expiry = moment.tz(`${expiryDate} 15:30`, "YYYY-MM-DD HH:mm", "Asia/Kolkata").toDate();
          }
  
          const sellTrade = await Trade.create(inputSell);
          
      }

    } catch (error) {
      console.error("Error executing order:", error);
    }
}

async function setupWebSocket(server) {

    const clientServer = new WebSocket.Server({ server });
  
    let subscribedTokens = new Set();
    let userSubscriptions = new Map();
    let tokenSubscribers = new Map(); 

    connectKiteWebSocket = async () => {

    var kiteWsUrl = `wss://ws.kite.trade?api_key=${apiKey}&access_token=${await getAccessToken()}`;
    // console.log(kiteWsUrl, "kiteWsUrl");
    
      wsKiteConnect = new WebSocket(kiteWsUrl);

      wsKiteConnect.on('open', onKiteWebSocketOpen);

      wsKiteConnect.on('message', (data) => {

        try {
            // console.log('Received data from Kite:', data.toString());

            if (typeof data === 'string') {
                handleJSONMessage(JSON.parse(data), clientServer);
            } else if (Buffer.isBuffer(data) && data.length >= 2) {
                handleKiteMessage(data);
                // handleBinaryMessage(data, clientServer);
            } else {
                // console.error('Invalid or incomplete data received, skipping processing');
            }
        } catch (error) {
            console.error('Error processing Kite WebSocket message:', error);
        }
      });
  
      wsKiteConnect.on('error', (error) => console.error('Kite WebSocket error:', error));
      wsKiteConnect.on('close', () => console.log('Kite WebSocket connection closed'));
    }
  
    function onKiteWebSocketOpen() {
        // console.log('WebSocket connected to Kite API');

        subscribedTokens.clear();
        userSubscriptions.clear();
        tokenSubscribers.clear();
        loadPendingOrders();

        // subscribeToInstruments();
    
        // Subscribe to INFY (408065) and TATAMOTORS (884737)
        // const message = {
        //     a: "subscribe",
        //     v: [408065, 884737]
        // };
    
        // wsKiteConnect.send(JSON.stringify(message));
        // console.log('Subscription request sent to Kite API:', message);
    }

    function subscribeToInstruments() {
        
        if (!wsKiteConnect || wsKiteConnect.readyState !== WebSocket.OPEN) return;

        const tokenArray = Array.from(subscribedTokens);

        if (tokenArray.length > 0) {
        const message = { a: "subscribe", v: tokenArray };
        wsKiteConnect.send(JSON.stringify(message));
        // console.log("Subscription request sent to Kite API:", message);
        }
    }

    function unsubscribeFromInstruments(tokens) {
        if (!wsKiteConnect || wsKiteConnect.readyState !== WebSocket.OPEN || tokens.length === 0) return;

        const message = { a: "unsubscribe", v: tokens };
        wsKiteConnect.send(JSON.stringify(message));
        // console.log("Unsubscription request sent to Kite API:", message);
    }

    loadPendingOrders = async () => { 
        try {
          const orders = await LimitOrder.find({ status: "pending" });
      
          pendingOrders = orders.reduce((acc, order) => {
            if (!acc[order.instrument_id]) acc[order.instrument_id] = [];
            acc[order.instrument_id].push(order);
            return acc;
          }, {});
      
          Object.keys(pendingOrders).forEach(token =>{
            if(!subscribedTokens.has(parseInt(token))){
                subscribedTokens.add(parseInt(token))
            }
          });
    
    
          subscribeToInstruments();
    
          // console.log("✅ Loaded pending limit orders into memory.");
        } catch (error) {
          console.error("Error loading pending orders:", error);
        }
    }
    
    async function orderExuctionCheck(parsedData) {
        try {
            // const parsedData = JSON.parse(data);
            // if (!parsedData || !parsedData.data) return;
        
            for (let instrumentData of parsedData) {
              const instrumentId = instrumentData.instrumentToken;
              const ltp = instrumentData.lastTradedPrice;
        
              if (!pendingOrders[instrumentId]) continue;
        
            //   let fulfilledOrders = [];
        
              pendingOrders[instrumentId] = pendingOrders[instrumentId].filter(order => {
                // if (order.price <= ltp) {
                //   executeOrder(order, ltp);
                //   fulfilledOrders.push(order._id);
                //   return false;
                // }
    
                // if (
                //     (order.order_type === "limit" && ltp <= order.price) ||  
                //     (order.order_type === "stopLoss" && ltp >= order.price)
                //   ) {
                //     executeOrder(order, ltp);
                //     // fulfilledOrders.push(order._id);
                //     return false;
                // }

                if (order.order_type === "limit" && ltp <= order.price) {
                  executeOrder(order, ltp);
                  // fulfilledOrders.push(order._id);
                  return false;
                }else if (order.order_type === "stopLoss"){
                  
                  if (order.buy_price >= order.price) {
                    if (ltp <= order.price) {
                      executeOrder(order, ltp);
                      return false;
                    }
                  } else {
                      if (ltp >= order.price) {
                        executeOrder(order, ltp);
                        return false;
                      }
                  }
                }
              
    
                return true;
              });
        
              // Remove fully processed instruments
              if (pendingOrders[instrumentId].length === 0) {
                delete pendingOrders[instrumentId];
    
                if (!tokenSubscribers.has(instrumentId) || tokenSubscribers.get(instrumentId).size === 0) {
                    unsubscribeFromInstruments([instrumentId]);
                    subscribedTokens.delete(instrumentId);
                }
              }
            }
        } catch (error) {
          console.error("Error loading pending orders:", error);
        }
    }

    async function handleKiteMessage(data) {

        const decodedData = handleBinaryMessage(data); // Assume this converts binary to JSON
        // console.log(decodedData, "decodedData");
        
        if (!Array.isArray(decodedData)) return;

        // const marketStatus = true;
        const marketStatus = await isMarketOpen();

        if(marketStatus){
          orderExuctionCheck(decodedData);
        }
    
        const userUpdates = new Map();
    
        decodedData.forEach((quote) => {
          const token = quote.instrumentToken;

          if (tokenSubscribers.has(token)) {
            const subscribers = tokenSubscribers.get(token);
            // console.log("subscribers", subscribers);
    
            subscribers.forEach((wsClient) => {
              if (wsClient.readyState === WebSocket.OPEN) {
                if (!userUpdates.has(wsClient)) {
                  userUpdates.set(wsClient, []);
                }
                userUpdates.get(wsClient).push(quote);
              }
            });
          }
        });
        // Send batched data to each user
        userUpdates.forEach((dataArray, wsClient) => {
          wsClient.send(JSON.stringify(dataArray));
        });
    }
    
    clientServer.on('connection', (wsClient) => {
        // console.log('New client connected');
    
        wsClient.on("message", (message) => {
            try {
              const parsedMessage = JSON.parse(message);

              if(parsedMessage.a === 'subscribe'){

                if (!parsedMessage.v || !Array.isArray(parsedMessage.v)) {
                  wsClient.send(JSON.stringify({ error: "Invalid request format" }));
                  return;
                }
        
                const userId = wsClient._socket.remoteAddress;

                if (!userSubscriptions.has(userId)) {
                  userSubscriptions.set(userId, new Set());
                }
        
                const requestedTokens = new Set(parsedMessage.v);
              //   const newTokens = [...requestedTokens].filter((token) => !subscribedTokens.has(token));
        
                requestedTokens.forEach((token) => {
                  subscribedTokens.add(token);
                  userSubscriptions.get(userId).add(token);
        
                  if (!tokenSubscribers.has(token)) {
                    tokenSubscribers.set(token, new Set());
                  }
                  tokenSubscribers.get(token).add(wsClient);
                });
        
              //   if (newTokens.length > 0) {
                  subscribeToInstruments();
              //   }
        
              //   wsClient.send(JSON.stringify({ success: "Subscribed to requested tokens" }));

              }else if (parsedMessage.a === 'unsubscribe'){
                if (!parsedMessage.v || !Array.isArray(parsedMessage.v)) {
                  wsClient.send(JSON.stringify({ error: "Invalid request format" }));
                  return;
                }

                const userId = wsClient._socket.remoteAddress;
                if (userSubscriptions.has(userId)) {
                  const userTokens = parsedMessage.v;
          
                  const data = userTokens.map((token) => {
                    if (tokenSubscribers.has(token)) {
                      tokenSubscribers.get(token).delete(wsClient);
                      if (tokenSubscribers.get(token).size === 0) {
                        tokenSubscribers.delete(token);
                        subscribedTokens.delete(token);
                        return token
                      }
                    }
                  });
          
                  unsubscribeFromInstruments([...data]);
                }
              }else{
                wsClient.send(JSON.stringify({ error: "Invalid request format" }));
              }

            } catch (error) {
              console.error("Invalid message format:", error);
              wsClient.send(JSON.stringify({ error: "Invalid JSON format" }));
            }
          });

        wsClient.on("close", () => {
            // console.log("Client disconnected");
      
            const userId = wsClient._socket.remoteAddress;
            if (userSubscriptions.has(userId)) {
              const userTokens = userSubscriptions.get(userId);
      
              userTokens.forEach((token) => {
                if (tokenSubscribers.has(token)) {
                  tokenSubscribers.get(token).delete(wsClient);
                  if (tokenSubscribers.get(token).size === 0) {
                    tokenSubscribers.delete(token);
                    subscribedTokens.delete(token);
                  }
                }
              });
      
              unsubscribeFromInstruments([...userTokens]);
              userSubscriptions.delete(userId);
            }
        });

    });
  
  connectKiteWebSocket();

}

function loadOrders(){
    loadPendingOrders();
}

function reloadZerodaSockets(){
  connectKiteWebSocket();
}

module.exports = {setupWebSocket, reloadZerodaSockets, loadOrders, connectKiteWebSocket};
