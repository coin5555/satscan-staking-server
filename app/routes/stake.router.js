module.exports = app => {
    const stake = require("../controllers/stake.controller.js");
  
    var router = require("express").Router();
  
    // stake
    router.post("/", stake.create);
    //claim
    router.post("/claim", stake.claim);
    //claimableAmount
    router.post("/claimableAmount", stake.claimableAmount);
    //unstake
    router.post("/unstake", stake.unstake);
    //getUnstake List
    router.post("/unstakeList", stake.unstakeList)
    //unstake Success
    router.post("/unstakeListSuccess", stake.unstakeSuccess)
    app.use("/api/stake", router);

  };
  