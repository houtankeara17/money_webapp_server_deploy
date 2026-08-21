const mongoose = require("mongoose");

/**
 * Convert amount to USD using user's exchange rates
 */
const toUSD = (amount, currency, user) => {
  if (currency === "USD") return Number(amount);
  if (currency === "KHR") return Number(amount) / (user.exchangeRateKhr || 4100);
  if (currency === "THB") return Number(amount) / (user.exchangeRateThb || 36.5);
  return Number(amount);
};

/**
 * Extract year, monthNumber, day, dayOfWeek from a Date
 */
const getDateParts = (date = new Date()) => {
  const d = new Date(date);
  return {
    year: d.getFullYear(),
    monthNumber: d.getMonth() + 1,
    day: d.getDate(),
    dayOfWeek: d.getDay(),
    month: d.toLocaleString("en-US", { month: "long" }),
  };
};

/**
 * Ensure userId is a proper ObjectId for queries/aggregates
 */
const toObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return id;
  }
};

module.exports = { toUSD, getDateParts, toObjectId };
