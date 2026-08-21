const mongoose = require("mongoose");

const remittanceSchema = new mongoose.Schema(
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
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    recipientRelation: {
      type: String,
      enum: [
        "Mother",
        "Father",
        "Sibling",
        "Spouse",
        "Child",
        "Relative",
        "Friend",
        "Other",
      ],
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: [
        "Cash",
        "ABA Bank",
        "ACLEDA Bank",
        "Credit Card",
        "Wing",
        "Transfer",
        "Other",
      ],
    },
    remittanceDate: {
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

remittanceSchema.index({ userId: 1, year: 1, monthNumber: 1 });
remittanceSchema.index({ userId: 1, recipientRelation: 1 });

module.exports = mongoose.model("Remittance", remittanceSchema);
