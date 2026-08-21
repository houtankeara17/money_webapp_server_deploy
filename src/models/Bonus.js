const mongoose = require("mongoose");

const bonusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "KHR", "THB"],
      default: "USD",
    },
    amountUSD: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: String,
      required: true,
    },
    monthNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    tag: {
      type: String,
      required: true,
      enum: [
        "Performance",
        "Holiday",
        "Project",
        "Annual",
        "Referral",
        "Other",
      ],
    },
    status: {
      type: String,
      enum: ["Draft", "Confirmed", "Disbursed"],
      default: "Confirmed",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "ABA Bank", "ACLEDA Bank", "Credit Card", "Wing", "Transfer", "Other"],
      default: "ABA Bank",
    },
    image: {
      type: String,
      default: "",
    },
    noted: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

bonusSchema.index({ userId: 1, year: 1, monthNumber: 1 });

module.exports = mongoose.model("Bonus", bonusSchema);
