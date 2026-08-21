const asyncHandler = require("express-async-handler");
const Bonus = require("../models/Bonus");
const Salary = require("../models/Salary");
const SalaryBonusHistory = require("../models/SalaryBonusHistory");
const { toUSD, toObjectId } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const BONUS_TAGS = [
  "Performance",
  "Annual",
  "Holiday",
  "Project",
  "Referral",
  "Other",
];

/** Subtract bonus from same-month salary (user request: salary remaining after bonus) */
async function adjustSalaryForBonus(
  userId,
  year,
  monthNumber,
  deltaAmount,
  currency,
  user,
  meta = {},
) {
  const salary = await Salary.findOne({
    userId: toObjectId(userId),
    year: Number(year),
    monthNumber: Number(monthNumber),
  });
  if (!salary) return null;

  // Remember base salary once
  if (salary.originalAmount == null) {
    salary.originalAmount = Number(salary.amount);
  }

  const before = Number(salary.amount);
  const delta = Number(deltaAmount) || 0;
  salary.amount = Math.max(0, before + delta);
  salary.amountUSD = toUSD(
    salary.amount,
    salary.currency || currency || "USD",
    user,
  );
  await salary.save();

  try {
    await SalaryBonusHistory.create({
      userId: toObjectId(userId),
      year: Number(year),
      monthNumber: Number(monthNumber),
      month: salary.month || "",
      salaryId: salary._id,
      bonusId: meta.bonusId || null,
      action: meta.action || "bonus_updated",
      currency: salary.currency || currency || "USD",
      salaryBefore: before,
      salaryAfter: Number(salary.amount),
      bonusAmount:
        meta.bonusAmount != null ? Number(meta.bonusAmount) : Math.abs(delta),
      delta,
      noted: meta.noted || "",
    });
  } catch (err) {
    console.error("SalaryBonusHistory log failed:", err.message);
  }

  return salary;
}

// GET /api/bonuses
const getBonuses = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    year,
    monthNumber,
    tag,
    status,
    sort = "-year,-monthNumber",
  } = req.query;

  const query = { userId: toObjectId(req.user._id) };
  if (year) query.year = Number(year);
  if (monthNumber) query.monthNumber = Number(monthNumber);
  if (tag) query.tag = tag;
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Bonus.countDocuments(query);
  const items = await Bonus.find(query)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const totals = await Bonus.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$currency",
        total: { $sum: "$amount" },
        totalUSD: { $sum: "$amountUSD" },
        count: { $sum: 1 },
      },
    },
  ]);

  const yearsAgg = await Bonus.aggregate([
    { $match: { userId: toObjectId(req.user._id) } },
    { $group: { _id: "$year" } },
    { $sort: { _id: -1 } },
  ]);
  const availableYears = yearsAgg.map((y) => y._id);

  const yearQuery = { userId: toObjectId(req.user._id) };
  if (year) yearQuery.year = Number(year);
  const yearSummary = await Bonus.aggregate([
    { $match: yearQuery },
    {
      $group: {
        _id: null,
        totalUSD: { $sum: "$amountUSD" },
        confirmedUSD: {
          $sum: {
            $cond: [
              { $in: ["$status", ["Confirmed", "Disbursed"]] },
              "$amountUSD",
              0,
            ],
          },
        },
        count: { $sum: 1 },
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
    totals,
    availableYears,
    yearSummary: yearSummary[0] || { totalUSD: 0, confirmedUSD: 0, count: 0 },
    tags: BONUS_TAGS,
  });
});

// POST /api/bonuses
const createBonus = asyncHandler(async (req, res) => {
  const {
    amount,
    currency,
    year,
    monthNumber,
    tag,
    status,
    noted,
    image,
    paymentMethod,
  } = req.body;

  if (!amount || !currency || !year || !monthNumber || !tag) {
    return error(res, msg(req, "bonus.requiredFields"), 400);
  }

  const mn = Number(monthNumber);
  if (mn < 1 || mn > 12) {
    return error(res, msg(req, "bonus.invalidMonth"), 400);
  }

  const amountUSD = toUSD(amount, currency, req.user);

  const bonus = await Bonus.create({
    userId: toObjectId(req.user._id),
    amount: Number(amount),
    currency,
    amountUSD,
    year: Number(year),
    month: MONTH_NAMES[mn - 1],
    monthNumber: mn,
    tag,
    status: status || "Confirmed",
    paymentMethod: paymentMethod || "ABA Bank",
    noted: noted || "",
    image: image || "",
  });

  // Reduce linked salary by this bonus amount
  const linked = await adjustSalaryForBonus(
    req.user._id,
    bonus.year,
    bonus.monthNumber,
    -Number(bonus.amount),
    bonus.currency,
    req.user,
    {
      action: "bonus_created",
      bonusId: bonus._id,
      bonusAmount: Number(bonus.amount),
      noted: bonus.tag || "",
    },
  );

  return success(
    res,
    { ...bonus.toObject(), linkedSalary: linked },
    linked
      ? msg(req, "bonus.createdLinked")
      : msg(req, "bonus.createdNoSalary"),
    201,
  );
});

// PUT /api/bonuses/:id
const updateBonus = asyncHandler(async (req, res) => {
  const bonus = await Bonus.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!bonus) {
    return error(res, msg(req, "bonus.notFound"), 404);
  }

  const prevAmount = Number(bonus.amount);
  const prevYear = bonus.year;
  const prevMonth = bonus.monthNumber;

  const fields = [
    "amount",
    "currency",
    "year",
    "monthNumber",
    "tag",
    "status",
    "noted",
    "image",
    "paymentMethod",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) bonus[f] = req.body[f];
  });

  if (req.body.amount !== undefined) bonus.amount = Number(req.body.amount);
  if (req.body.year !== undefined) bonus.year = Number(req.body.year);
  if (req.body.monthNumber !== undefined) {
    bonus.monthNumber = Number(req.body.monthNumber);
    bonus.month = MONTH_NAMES[bonus.monthNumber - 1];
  }
  if (req.body.amount !== undefined || req.body.currency) {
    bonus.amountUSD = toUSD(bonus.amount, bonus.currency, req.user);
  }

  const updated = await bonus.save();

  // Restore previous month salary, then apply new bonus deduction
  if (prevYear !== updated.year || prevMonth !== updated.monthNumber) {
    await adjustSalaryForBonus(
      req.user._id,
      prevYear,
      prevMonth,
      prevAmount,
      updated.currency,
      req.user,
      {
        action: "bonus_updated",
        bonusId: updated._id,
        bonusAmount: prevAmount,
        noted: "moved from previous month",
      },
    );
    await adjustSalaryForBonus(
      req.user._id,
      updated.year,
      updated.monthNumber,
      -Number(updated.amount),
      updated.currency,
      req.user,
      {
        action: "bonus_updated",
        bonusId: updated._id,
        bonusAmount: Number(updated.amount),
      },
    );
  } else {
    const delta = prevAmount - Number(updated.amount); // if bonus increased, salary decreases more
    await adjustSalaryForBonus(
      req.user._id,
      updated.year,
      updated.monthNumber,
      delta,
      updated.currency,
      req.user,
      {
        action: "bonus_updated",
        bonusId: updated._id,
        bonusAmount: Number(updated.amount),
      },
    );
  }

  return success(res, updated, msg(req, "bonus.updated"));
});

// DELETE /api/bonuses/:id
const deleteBonus = asyncHandler(async (req, res) => {
  const bonus = await Bonus.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!bonus) {
    return error(res, msg(req, "bonus.notFound"), 404);
  }
  // Restore amount to linked salary
  await adjustSalaryForBonus(
    req.user._id,
    bonus.year,
    bonus.monthNumber,
    Number(bonus.amount),
    bonus.currency,
    req.user,
    {
      action: "bonus_deleted",
      bonusId: bonus._id,
      bonusAmount: Number(bonus.amount),
    },
  );
  return success(res, bonus, msg(req, "bonus.deleted"));
});

// DELETE /api/bonuses
const deleteAllBonuses = asyncHandler(async (req, res) => {
  const result = await Bonus.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "bonus.allDeleted"),
  );
});

// GET /api/bonuses/export
const exportBonuses = asyncHandler(async (req, res) => {
  const items = await Bonus.find({ userId: toObjectId(req.user._id) }).sort(
    "-year,-monthNumber",
  );
  return success(res, items, msg(req, "bonus.exportReady"));
});

// POST /api/bonuses/import
const importBonuses = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "bonus.importNoData"), 400);
  }

  const createdBonuses = [];

  for (const row of items) {
    // Flexibly read headers regardless of case or formatting
    const amount = Number(row.Amount ?? row.amount);
    const currency = row.Currency || row.currency || "USD";
    const year = Number(row.Year ?? row.year);
    const mn = Number(
      row.Month ?? row.monthNumber ?? row.month ?? row["Month Number"],
    );
    const tag = row.Tag || row.tag || "Performance";
    const status = row.Status || row.status || "Confirmed";
    const paymentMethod =
      row.PaymentMethod ||
      row.paymentMethod ||
      row["Payment Method"] ||
      "ABA Bank";
    const noted = row.Noted || row.noted || row.Note || row.note || "";

    // Validate essential fields before saving
    if (!amount || isNaN(amount) || !year || isNaN(year) || !mn || isNaN(mn)) {
      continue;
    }

    const amountUSD = toUSD(amount, currency, req.user);

    const bonus = await Bonus.create({
      userId: toObjectId(req.user._id),
      amount,
      currency,
      amountUSD,
      year,
      month: MONTH_NAMES[mn - 1] || "January",
      monthNumber: mn,
      tag,
      status,
      paymentMethod,
      noted,
    });

    // Deduct salary automatically for imported bonus
    await adjustSalaryForBonus(
      req.user._id,
      bonus.year,
      bonus.monthNumber,
      -Number(bonus.amount),
      bonus.currency,
      req.user,
      {
        action: "bonus_created",
        bonusId: bonus._id,
        bonusAmount: Number(bonus.amount),
        noted: bonus.tag,
      },
    );

    createdBonuses.push(bonus);
  }

  return success(
    res,
    { count: createdBonuses.length },
    msg(req, "bonus.importedSuccess", { count: createdBonuses.length }),
  );
});

module.exports = {
  getBonuses,
  createBonus,
  updateBonus,
  deleteBonus,
  deleteAllBonuses,
  exportBonuses,
  importBonuses,
};
