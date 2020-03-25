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
  partialAsks = row.data.bids;

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

  bids.forEach(bid => (uBids[bid[0]] = bid[1]));
  asks.forEach(ask => (uAsks[ask[0]] = ask[1]));

  let currentBids = { ...pBids, ...uBids };
  let currentAsks = { ...pBids, ...uBids };

  // now convert it into the data i want to write

  let rowToWrite = [row.data.time, currentBids, currentAsks];

  let rowToWrite2 = {
    time: JSON.stringify(row.data.time),
    bids: JSON.stringify(currentBids),
    asks: JSON.stringify(currentAsks)
  };

  let rowToWrite3 = JSON.stringify({
    time: row.data.time,
    bids: currentBids,
    asks: currentAsks
  });

  //now write it

  fs.appendFileSync('message.txt', rowToWrite3 + ',');
};
