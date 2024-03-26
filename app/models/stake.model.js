module.exports = (mongoose) => {
    var schema = mongoose.Schema(
      {
        amount: Number,
        from: String,
        type: String,
        createTime: Number,
        sender: String
      },
      { timestamps: true }
    );
  
    schema.method("toJSON", function () {
      const { __v, _id, ...object } = this.toObject();
      object.id = _id;
      return object;
    });
  
    const Stake = mongoose.model("stake", schema);
    return Stake;
  };
  