const asyncHandler = require("express-async-handler");
const ExchangeLog = require("../models/ExchangeLog");
const { getDateParts, toObjectId } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const PROVIDERS = [
  "ABA Bank",
  "ACLEDA Bank",
  "Wing",
  "Street Exchange",
  "Airport",
  "Other",
];
const CURRENCIES = ["USD", "KHR", "THB"];

const getExchangeLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    year,
    monthNumber,
    provider,
    fromCurrency,
    toCurrency,
    sort = "-exchangeDate",
  } = req.query;

  const query = { userId: toObjectId(req.user._id) };
  if (year) query.year = Number(year);
  if (monthNumber) query.monthNumber = Number(monthNumber);
  if (provider) query.provider = provider;
  if (fromCurrency) query.fromCurrency = fromCurrency;
  if (toCurrency) query.toCurrency = toCurrency;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await ExchangeLog.countDocuments(query);
  const items = await ExchangeLog.find(query)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const yearsAgg = await ExchangeLog.aggregate([
    { $match: { userId: toObjectId(req.user._id) } },
    { $group: { _id: "$year" } },
    { $sort: { _id: -1 } },
  ]);
  const availableYears = yearsAgg.map((y) => y._id);

  const yearQuery = { userId: toObjectId(req.user._id) };
  if (year) yearQuery.year = Number(year);

  const yearSummary = await ExchangeLog.aggregate([
    { $match: yearQuery },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalFromUSD: {
          $sum: {
            $cond: [{ $eq: ["$fromCurrency", "USD"] }, "$fromAmount", 0],
          },
        },
      },
    },
  ]);

  // By provider
  const byProvider = await ExchangeLog.aggregate([
    { $match: yearQuery },
    { $group: { _id: "$provider", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return success(res, {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
    availableYears,
    yearSummary: yearSummary[0] || { count: 0, totalFromUSD: 0 },
    byProvider,
    providers: PROVIDERS,
    currencies: CURRENCIES,
  });
});

const createExchangeLog = asyncHandler(async (req, res) => {
  const {
    fromCurrency,
    fromAmount,
    toCurrency,
    toAmount,
    rateUsed,
    officialRate,
    provider,
    providerNote,
    exchangeDate,
    noted,
    images,
  } = req.body;

  if (
    !fromCurrency ||
    !fromAmount ||
    !toCurrency ||
    !toAmount ||
    !rateUsed ||
    !provider
  ) {
    return error(res, msg(req, "exchange.requiredFields"), 400);
  }

  if (fromCurrency === toCurrency) {
    return error(res, msg(req, "exchange.sameCurrency"), 400);
  }

  const date = exchangeDate ? new Date(exchangeDate) : new Date();
  const parts = getDateParts(date);

  const log = await ExchangeLog.create({
    userId: toObjectId(req.user._id),
    fromCurrency,
    fromAmount: Number(fromAmount),
    toCurrency,
    toAmount: Number(toAmount),
    rateUsed: Number(rateUsed),
    officialRate: officialRate != null ? Number(officialRate) : null,
    provider,
    providerNote: providerNote || "",
    exchangeDate: date,
    ...parts,
    noted: noted || "",
    images: images || [],
  });

  return success(res, log, msg(req, "exchange.created"), 201);
});

const updateExchangeLog = asyncHandler(async (req, res) => {
  const log = await ExchangeLog.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!log) return error(res, msg(req, "exchange.notFound"), 404);

  const fields = [
    "fromCurrency",
    "fromAmount",
    "toCurrency",
    "toAmount",
    "rateUsed",
    "officialRate",
    "provider",
    "providerNote",
    "exchangeDate",
    "noted",
    "images",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) log[f] = req.body[f];
  });
  if (req.body.fromAmount !== undefined)
    log.fromAmount = Number(req.body.fromAmount);
  if (req.body.toAmount !== undefined) log.toAmount = Number(req.body.toAmount);
  if (req.body.rateUsed !== undefined) log.rateUsed = Number(req.body.rateUsed);
  if (
    req.body.officialRate !== undefined &&
    req.body.officialRate !== null &&
    req.body.officialRate !== ""
  ) {
    log.officialRate = Number(req.body.officialRate);
  }

  if (req.body.exchangeDate) {
    log.exchangeDate = new Date(req.body.exchangeDate);
    Object.assign(log, getDateParts(log.exchangeDate));
  }

  const updated = await log.save();
  return success(res, updated, msg(req, "exchange.updated"));
});

// DELETE /api/exchanges/:id
const deleteExchangeLog = asyncHandler(async (req, res) => {
  const log = await ExchangeLog.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!log) return error(res, msg(req, "exchange.notFound"), 404);
  return success(res, null, msg(req, "exchange.deleted"));
});

// DELETE /api/exchanges
const deleteAllExchangeLogs = asyncHandler(async (req, res) => {
  const result = await ExchangeLog.deleteMany({
    userId: toObjectId(req.user._id),
  });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "exchange.allDeleted"),
  );
});

// EXPORT
const exportExchangeLogs = asyncHandler(async (req, res) => {
  const items = await ExchangeLog.find({
    userId: toObjectId(req.user._id),
  }).sort("-exchangeDate");

  return success(res, items, msg(req, "exchange.exportReady"));
});

// IMPORT (Handles JSON items array or parsed Excel rows)
const importExchangeLogs = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "exchange.importNoItems"), 400);
  }

  const validEntries = [];

  for (const item of items) {
    const fromCurrency =
      item.fromCurrency || item.FromCurrency || item["From Currency"];
    const toCurrency =
      item.toCurrency || item.ToCurrency || item["To Currency"];
    const fromAmount = Number(
      item.fromAmount || item.FromAmount || item["From Amount"],
    );
    const toAmount = Number(
      item.toAmount || item.ToAmount || item["To Amount"],
    );
    const rateUsed = Number(
      item.rateUsed || item.RateUsed || item["Rate"] || item["Exchange Rate"],
    );
    const provider = item.provider || item.Provider || "Other";
    const exchangeDate = item.exchangeDate || item.ExchangeDate || item.Date;
    const noted = item.noted || item.Noted || item.Note || "";

    if (!fromCurrency || !toCurrency || !fromAmount || !toAmount || !rateUsed) {
      continue;
    }

    const date = exchangeDate ? new Date(exchangeDate) : new Date();
    const parts = getDateParts(date);

    validEntries.push({
      userId: toObjectId(req.user._id),
      fromCurrency,
      fromAmount,
      toCurrency,
      toAmount,
      rateUsed,
      officialRate: item.officialRate ? Number(item.officialRate) : null,
      provider,
      exchangeDate: date,
      ...parts,
      noted,
    });
  }

  if (validEntries.length === 0) {
    return error(res, msg(req, "exchange.importNoRowsFound"), 400);
  }

  const inserted = await ExchangeLog.insertMany(validEntries);

  return success(
    res,
    { count: inserted.length },
    msg(req, "exchange.importedSuccess", { count: inserted.length }),
    201,
  );
});

module.exports = {
  getExchangeLogs,
  createExchangeLog,
  updateExchangeLog,
  deleteExchangeLog,
  deleteAllExchangeLogs,
  exportExchangeLogs,
  importExchangeLogs,
};
