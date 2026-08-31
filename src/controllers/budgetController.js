const asyncHandler = require("express-async-handler");
const Budget = require("../models/Budget");
const { toUSD, toObjectId } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getBudgets = asyncHandler(async (req, res) => {
  const { year, monthNumber, page = 1, limit = 24 } = req.query;
  const userId = toObjectId(req.user._id);
  const query = { userId };
  if (year) query.year = Number(year);
  if (monthNumber) query.monthNumber = Number(monthNumber);

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Budget.countDocuments(query);
  const items = await Budget.find(query)
    .sort("-year -monthNumber")
    .skip(skip)
    .limit(Number(limit));

  const yearQuery = { userId };
  if (year) yearQuery.year = Number(year);

  const yearAgg = await Budget.aggregate([
    { $match: yearQuery },
    {
      $group: {
        _id: null,
        totalPlannedUSD: { $sum: "$plannedIncomeUSD" },
        totalSavingsUSD: { $sum: "$savingsAmountUSD" },
        totalRemittanceUSD: { $sum: "$remittanceAmountUSD" },
        totalSpendingUSD: { $sum: "$spendingAmountUSD" },
        count: { $sum: 1 },
      },
    },
  ]);

  const yearsAgg = await Budget.aggregate([
    { $match: { userId } },
    { $group: { _id: "$year" } },
    { $sort: { _id: -1 } },
  ]);

  const ya = yearAgg[0] || {};
  const yearSummary = {
    totalPlannedUSD: ya.totalPlannedUSD || 0,
    totalEnvelopesUSD:
      (ya.totalSavingsUSD || 0) +
      (ya.totalRemittanceUSD || 0) +
      (ya.totalSpendingUSD || 0),
    totalSpendingUSD: ya.totalSpendingUSD || 0,
    count: ya.count || 0,
  };

  return success(res, {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
    yearSummary,
    availableYears: yearsAgg.map((y) => y._id),
  });
});

const createBudget = asyncHandler(async (req, res) => {
  const {
    year,
    monthNumber,
    currency = "USD",
    plannedIncome = 0,
    savingsAmount = 0,
    remittanceAmount = 0,
    spendingAmount = 0,
    noted = "",
  } = req.body;

  if (!year || !monthNumber) {
    return error(res, msg(req, "budget.requiredFields") || "Year and month required", 400);
  }

  const mn = Number(monthNumber);
  if (mn < 1 || mn > 12) {
    return error(res, msg(req, "budget.invalidMonth") || "Invalid month", 400);
  }

  const exists = await Budget.findOne({
    userId: toObjectId(req.user._id),
    year: Number(year),
    monthNumber: mn,
  });
  if (exists) {
    return error(res, msg(req, "budget.exists") || "Budget already exists for this month", 400);
  }

  const cur = currency || "USD";
  const budget = await Budget.create({
    userId: toObjectId(req.user._id),
    year: Number(year),
    monthNumber: mn,
    month: MONTH_NAMES[mn - 1],
    currency: cur,
    plannedIncome: Number(plannedIncome) || 0,
    plannedIncomeUSD: toUSD(plannedIncome || 0, cur, req.user),
    savingsAmount: Number(savingsAmount) || 0,
    savingsAmountUSD: toUSD(savingsAmount || 0, cur, req.user),
    remittanceAmount: Number(remittanceAmount) || 0,
    remittanceAmountUSD: toUSD(remittanceAmount || 0, cur, req.user),
    spendingAmount: Number(spendingAmount) || 0,
    spendingAmountUSD: toUSD(spendingAmount || 0, cur, req.user),
    noted: noted || "",
  });

  return success(res, budget, msg(req, "budget.created"), 201);
});

const updateBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!budget) return error(res, msg(req, "budget.notFound") || "Not found", 404);

  const fields = [
    "year",
    "monthNumber",
    "currency",
    "plannedIncome",
    "savingsAmount",
    "remittanceAmount",
    "spendingAmount",
    "noted",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) budget[f] = req.body[f];
  });

  if (budget.monthNumber) {
    budget.month = MONTH_NAMES[Number(budget.monthNumber) - 1] || budget.month;
  }

  const cur = budget.currency || "USD";
  budget.plannedIncomeUSD = toUSD(budget.plannedIncome, cur, req.user);
  budget.savingsAmountUSD = toUSD(budget.savingsAmount, cur, req.user);
  budget.remittanceAmountUSD = toUSD(budget.remittanceAmount, cur, req.user);
  budget.spendingAmountUSD = toUSD(budget.spendingAmount, cur, req.user);

  const updated = await budget.save();
  return success(res, updated, msg(req, "budget.updated"));
});

const deleteBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!budget) return error(res, msg(req, "budget.notFound") || "Not found", 404);
  return success(res, null, msg(req, "budget.deleted"));
});

const deleteAllBudgets = asyncHandler(async (req, res) => {
  const result = await Budget.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "budget.allDeleted")
  );
});

const exportBudgets = asyncHandler(async (req, res) => {
  const items = await Budget.find({ userId: toObjectId(req.user._id) }).sort(
    "-year -monthNumber"
  );
  return success(res, items, msg(req, "budget.exportReady"));
});

const importBudgets = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "budget.importNoData") || "No data", 400);
  }

  const createdBudgets = [];
  for (const row of items) {
    const year = Number(row.Year ?? row.year);
    const mn = Number(
      row.Month ?? row.monthNumber ?? row.month ?? row["Month Number"]
    );
    const currency = row.Currency || row.currency || "USD";
    const plannedIncome =
      Number(row.PlannedIncome ?? row.plannedIncome ?? row["Planned Income"]) || 0;
    const savingsAmount =
      Number(row.SavingsAmount ?? row.savingsAmount ?? row["Savings Amount"]) || 0;
    const remittanceAmount =
      Number(
        row.RemittanceAmount ?? row.remittanceAmount ?? row["Remittance Amount"]
      ) || 0;
    const spendingAmount =
      Number(
        row.SpendingAmount ?? row.spendingAmount ?? row["Spending Amount"]
      ) || 0;
    const noted = row.Noted || row.noted || row.Note || row.note || "";

    if (!year || isNaN(year) || !mn || isNaN(mn) || mn < 1 || mn > 12) continue;

    const exists = await Budget.findOne({
      userId: toObjectId(req.user._id),
      year,
      monthNumber: mn,
    });
    if (exists) continue;

    const budget = await Budget.create({
      userId: toObjectId(req.user._id),
      year,
      monthNumber: mn,
      month: MONTH_NAMES[mn - 1],
      currency,
      plannedIncome,
      plannedIncomeUSD: toUSD(plannedIncome, currency, req.user),
      savingsAmount,
      savingsAmountUSD: toUSD(savingsAmount, currency, req.user),
      remittanceAmount,
      remittanceAmountUSD: toUSD(remittanceAmount, currency, req.user),
      spendingAmount,
      spendingAmountUSD: toUSD(spendingAmount, currency, req.user),
      noted,
    });
    createdBudgets.push(budget);
  }

  return success(
    res,
    { count: createdBudgets.length },
    msg(req, "budget.importedSuccess", { count: createdBudgets.length }) ||
      `Imported ${createdBudgets.length}`
  );
});

module.exports = {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  deleteAllBudgets,
  exportBudgets,
  importBudgets,
};
