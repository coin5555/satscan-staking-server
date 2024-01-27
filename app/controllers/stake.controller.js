const bitcoin = require("bitcoinjs-lib");
const ECPairFactory = require("ecpair");
const ecc = require("tiny-secp256k1");
const { initEccLib } = require("bitcoinjs-lib/src/ecc_lib");
const CryptoAccount = require("send-crypto");
const axios = require("axios");
if (global._bitcore) delete global._bitcore;
const db = require("../models");
const Stake = db.stakes;
const Unstake = db.unstakes;


initEccLib(ecc);


// Function to fetch UTXOs and corresponding raw transactions
async function fetchUTXOsBlockchainInfo(address) {
  try {
      const utxoUrl = `https://blockchain.info/unspent?active=${address}`;
      const utxoResponse = await axios.get(utxoUrl);

      const utxos = await Promise.all(utxoResponse.data.unspent_outputs.map(async utxo => {
          const rawTxUrl = `https://blockchain.info/rawtx/${utxo.tx_hash_big_endian}?format=hex`;
          const rawTxResponse = await axios.get(rawTxUrl);

          return {
              txid: utxo.tx_hash_big_endian,
              vout: utxo.tx_output_n,
              value: utxo.value,
              script: utxo.script,
              rawTx: rawTxResponse.data
          };
      }));

      console.log("Extracted Blockchain.info UTXOs:", utxos);
      return utxos;
  } catch (error) {
      console.error("Error fetching UTXOs from Blockchain.info:", error.message);
      throw new Error(`Error fetching UTXOs from Blockchain.info: ${error.message}`);
  }
}

// Function to broadcast a transaction
async function broadcastTransaction(transactionHex) {
  try {
      const url = 'https://blockstream.info/api/tx';
      const response = await axios.post(url, transactionHex);
      return response.data;
  } catch (error) {
      throw new Error(`Error broadcasting transaction: ${error.message}`);
  }
}


// Create stake
exports.create = async (req, res) => {
  const currentTime = new Date(new Date().toUTCString());
  const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);
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
      res.send("Success");
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while creating the Spots.",
      });
    });
};

// Claim
exports.claim = async (req, res) => {
  try {
    // Check for last claim time
    const userStake = await Stake.findOne({ from: req.body.address });
    const currentTime = new Date();
    const twoWeeksAgo = new Date(currentTime.getTime() - 1209600000); // 1209600000 ms = 2 weeks

    if (userStake && userStake.lastClaimTime && userStake.lastClaimTime > twoWeeksAgo) {
      res.status(400).send("Claim can only be made once every two weeks.");
      return;
    }

    const response = await axios.get(
      `https://blockchain.info/balance?active=${process.env.PUBLIC_KEY}`
    );

    if (!response.data[process.env.PUBLIC_KEY]) {
      res.send("No balance found for the provided public key.");
      return;
    }

    const amount = response.data[process.env.PUBLIC_KEY].final_balance;
    console.log("Blockchain balance amount:", amount);

    if (!userStake) {
      res.send("You have not staked any $Scan");
      return;
    }

    const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);
    let totalAmount = 0;
    if (currentTimeInSeconds - userStake.createTime > 1209600) {
      totalAmount += userStake.amount;
    }

    console.log("Total staked amount:", totalAmount);
    console.log("Total supply from environment variable:", process.env.TOTAL_SUPPLY);

    if (totalAmount === 0) {
      res.send("Your staking period must be at least 2 weeks to claim.");
      return;
    }

    const claimAmount = Math.floor(amount * (totalAmount / process.env.TOTAL_SUPPLY) * 10);
    console.log("Calculated claimAmount:", claimAmount);

    if (claimAmount < 0.0000000001) {
      res.send("Your claim amount < 0.00001BTC");
      return;
    }

    // Use the recipient address passed as a parameter
    const address = req.body.address;

    const claimResult = await claimBTC(address, claimAmount);
    res.send(claimResult);

    // Update last claim time
    userStake.lastClaimTime = currentTime;
    await userStake.save();

  } catch (error) {
    console.error("Claim Function Error:", error);
    res.status(500).send({
      message: error.message || "An error occurred during the claim process."
    });
  }
};





exports.claimableAmount = async (req, res) => {
  try {
    const response = await axios.get(
      `https://blockchain.info/balance?active=${process.env.PUBLIC_KEY}`
    );
    const amount = response.data[process.env.PUBLIC_KEY].final_balance;
    const data = await Stake.find({ from: req.body.address });

    if (data.length === 0) {
      res.json({
        claimAmount: "0",
        totalAmount: "0",
      });
    } else if (data.length !== 0) {
      const currentTime = new Date();
      const currentTimeInSeconds = Math.floor(currentTime.getTime() / 1000);
      let totalAmount = 0;
      let totalStakedAmount = 0;
      for (let i = 0; i < data.length; i++) {
        totalStakedAmount += data[i].amount;
        if (currentTimeInSeconds - data[i].createTime > 1209600) {
          totalAmount += data[i].amount;
        }
      }
      const claimAmount = (amount * (totalAmount / process.env.TOTAL_SUPPLY)) / 10000000;

      // Round claimAmount to 7 decimal places
      const roundedClaimAmount = parseFloat(claimAmount.toFixed(7));

      // Log the values (optional)
      console.log("Amount from API:", amount);
      console.log("Data from Stake:", data);
      console.log("Total Staked Amount:", totalAmount);
      console.log("Calculated Claim Amount:", claimAmount);
      console.log("process.env.PUBLIC_KEY:", process.env.PUBLIC_KEY);
      console.log("claimAmount:", roundedClaimAmount);
      console.log("totalAmount:", totalAmount);

      // Log the claimable amount
      console.log("Claimable BTC Amount:", roundedClaimAmount);

      res.json({
        claimAmount: roundedClaimAmount.toString(),
        totalAmount: totalStakedAmount.toString(),
      });
    }
  } catch (error) {
    console.error("Error in claimableAmount function:", error);
    res.status(500).send({
      message: error.message || "An error occurred during the claimable amount calculation."
    });
  }
};




// Function to claim BTC
const claimBTC = async (address, claimAmount) => {
  try {
      const network = bitcoin.networks.bitcoin;
      const privateKeyWIF = process.env.PRIVATE_KEY;
      const ECPair = ECPairFactory.ECPairFactory(ecc);
      const keyPair = ECPair.fromWIF(privateKeyWIF, network);
      const senderAddress = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address;

      const utxos = await fetchUTXOsBlockchainInfo(senderAddress);

      if (utxos.length === 0) {
          throw new Error("No UTXOs available for the sender's address");
      }

      const psbt = new bitcoin.Psbt({ network });
      utxos.forEach(utxo => {
          psbt.addInput({
              hash: utxo.txid,
              index: utxo.vout,
              nonWitnessUtxo: Buffer.from(utxo.rawTx, 'hex')
          });
      });

      const fee = 10000; // Example fee, adjust as needed
      const totalUtxoValue = utxos.reduce((acc, utxo) => acc + utxo.value, 0);
      const change = totalUtxoValue - claimAmount - fee;

      psbt.addOutput({
          address: address,
          value: claimAmount,
      });

      if (change > 0) {
          psbt.addOutput({
              address: senderAddress,
              value: change,
          });
      }

      utxos.forEach((utxo, index) => {
          psbt.signInput(index, keyPair);
      });

      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      console.log("Transaction Hex:", tx.toHex());

      const broadcastResult = await broadcastTransaction(tx.toHex());
      return broadcastResult;
  } catch (error) {
      console.error('Claim Transaction Error:', error.message || 'An error occurred');
      throw error;
  }
};



exports.unstake = async (req, res) => {
  const data = await Unstake.find({address: req.body.address})
  if(data.length == 0){
    const unstake = new Unstake({
      address: req.body.address,
      amount: req.body.amount
    });
    unstake
    .save(unstake)
    .then((data) => {
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
exports.unstakeSuccess = async (req, res) => {
  for(let i = 0; i<req.body.length; i++){
    await Unstake.deleteMany({address: {$in: req.body[i].address}})
    await Stake.deleteMany({from: {$in: req.body[i].address}})
  }
  res.send("Success")
}