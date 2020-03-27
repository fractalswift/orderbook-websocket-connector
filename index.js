const WebSocket = require('ws');
const fs = require('fs');

const obPath = '../ob_data_15.txt';
const tradesPath = '../trade_data_15.txt';
const obLogPath = '../ob_log.txt';
const tradesLogPath = '../trades_log.txt';
const simplePath = '../simple_data_15.txt';

// Open the websockets

const wsOrderBook = new WebSocket('wss://ftx.com/ws/');

const wsTrades = new WebSocket('wss://ftx.com/ws/');

const orderBookRequest =
  '{"op": "subscribe", "channel": "orderbook", "market": "BTC-PERP"}';

const tradesRequest =
  '{"op": "subscribe", "channel": "trades", "market": "BTC-PERP"}';

let partialBids = [];
let partialAsks = [];

// counters for logging
let trades = 0;
let obUpdates = 0;

// for debugging
let tradeMsgsRecieved = 0;
let obUpdRecieved = 0;
let tradeMisc = 0;
let obMisc = 0;

// function to set partialBids and partialAsks value:

const setPartial = row => {
  //populate them as an array first
  partialBids = row.data.bids;
  partialAsks = row.data.asks;

  // initialize the objects
  pBids = {};
  pAsks = {};

  // Now make it key/value instead of list... easier to use later hopefuly
  partialBids.forEach(bid => (pBids[bid[0]] = bid[1]));
  partialAsks.forEach(ask => (pAsks[ask[0]] = ask[1]));
};

// send a request to open the orderbook channel

wsOrderBook.on('open', function open() {
  wsOrderBook.send(orderBookRequest);
});

// send the subscription request to open the trades channel
wsTrades.on('open', function open() {
  wsTrades.send(tradesRequest);
});

// deal with the incoming data

wsTrades.on('message', function incoming(data) {
  // count the message as received
  tradeMsgsRecieved++;

  row = JSON.parse(data);

  if (row.type == 'update') {
    let rowToWrite = JSON.stringify({
      time: row.data[0].time,
      liqudiation: row.data[0].liqudiation,
      size: row.data[0].size,
      side: row.data[0].side,
      price: row.data[0].price
    });

    fs.appendFileSync(tradesPath, rowToWrite + ',');

    // increment trades count for logging
    trades++;
  } else if (row.type !== 'update') {
    // if might be an error - store it in the log file
    let rowToWrite = JSON.stringify({ date: Date(), row: row });

    fs.appendFileSync(tradesLogPath, rowToWrite + ',\n');

    // Log it to the console
    console.log('Trade message below:');
    Object.entries(row).forEach(msg => {
      console.log(`${msg[0]} : ${msg[1]}`);
    });
    tradeMisc++;
  }
});

wsOrderBook.on('message', function incoming(data) {
  // Log message as received
  obUpdRecieved++;
  // if it is a partial row then set the pB and pA variables:

  row = JSON.parse(data);

  if (row.type == 'partial') {
    setPartial(row);
    console.log('partial order book has been set!');
    obMisc++;
  }

  // if it is an udpate row, update the orderbook object and write the row
  else if (row.type == 'update') {
    updateOrderbook(row);

    // if it is not an update row, log the message in case its an error
  } else if (row.type !== 'update') {
    obMisc++;

    // it might be an error - store it in the log file
    let rowToWrite = JSON.stringify({ date: Date(), row: row });

    fs.appendFileSync(obLogPath, rowToWrite + ',\n');

    // Log it to the console
    console.log('OB message below:');

    Object.entries(row).forEach(msg => {
      console.log(`${msg[0]} : ${msg[1]}`);
    });
  }
});

// Function to update the orderbook objects (partial) with new data (update)

const updateOrderbook = row => {
  let bids = row.data.bids;
  let asks = row.data.asks;

  uBids = {};
  uAsks = {};

  // take the date from the list and make it into kv object instead
  // also don't add keys that are less than 0

  // I am here - about to make it so kv only entered if v > 0
  // (will have to use Number())

  bids.forEach(bid => {
    if (Number(bid[1]) > 0) {
      uBids[Number(bid[0])] = bid[1];
    }
  });

  asks.forEach(ask => {
    if (Number(ask[1]) > 0) {
      uAsks[Number(ask[0])] = ask[1];
    }
  });

  let currentBids = { ...pBids, ...uBids };
  let currentAsks = { ...pAsks, ...uAsks };

  // get the best bid and best ask

  let bidKeysAsNums = Object.keys(currentBids).map(bidKey =>
    parseFloat(bidKey)
  );

  let askKeysAsNums = Object.keys(currentAsks).map(askKey =>
    parseFloat(askKey)
  );

  let bestBid = Math.max(...bidKeysAsNums);
  let bestAsk = Math.min(...askKeysAsNums);

  // Get the features that require the datas an array

  // convert the bids obj to an array so we can iterate it with reduce

  const bidsAsArray = Object.entries(currentBids);
  const asksAsArray = Object.entries(currentAsks);

  // reduce function to get total value of all btc bids

  const getTotalValue = (total, arr) => total + arr[0] * arr[1];

  // reduce function to get amount of btc for sale

  const getTotalBtc = (total, arr) => total + arr[1];

  // apply to the reduce functions

  let bidsTotalValue = bidsAsArray.reduce(getTotalValue, 0);

  let bidsTotalBtc = bidsAsArray.reduce(getTotalBtc, 0);

  let asksTotalValue = asksAsArray.reduce(getTotalValue, 0);

  let asksTotalBtc = asksAsArray.reduce(getTotalBtc, 0);

  // get the average price of each btc if they are all filled

  let avgIfBidsFilled = bidsTotalValue / bidsTotalBtc;
  let avgIfAsksFilled = asksTotalValue / asksTotalBtc;

  // now convert it into the data i want to write

  let rowToWrite = JSON.stringify({
    time: row.data.time,
    bids: currentBids,
    asks: currentAsks,
    bestBid: bestBid,
    bestAsk: bestAsk,
    bidsTotalBtc: bidsTotalBtc,
    bidsTotalValue: bidsTotalValue,
    avgIfBidsFilled: avgIfBidsFilled,
    asksTotalBtc: asksTotalBtc,
    asksTotalValue: asksTotalValue,
    avgIfAsksFilled: avgIfAsksFilled,
    checksum: row.data.checksum
  });

  // a simpler row without the whole OB

  let quickRow = JSON.stringify({
    time: row.data.time,
    bestBid: bestBid,
    bestAsk: bestAsk,
    bidsTotalBtc: bidsTotalBtc,
    bidsTotalValue: bidsTotalValue,
    avgIfBidsFilled: avgIfBidsFilled,
    asksTotalBtc: asksTotalBtc,
    asksTotalValue: asksTotalValue,
    avgIfAsksFilled: avgIfAsksFilled
  });

  fs.appendFileSync(obPath, rowToWrite + ',');
  fs.appendFileSync(simplePath, quickRow + ',');

  // increment obUpdate for logging:
  obUpdates++;
};

const pingAndCount = () => {
  wsTrades.send(' {"op": "ping"}');
  wsOrderBook.send(' {"op": "ping"}');

  console.log(Date());
  console.log(`Trade msgs recieved: ${tradeMsgsRecieved}`);
  console.log(`Trades parsed: ${trades}`);
  console.log(`Trade info msgs: ${tradeMisc}`);
  console.log(`Orderbook Msgs Received: ${obUpdRecieved}`);
  console.log(`Orderbook Updates parsed: ${obUpdates}`);
  console.log(`Orderbook info msgs: ${obMisc}`);
};

setInterval(pingAndCount, 15000);

// TODO add checksum test
