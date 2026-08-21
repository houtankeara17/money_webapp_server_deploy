const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema(
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
    /** Base salary before bonus deductions (set on first link or create) */
    originalAmount: {
      type: Number,
      default: null,
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
    status: {
      type: String,
      enum: ["Draft", "Confirmed", "Disbursed"],
      default: "Confirmed",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "ABA Bank", "ACLEDA Bank", "Wing", "Transfer", "Other"],
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

salarySchema.index({ userId: 1, year: 1, monthNumber: 1 });

module.exports = mongoose.model("Salary", salarySchema);
