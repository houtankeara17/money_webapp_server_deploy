const asyncHandler = require("express-async-handler");
const Plan = require("../models/Plan");
const Saving = require("../models/Saving");
const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const { toUSD, toObjectId, getDateParts } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const getPlans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, priority, goalType, sort = "-createdAt" } = req.query;
  const query = { userId: toObjectId(req.user._id) };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (goalType) query.goalType = goalType;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Plan.countDocuments(query);
  const items = await Plan.find(query).sort(sort).skip(skip).limit(Number(limit));

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
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) || 1 },
    summary,
  });
});

const createPlan = asyncHandler(async (req, res) => {
  const { title, description, goalType, targetAmount, currency, currentFunding, targetDate, status, priority, noted, images } = req.body;
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
  const plan = await Plan.findOne({ _id: req.params.id, userId: toObjectId(req.user._id) });
  if (!plan) return error(res, "Plan not found", 404);

  const fields = ["title", "description", "goalType", "currency", "targetDate", "status", "priority", "noted", "images"];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f];
  });
  if (req.body.targetAmount !== undefined) plan.targetAmount = Number(req.body.targetAmount);
  if (req.body.currentFunding !== undefined) plan.currentFunding = Number(req.body.currentFunding);
  if (req.body.targetAmount !== undefined || req.body.currency) {
    plan.targetAmountUSD = toUSD(plan.targetAmount, plan.currency, req.user);
  }
  if (req.body.currentFunding !== undefined || req.body.currency) {
    plan.currentFundingUSD = toUSD(plan.currentFunding, plan.currency, req.user);
  }
  const updated = await plan.save();
  return success(res, updated, msg(req, "plan.updated"));
});

const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOneAndDelete({ _id: req.params.id, userId: toObjectId(req.user._id) });
  if (!plan) return error(res, "Plan not found", 404);
  return success(res, null, msg(req, "plan.deleted"));
});

const deleteAllPlans = asyncHandler(async (req, res) => {
  const result = await Plan.deleteMany({ userId: toObjectId(req.user._id) });
  return success(res, { deletedCount: result.deletedCount }, `Deleted ${result.deletedCount} plans`);
});

const exportPlans = asyncHandler(async (req, res) => {
  const items = await Plan.find({ userId: toObjectId(req.user._id) }).sort("-createdAt");
  return success(res, items, "Export ready");
});


/**
 * POST /api/plans/:id/returns
 *
 * Plans → Savings → Budget
 * - profit / dividend / deposit / sale → create Saving (Investment) + list on plan
 * - borrow → info only on plan (not a new entity); optional Expense for everyday spend
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

  const allowed = ["profit", "dividend", "sale", "deposit", "borrow", "other"];
  const k = allowed.includes(kind) ? kind : "profit";
  const cur = currency || plan.currency || "USD";
  const amountUSD = toUSD(Math.abs(amt), cur, req.user);
  const signedUSD = k === "borrow" ? -Math.abs(amountUSD) : Math.abs(amountUSD);
  const signedAmt = k === "borrow" ? -Math.abs(amt) : Math.abs(amt);
  const when = date ? new Date(date) : new Date();
  const parts = getDateParts(when);
  const userId = toObjectId(req.user._id);

  let linkedSavingId = null;
  let linkedExpenseId = null;

  try {
    if (k === "borrow") {
      // Borrow on saving — information on plan; optional Expense (everyday spend)
      if (createExpense === true || createExpense === "true") {
        const exp = await Expense.create({
          userId,
          amount: Math.abs(amt),
          currency: cur,
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
        linkedExpenseId = exp._id;
      }
      plan.totalBorrowedFromGainUSD =
        Math.round(
          ((Number(plan.totalBorrowedFromGainUSD) || 0) + Math.abs(amountUSD)) * 100
        ) / 100;
    } else {
      // Profit / deposit → Saving (Investment) linked to this plan
      const sav = await Saving.create({
        userId,
        amount: Math.abs(amt),
        currency: cur,
        amountUSD: Math.abs(amountUSD),
        category: "Investment",
        year: parts.year,
        monthNumber: parts.monthNumber,
        savingDate: when,
        noted:
          noted ||
          `${k} from plan: ${plan.title}`,
        planId: plan._id,
      });
      linkedSavingId = sav._id;

      // Budget: put profit into spending envelope (+)
      let budget = await Budget.findOne({
        userId,
        year: parts.year,
        monthNumber: parts.monthNumber,
      });
      if (!budget) {
        budget = await Budget.create({
          userId,
          year: parts.year,
          monthNumber: parts.monthNumber,
          month: "",
          currency: cur,
          plannedIncome: 0,
          plannedIncomeUSD: 0,
          savingsAmount: Math.abs(amt),
          savingsAmountUSD: Math.abs(amountUSD),
          remittanceAmount: 0,
          remittanceAmountUSD: 0,
          spendingAmount: 0,
          spendingAmountUSD: 0,
          noted: `Auto from plan profit: ${plan.title}`,
        });
      } else {
        budget.savingsAmountUSD =
          Math.round(
            ((Number(budget.savingsAmountUSD) || 0) + Math.abs(amountUSD)) * 100
          ) / 100;
        if (budget.currency === "USD") {
          budget.savingsAmount = budget.savingsAmountUSD;
        } else {
          budget.savingsAmount =
            (Number(budget.savingsAmount) || 0) + Math.abs(amt);
        }
        await budget.save();
      }

      // Deposits increase current funding toward target
      if (k === "deposit") {
        plan.currentFunding = (Number(plan.currentFunding) || 0) + Math.abs(amt);
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

  // totalGainUSD = sum of all return amountUSD (borrows are negative)
  plan.totalGainUSD = Math.round(
    (plan.investmentReturns || []).reduce(
      (s, r) => s + (Number(r.amountUSD) || 0),
      0
    ) * 100
  ) / 100;

  if (req.body.markCompleted === true || req.body.markCompleted === "true") {
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
  addInvestmentReturn,
};
