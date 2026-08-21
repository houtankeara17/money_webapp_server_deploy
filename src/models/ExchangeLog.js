const mongoose = require("mongoose");

const exchangeLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromCurrency: {
      type: String,
      required: true,
      enum: ["USD", "KHR", "THB"],
    },
    fromAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    toCurrency: {
      type: String,
      required: true,
      enum: ["USD", "KHR", "THB"],
    },
    toAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    rateUsed: {
      type: Number,
      required: true,
    },
    officialRate: {
      type: Number,
      default: null,
    },
    provider: {
      type: String,
      required: true,
      enum: [
        "ABA Bank",
        "ACLEDA Bank",
        "Wing",
        "Street Exchange",
        "Airport",
        "Other",
      ],
    },
    providerNote: {
      type: String,
      default: "",
    },
    exchangeDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    year: {
      type: Number,
      required: true,
    },
    monthNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
    },
    images: [
      {
        type: String,
      },
    ],
    noted: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

exchangeLogSchema.index({ userId: 1, year: 1, monthNumber: 1 });
exchangeLogSchema.index({ userId: 1, fromCurrency: 1, toCurrency: 1 });
exchangeLogSchema.index({ userId: 1, provider: 1 });

module.exports = mongoose.model("ExchangeLog", exchangeLogSchema);
