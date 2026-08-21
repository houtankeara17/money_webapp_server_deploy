const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
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
        "Food",
        "Rent",
        "Utilities",
        "Family",
        "Daily",
        "Transport",
        "Health",
        "Entertainment",
        "Loan",
        "Other",
      ],
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["Cash", "ABA Bank", "ACLEDA Bank", "Credit Card", "Wing", "Other"],
    },
    expenseDate: {
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
    /** Set when created from a Loan (cash-flow tracking) */
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

expenseSchema.index({ userId: 1, year: 1, monthNumber: 1 });
expenseSchema.index({ userId: 1, year: 1, monthNumber: 1, day: 1 });
expenseSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
