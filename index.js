const WebSocket = require('ws');

const fs = require('fs');

const wsOrderBook = new WebSocket('wss://ftx.com/ws/');

const orderBookRequest =
  '{"op": "subscribe", "channel": "orderbook", "market": "BTC-PERP"}';

let partialBids = [];
let partialAsks = [];

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

// deal with the incoming data

wsOrderBook.on('message', function incoming(data) {
  // if it is a partial row then set the pB and pA variables:

  row = JSON.parse(data);
  if (row.type == 'partial') {
    setPartial(row);
    console.log('partial order book has been set!');
  }

  // if it is an udpate row, update the orderbok objects
  else if (row.type == 'update') {
    updateOrderbook(row);
  }
});

// function to update the orderbook... trying it real time

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

  console.log(`best bid/ask: ${bestBid} / ${bestAsk}`);

  // now convert it into the data i want to write

  let rowToWrite = JSON.stringify({
    time: row.data.time,
    bids: currentBids,
    asks: currentAsks,
    bestBid: bestBid,
    bestAsk: bestAsk
  });

  fs.appendFileSync('../ob_data_2.txt', rowToWrite + ',');
};
