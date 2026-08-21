const mongoose = require("mongoose");

/**
 * Loan rules (KH):
 *
 * គេខ្ចី (lent — you lend):
 *   1) ដកពី Budget (spending envelope)
 *   2) បញ្ចូល Expense category Loan
 *   3) ពេលគេសង → Saving category LoanReturn + update loan
 *
 * ខ្ចីគេ (borrowed — you borrow):
 *   1) ដាក់ចូល Budget (spending envelope +)
 *   2) ពេលអ្នកសង → Expense category Loan + update loan entity
 */

const repaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["USD", "KHR", "THB"], default: "USD" },
    amountUSD: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    noted: { type: String, default: "" },
    linkedSavingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Saving",
      default: null,
    },
    linkedExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },
  },
  { _id: true },
);

const loanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["lent", "borrowed"],
      required: true,
      default: "lent",
    },
    person: { type: String, required: true, trim: true },
    relation: {
      type: String,
      enum: ["Friend", "Relative", "Colleague", "Neighbor", "Other"],
      default: "Friend",
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["USD", "KHR", "THB"],
      default: "USD",
    },
    amountUSD: { type: Number, required: true },
    repaidAmount: { type: Number, default: 0, min: 0 },
    repaidAmountUSD: { type: Number, default: 0 },
    interestRate: { type: Number, default: 0, min: 0, max: 100 },
    interestType: {
      type: String,
      enum: ["simple", "compound"],
      default: "simple",
    },
    status: {
      type: String,
      enum: ["Active", "Partial", "Paid", "Cancelled"],
      default: "Active",
    },
    loanDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: ["Cash", "ABA Bank", "ACLEDA Bank", "Wing", "Transfer", "Other"],
      default: "Cash",
    },
    noted: { type: String, default: "" },
    trackCashFlow: { type: Boolean, default: true },
    linkedExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },
    linkedSavingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Saving",
      default: null,
    },
    linkedBudgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Budget",
      default: null,
    },
    repayments: [repaymentSchema],
  },
  { timestamps: true },
);

loanSchema.index({ userId: 1, direction: 1, status: 1 });
loanSchema.index({ userId: 1, loanDate: -1 });

module.exports = mongoose.model("Loan", loanSchema);
