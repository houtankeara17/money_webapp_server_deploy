const asyncHandler = require("express-async-handler");
const Plan = require("../models/Plan");
const Saving = require("../models/Saving");
const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const { toUSD, toObjectId, getDateParts } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const RETURN_KINDS = ["profit", "dividend", "sale", "deposit", "borrow", "other"];
const PROFIT_KINDS = ["profit", "dividend", "sale", "deposit", "other"];

const isTruthy = (v) => v === true || v === "true" || v === 1 || v === "1";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const recalculateGainTotals = (plan) => {
  const returns = plan.investmentReturns || [];
  plan.totalGainUSD = round2(
    returns.reduce((s, r) => s + (Number(r.amountUSD) || 0), 0)
  );
  plan.totalBorrowedFromGainUSD = round2(
    returns
      .filter((r) => r.kind === "borrow")
      .reduce((s, r) => s + Math.abs(Number(r.amountUSD) || 0), 0)
  );
};

/** Ensure monthly budget exists; add amount to savings envelope */
const creditBudgetSavings = async ({
  userId,
  year,
  monthNumber,
  amount,
  amountUSD,
  currency,
  note,
}) => {
  let budget = await Budget.findOne({ userId, year, monthNumber });
  if (!budget) {
    return Budget.create({
      userId,
      year,
      monthNumber,
      month: "",
      currency,
      plannedIncome: 0,
      plannedIncomeUSD: 0,
      savingsAmount: Math.abs(amount),
      savingsAmountUSD: Math.abs(amountUSD),
      remittanceAmount: 0,
      remittanceAmountUSD: 0,
      spendingAmount: 0,
      spendingAmountUSD: 0,
      noted: note || "",
    });
  }

  budget.savingsAmountUSD = round2(
    (Number(budget.savingsAmountUSD) || 0) + Math.abs(amountUSD)
  );
  if (budget.currency === "USD") {
    budget.savingsAmount = budget.savingsAmountUSD;
  } else {
    budget.savingsAmount =
      (Number(budget.savingsAmount) || 0) + Math.abs(amount);
  }
  await budget.save();
  return budget;
};

const createInvestmentSaving = async ({
  userId,
  plan,
  amount,
  currency,
  amountUSD,
  when,
  parts,
  kind,
  noted,
}) => {
  return Saving.create({
    userId,
    amount: Math.abs(amount),
    currency,
    amountUSD: Math.abs(amountUSD),
    category: "Investment",
    year: parts.year,
    monthNumber: parts.monthNumber,
    savingDate: when,
    noted: noted || `${kind} from plan: ${plan.title}`,
    planId: plan._id,
  });
};

const createBorrowExpense = async ({
  userId,
  plan,
  amount,
  currency,
  amountUSD,
  when,
  parts,
  noted,
}) => {
  return Expense.create({
    userId,
    amount: Math.abs(amount),
    currency,
    amountUSD: Math.abs(amountUSD),
    category: "Other",
    paymentMethod: "Cash",
    expenseDate: when,
    year: parts.year,
    monthNumber: parts.monthNumber,
    day: parts.day,
    dayOfWeek: parts.dayOfWeek,
    noted: noted || `Borrow from investment: ${plan.title}`,
    images: [],
  });
};

// ─── CRUD ───────────────────────────────────────────────────────────

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

  if (!title || targetAmount == null || !currency) {
    return error(res, "Title, target amount and currency are required", 400);
  }

  const funded = Number(currentFunding) || 0;
  const plan = await Plan.create({
    userId: toObjectId(req.user._id),
    title,
    description: description || "",
    goalType: goalType || "Other",
    targetAmount: Number(targetAmount),
    currency,
    targetAmountUSD: toUSD(targetAmount, currency, req.user),
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

  if (req.body.targetAmount !== undefined) {
    plan.targetAmount = Number(req.body.targetAmount);
  }
  if (req.body.currentFunding !== undefined) {
    plan.currentFunding = Number(req.body.currentFunding);
  }
  if (req.body.targetAmount !== undefined || req.body.currency) {
    plan.targetAmountUSD = toUSD(plan.targetAmount, plan.currency, req.user);
  }
  if (req.body.currentFunding !== undefined || req.body.currency) {
    plan.currentFundingUSD = toUSD(
      plan.currentFunding,
      plan.currency,
      req.user
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
    `Deleted ${result.deletedCount} plans`
  );
});

const exportPlans = asyncHandler(async (req, res) => {
  const items = await Plan.find({ userId: toObjectId(req.user._id) }).sort(
    "-createdAt"
  );
  return success(res, items, msg(req, "plan.exportReady") || "Export ready");
});

const importPlans = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "plan.importNoRowsFound") || "No rows found", 400);
  }

  const validPlans = items
    .filter((row) => row.Title || row.title)
    .map((row) => {
      const currency =
        row.Currency || row.currency || req.user?.currency || "USD";
      const targetAmount = Number(row.TargetAmount ?? row.targetAmount) || 0;
      const currentFunding =
        Number(row.CurrentFunding ?? row.currentFunding) || 0;
      const title = String(row.Title || row.title || "").trim();
      if (!title || !targetAmount) return null;

      return {
        userId: toObjectId(req.user._id),
        title,
        description: row.Description || row.description || "",
        goalType: row.GoalType || row.goalType || "Other",
        targetAmount,
        currency,
        targetAmountUSD: toUSD(targetAmount, currency, req.user),
        currentFunding,
        currentFundingUSD: toUSD(currentFunding, currency, req.user),
        status: row.Status || row.status || "Planning",
        priority: row.Priority || row.priority || "Medium",
        targetDate:
          row.TargetDate || row.targetDate
            ? new Date(row.TargetDate || row.targetDate)
            : null,
        noted: row.Noted || row.noted || "",
      };
    })
    .filter(Boolean);

  if (validPlans.length === 0) {
    return error(res, msg(req, "plan.importNoRowsFound") || "No valid rows", 400);
  }

  const created = await Plan.insertMany(validPlans);
  return success(
    res,
    { count: created.length },
    msg(req, "plan.importedSuccess", { count: created.length }) ||
      `Imported ${created.length} plans`,
    201
  );
});

/**
 * POST /api/plans/:id/returns
 * Plans → Savings → Budget
 * - profit/dividend/deposit/sale → Saving + Budget
 * - borrow → plan info only (+ optional Expense)
 */
const addInvestmentReturn = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!plan) return error(res, "Plan not found", 404);
  if (plan.goalType !== "Investment") {
    return error(res, "Returns list is only for Investment plans", 400);
  }

  const {
    amount,
    currency,
    date,
    noted = "",
    kind = "profit",
    createExpense = false,
  } = req.body;

  const amt = Number(amount);
  if (amount == null || Number.isNaN(amt) || amt === 0) {
    return error(res, "Amount is required", 400);
  }

  const k = RETURN_KINDS.includes(kind) ? kind : "profit";
  const cur = currency || plan.currency || "USD";
  const absUSD = toUSD(Math.abs(amt), cur, req.user);
  const signedUSD = k === "borrow" ? -Math.abs(absUSD) : Math.abs(absUSD);
  const signedAmt = k === "borrow" ? -Math.abs(amt) : Math.abs(amt);
  const when = date ? new Date(date) : new Date();
  const parts = getDateParts(when);
  const userId = toObjectId(req.user._id);

  let linkedSavingId = null;
  let linkedExpenseId = null;

  try {
    if (k === "borrow") {
      if (isTruthy(createExpense)) {
        const exp = await createBorrowExpense({
          userId,
          plan,
          amount: amt,
          currency: cur,
          amountUSD: absUSD,
          when,
          parts,
          noted,
        });
        linkedExpenseId = exp._id;
      }
    } else if (PROFIT_KINDS.includes(k)) {
      const sav = await createInvestmentSaving({
        userId,
        plan,
        amount: amt,
        currency: cur,
        amountUSD: absUSD,
        when,
        parts,
        kind: k,
        noted,
      });
      linkedSavingId = sav._id;

      await creditBudgetSavings({
        userId,
        year: parts.year,
        monthNumber: parts.monthNumber,
        amount: amt,
        amountUSD: absUSD,
        currency: cur,
        note: `Auto from plan profit: ${plan.title}`,
      });

      if (k === "deposit") {
        plan.currentFunding =
          (Number(plan.currentFunding) || 0) + Math.abs(amt);
        plan.currentFundingUSD = toUSD(
          plan.currentFunding,
          plan.currency,
          req.user
        );
      }
    }
  } catch (err) {
    console.error("[plan return cashflow]", err);
    return error(res, `Cash-flow failed: ${err.message}`, 400);
  }

  plan.investmentReturns.push({
    amount: signedAmt,
    currency: cur,
    amountUSD: signedUSD,
    date: when,
    noted: noted || "",
    kind: k,
    linkedSavingId,
    linkedExpenseId,
  });

  recalculateGainTotals(plan);

  if (isTruthy(req.body.markCompleted)) {
    plan.status = "Completed";
  } else if (
    ["profit", "dividend"].includes(k) &&
    plan.status === "Planning"
  ) {
    plan.status = "Ongoing";
  }

  const updated = await plan.save();
  return success(
    res,
    updated,
    msg(req, "plan.returnAdded") || "Return recorded"
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
