const mongoose = require("mongoose");

const savingSchema = new mongoose.Schema(
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
    category: {
      type: String,
      required: true,
      enum: [
        "Emergency",
        "Travel",
        "House",
        "Education",
        "Investment",
        "LoanReturn",
        "Other",
      ],
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
    savingDate: {
      type: Date,
      default: Date.now,
    },
    noted: {
      type: String,
      default: "",
    },
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      default: null,
      index: true,
    },
    /** Linked Investment plan when this saving is a profit/deposit from a Plan */
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

savingSchema.index({ userId: 1, year: 1, monthNumber: 1 });
savingSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model("Saving", savingSchema);
