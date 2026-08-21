const mongoose = require("mongoose");

/**
 * Audit trail when bonuses change linked salary amounts
 */
const salaryBonusHistorySchema = new mongoose.Schema(
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
    salaryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salary",
      default: null,
    },
    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bonus",
      default: null,
    },
    action: {
      type: String,
      enum: [
        "bonus_created",
        "bonus_updated",
        "bonus_deleted",
        "salary_set",
      ],
      required: true,
    },
    currency: {
      type: String,
      enum: ["USD", "KHR", "THB"],
      default: "USD",
    },
    salaryBefore: { type: Number, default: 0 },
    salaryAfter: { type: Number, default: 0 },
    bonusAmount: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    noted: { type: String, default: "" },
  },
  { timestamps: true }
);

salaryBonusHistorySchema.index({ userId: 1, year: 1, monthNumber: 1, createdAt: -1 });

module.exports = mongoose.model("SalaryBonusHistory", salaryBonusHistorySchema);
