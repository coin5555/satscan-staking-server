require('dotenv').config();
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require("ecpair");
const ecc = require("tiny-secp256k1");

// Retrieve the private key from the .env file
const privateKeyWIF = process.env.PRIVATE_KEY;

if (!privateKeyWIF) {
  console.error('Private key not found in environment variable PRIVATE_KEY');
} else {
  try {
    // Convert the WIF private key to an ECPair (Elliptic Curve Pair) object
    const network = bitcoin.networks.bitcoin;
    const ECPair = ECPairFactory.ECPairFactory(ecc);
    const keyPair = ECPair.fromWIF(privateKeyWIF, network);

    // Get the raw private key as a Buffer (32 bytes)
    const rawPrivateKeyBuffer = keyPair.privateKey;

    console.log('Private Key (WIF):', privateKeyWIF);
    console.log('Raw Private Key (Buffer):', rawPrivateKeyBuffer.toString('hex'));
  } catch (error) {
    console.error('Error:', error.message || 'An error occurred');
  }
}
