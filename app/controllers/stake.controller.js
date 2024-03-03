const bitcoin = require("bitcoinjs-lib");
const ECPairFactory = require("ecpair");
const ecc = require("tiny-secp256k1");
const CryptoAccount = require("send-crypto");
const axios = require("axios");
if (global._bitcore) delete global._bitcore;
const db = require("../models");
const Stake = db.stakes;
const Unstake = db.unstakes;
const Total = db.totals;
// Create stake
exports.create = async (req, res) => {
  const currentTime = new Date(new Date().toUTCString());
  const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);

  const data = await Total.findOne({ from: req.body.from });
  console.log("data", data);
  if (data) {
    console.log("here is if statement");
    data.amount += req.body.amount;
    await Total.updateOne({ from: req.body.from }, { amount: data.amount });
    console.log("Data updated successfully");
  }
  else {
    console.log("here is else statement");
    const total = new Total({
      from: req.body.from,
      amount: req.body.amount
    });
    await total.save();
    console.log("New data saved successfully");
  }


  console.log("req =====>>>>", req.body.from);
  const stake = new Stake({
    from: req.body.from,
    amount: req.body.amount,
    type: req.body.type,
    createTime: currentTimeInSeconds,
    sender: process.env.PRIVATE_KEY,
  });
  stake
    .save(stake)
    .then((data) => {
      res.send("hi suj");
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while creating the Spots.",
      });
    });
};
//Claim
exports.claim = async (req, res) => {
  const response = await axios.get(
    `https://blockchain.info/balance?active=${process.env.PUBLIC_KEY}`
  );
  console.log(response.data)
  const amount = response.data[process.env.PUBLIC_KEY].final_balance / 100000000;
  const data = await Stake.find({ from: req.body.address });
  if (data.length === 0) {
    res.send("You have not staked any $Scan");
  } else if (data.length !== 0) {
    const currentTime = new Date(new Date().toUTCString());
    const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);
    let totalAmount = 0;
    for (let i = 0; i < data.length; i++) {
      if (currentTimeInSeconds - data[i].createTime > 1209600) {
        totalAmount = totalAmount + data[i].amount;
      }
    }
    const claimBTCAmount = (amount * totalAmount) / process.env.TOTAL_SUPPLY;
    if (claimBTCAmount < 0.00001) {
      res.send("Your claim amount < 0.00001BTC");
    } else {
      const currentTime = new Date(new Date().toUTCString());
      const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);
      if (currentTimeInSeconds - data[0].createTime < 1209600) {
        res.send("Claim is possible 2 weeks after staking");
      } else {
        res.send(claimBTC(req.body.address, claimBTCAmount));
      }
    }
  }
};

exports.claimableAmount = async (req, res) => {
  const response = await axios.get(
    `https://blockchain.info/balance?active=${process.env.PUBLIC_KEY}`
  );
  const amount = response.data[process.env.PUBLIC_KEY].final_balance / 100000000;
  const data = await Stake.find({ from: req.body.address });
  if (data.length === 0) {
    res.json({
      claimBTCAmount: "0",
      totalAmount: "0",
    });
  } else if (data.length !== 0) {
    const currentTime = new Date(new Date().toUTCString());
    const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);
    let totalAmount = 0;
    let totalStakedAmount = 0;
    for (let i = 0; i < data.length; i++) {
      totalStakedAmount = totalStakedAmount + data[i].amount;
      if (currentTimeInSeconds - data[i].createTime > 1209600) {
        totalAmount = totalAmount + data[i].amount;
      }
    }
    const claimBTCAmount = (amount * totalAmount) / process.env.TOTAL_SUPPLY;
    res.json({
      claimBTCAmount: claimBTCAmount.toString(),
      totalAmount: totalStakedAmount,
    });
  }
};

const claimBTC = async (address, claimAmount) => {
  const network = bitcoin.networks.bitcoin;
  const ECPair = ECPairFactory.ECPairFactory(ecc);
  const privateKeyWIF = process.env.PRIVATE_KEY;
  const keyPair = ECPair.fromWIF(privateKeyWIF, network);
  const privateKey = keyPair.privateKey;
  const account = new CryptoAccount(privateKey);
  await account.send(address, claimAmount, "BTC", {
    subtractFee: true,
  });
  return "Success";
};

exports.unstake = async (req, res) => {
  // const data1 = await Unstake.find({ address: req.body.address })
  const data = await Total.findOne({from : req.body.address})
  const unstakeAmount = req.body.amount;
  if (data && data.amount >= unstakeAmount) {
    data.amount -= unstakeAmount;
    await Total.updateOne({ from: req.body.address }, { amount: data.amount });
    console.log("Data updated successfully");
    const unstake = new Unstake({
      address: req.body.address,
      amount: unstakeAmount
    });
    unstake
      .save(unstake)
      .then( async (data) => {
        res.send("Success");
      })
      .catch((err) => {
        res.status(500).send({
          message: err.message || "Some error occurred while creating the Spots.",
        });
      });
  } else {
    res.send("You have already requested unstake")
  }
};
exports.unstakeList = async (req, res) => {
  const data = await Unstake.find();
  res.json(data)
}
exports.totalList = async (req, res) => {
  const totalData = await Total.find();
  res.json(totalData)
}
exports.unstakeSuccess = async (req, res) => {
  for (let i = 0; i < req.body.length; i++) {
    await Unstake.deleteMany({ address: { $in: req.body[i].address } })
    await Stake.deleteMany({ from: { $in: req.body[i].address } })
  }
  res.send("Success")
}
