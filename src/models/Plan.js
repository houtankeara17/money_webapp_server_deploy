const mongoose = require("mongoose");

/**
 * Life goals + Investment returns list
 * Investment: log each gain/return → list how much you got
 */

const investmentReturnSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "KHR", "THB"], default: "USD" },
    amountUSD: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    noted: { type: String, default: "" },
    /** profit | dividend | sale | other */
    kind: {
      type: String,
      enum: ["profit", "dividend", "sale", "deposit", "other"],
      default: "profit",
    },
  },
  { _id: true },
);

const planSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    goalType: {
      type: String,
      required: true,
      enum: [
        "Buy Item",
        "Travel",
        "Marriage",
        "Build House",
        "Buy Home",
        "Education",
        "Emergency",
        "Vehicle",
        "Investment",
        "Long term Savings",
        "Goals",
        "Other",
      ],
      default: "Other",
    },
    targetAmount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "KHR", "THB"],
      default: "USD",
    },
    targetAmountUSD: { type: Number, required: true },
    currentFunding: { type: Number, default: 0, min: 0 },
    currentFundingUSD: { type: Number, default: 0 },
    targetDate: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        "Planning",
        "Progress",
        "Ongoing",
        "In Progress",
        "Paused",
        "Completed",
        "Accomplished",
        "Cancelled",
      ],
      default: "Planning",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    images: [{ type: String }],
    noted: { type: String, default: "" },
    /**
     * Investment only: list of gains / returns (how much you got)
     * totalGainUSD is sum of amountUSD (can be negative if loss)
     */
    investmentReturns: { type: [investmentReturnSchema], default: [] },
    totalGainUSD: { type: Number, default: 0 },
  },
  { timestamps: true },
);

planSchema.index({ userId: 1, status: 1 });
planSchema.index({ userId: 1, goalType: 1 });

module.exports = mongoose.model("Plan", planSchema);
