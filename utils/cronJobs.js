const cron = require('node-cron');
const { fetchAndConvertCSV, cronAtMarketClose } = require('../controllers/userController');
const { fetchMarketStatus, isMarketClose } = require('./checkMarketStatus');

cron.schedule('35 08 * * *', () => {
  console.log("🚀 Running task at 8:35 AM IST...");
  fetchAndConvertCSV();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

cron.schedule('31 15 * * *', () => {
  console.log("🚀 Running task at 15:31 PM IST...");
  cronAtMarketClose();
  isMarketClose();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

cron.schedule('15 09 * * *', () => {
  console.log("🚀 Running task at 09:15 PM IST...");
  fetchMarketStatus();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

cron.schedule('16 09 * * *', () => {
  console.log("🚀 Running task at 09:15 PM IST...");
  fetchMarketStatus();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// cron.schedule('30 15 * * *', () => {
//   console.log("🚀 Running task at 09:15 PM IST...");
//   fetchMarketStatus();
// }, {
//   scheduled: true,
//   timezone: "Asia/Kolkata"
// });

