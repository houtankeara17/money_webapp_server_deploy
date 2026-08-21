const asyncHandler = require("express-async-handler");
const Plan = require("../models/Plan");
const { toUSD, toObjectId } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const getPlans = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    priority,
    goalType,
    sort = "-createdAt",
  } = req.query;
  const query = { userId: toObjectId(req.user._id) };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (goalType) query.goalType = goalType;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Plan.countDocuments(query);
  const items = await Plan.find(query)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const summary = await Plan.aggregate([
    { $match: { userId: toObjectId(req.user._id) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalTargetUSD: { $sum: "$targetAmountUSD" },
        totalFunded: { $sum: "$currentFunding" },
      },
    },
  ]);

  return success(res, {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
    summary,
  });
});

const createPlan = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    goalType,
    targetAmount,
    currency,
    currentFunding,
    targetDate,
    status,
    priority,
    noted,
    images,
  } = req.body;
  if (!title || !targetAmount || !currency) {
    return error(res, "Title, target amount and currency are required", 400);
  }
  const targetAmountUSD = toUSD(targetAmount, currency, req.user);
  const funded = Number(currentFunding) || 0;
  const plan = await Plan.create({
    userId: toObjectId(req.user._id),
    title,
    description: description || "",
    goalType: goalType || "Other",
    targetAmount: Number(targetAmount),
    currency,
    targetAmountUSD,
    currentFunding: funded,
    currentFundingUSD: toUSD(funded, currency, req.user),
    targetDate: targetDate || null,
    status: status || "Planning",
    priority: priority || "Medium",
    noted: noted || "",
    images: images || [],
  });
  return success(res, plan, msg(req, "plan.created"), 201);
});

const updatePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!plan) return error(res, "Plan not found", 404);

  const fields = [
    "title",
    "description",
    "goalType",
    "currency",
    "targetDate",
    "status",
    "priority",
    "noted",
    "images",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f];
  });
  if (req.body.targetAmount !== undefined)
    plan.targetAmount = Number(req.body.targetAmount);
  if (req.body.currentFunding !== undefined)
    plan.currentFunding = Number(req.body.currentFunding);
  if (req.body.targetAmount !== undefined || req.body.currency) {
    plan.targetAmountUSD = toUSD(plan.targetAmount, plan.currency, req.user);
  }
  if (req.body.currentFunding !== undefined || req.body.currency) {
    plan.currentFundingUSD = toUSD(
      plan.currentFunding,
      plan.currency,
      req.user,
    );
  }
  const updated = await plan.save();
  return success(res, updated, msg(req, "plan.updated"));
});

const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!plan) return error(res, "Plan not found", 404);
  return success(res, null, msg(req, "plan.deleted"));
});

const deleteAllPlans = asyncHandler(async (req, res) => {
  const result = await Plan.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deletedCount: result.deletedCount },
    `Deleted ${result.deletedCount} plans`,
  );
});

/** POST /api/plans/:id/returns — log investment gain/return */
const addInvestmentReturn = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!plan) return error(res, "Plan not found", 404);
  if (plan.goalType !== "Investment") {
    return error(res, "Returns list is only for Investment plans", 400);
  }

  const { amount, currency, date, noted = "", kind = "profit" } = req.body;
  const amt = Number(amount);
  if (amount == null || Number.isNaN(amt)) {
    return error(res, "Amount is required", 400);
  }

  const cur = currency || plan.currency || "USD";
  const amountUSD = toUSD(amt, cur, req.user);
  const when = date ? new Date(date) : new Date();

  plan.investmentReturns.push({
    amount: amt,
    currency: cur,
    amountUSD,
    date: when,
    noted: noted || "",
    kind: ["profit", "dividend", "sale", "deposit", "other"].includes(kind)
      ? kind
      : "profit",
  });

  plan.totalGainUSD = (plan.investmentReturns || []).reduce(
    (s, r) => s + (Number(r.amountUSD) || 0),
    0,
  );
  plan.totalGainUSD = Math.round(plan.totalGainUSD * 100) / 100;

  // Optional: bump currentFunding when deposit or when positive gain
  if (kind === "deposit" || (kind === "profit" && amt > 0)) {
    // do not auto-change funding for pure profit listing — user controls funding
  }

  // Mark completed if user sends statusCompleted
  if (req.body.markCompleted === true || req.body.markCompleted === "true") {
    plan.status = "Completed";
  }

  const updated = await plan.save();
  return success(
    res,
    updated,
    msg(req, "plan.returnAdded") || "Return recorded",
  );
});

const exportPlans = asyncHandler(async (req, res) => {
  const items = await Plan.find({ userId: toObjectId(req.user._id) }).sort(
    "-createdAt",
  );
  return success(res, items, msg(req, "plan.exportReady"));
});

const importPlans = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "plan.importNoRowsFound"), 400);
  }

  const validPlans = items
    .filter((row) => row.Title && row.TargetAmount)
    .map((row) => {
      const currency = row.Currency || req.user?.currency || "USD";
      const targetAmount = Number(row.TargetAmount) || 0;
      const currentFunding = Number(row.CurrentFunding) || 0;

      return {
        userId: toObjectId(req.user._id),
        title: String(row.Title).trim(),
        description: row.Description || "",
        goalType: row.GoalType || "Other",
        targetAmount,
        currency,
        targetAmountUSD: toUSD(targetAmount, currency, req.user),
        currentFunding,
        currentFundingUSD: toUSD(currentFunding, currency, req.user),
        status: row.Status || "Planning",
        priority: row.Priority || "Medium",
        targetDate: row.TargetDate ? new Date(row.TargetDate) : null,
        noted: row.Noted || "",
      };
    });

  if (validPlans.length === 0) {
    return error(res, msg(req, "plan.importNoRowsFound"), 400);
  }

  const created = await Plan.insertMany(validPlans);

  return success(
    res,
    { count: created.length },
    msg(req, "plan.importedSuccess", { count: created.length }),
    201,
  );
});

module.exports = {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  deleteAllPlans,
  exportPlans,
  importPlans,
  addInvestmentReturn,
};
