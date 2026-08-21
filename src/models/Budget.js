const mongoose = require("mongoose");

/**
 * Monthly Budget (envelope)
 * Example: Income 600 → Savings 200 + Family/Remittance 200 + Spending 200
 */
const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    year: { type: Number, required: true },
    monthNumber: { type: Number, required: true, min: 1, max: 12 },
    month: { type: String, default: "" },
    currency: {
      type: String,
      enum: ["USD", "KHR", "THB"],
      default: "USD",
    },
    // Planned income (salary + bonus target for the month)
    plannedIncome: { type: Number, default: 0, min: 0 },
    plannedIncomeUSD: { type: Number, default: 0 },
    // Envelopes
    savingsAmount: { type: Number, default: 0, min: 0 },
    savingsAmountUSD: { type: Number, default: 0 },
    remittanceAmount: { type: Number, default: 0, min: 0 },
    remittanceAmountUSD: { type: Number, default: 0 },
    spendingAmount: { type: Number, default: 0, min: 0 },
    spendingAmountUSD: { type: Number, default: 0 },
    noted: { type: String, default: "" },
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, year: 1, monthNumber: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);
