module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      amount: Number,
      address: String
    },
    { timestamps: true }
  );

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  const Total = mongoose.model("total", schema);
  return Total;
};
