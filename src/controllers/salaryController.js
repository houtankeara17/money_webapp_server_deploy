const asyncHandler = require("express-async-handler");
const Salary = require("../models/Salary");
const Bonus = require("../models/Bonus");
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

const getSalaries = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    year,
    monthNumber,
    status,
    paymentMethod,
    period = "yearly",
    sort = "-year,-monthNumber",
  } = req.query;

  const query = { userId: toObjectId(req.user._id) };

  if (period !== "all") {
    if (year) query.year = Number(year);
  }
  if (period === "monthly" && monthNumber) {
    query.monthNumber = Number(monthNumber);
  } else if (monthNumber && period !== "all") {
    query.monthNumber = Number(monthNumber);
  }

  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Salary.countDocuments(query);
  const items = await Salary.find(query)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const totals = await Salary.aggregate([
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

  const yearsAgg = await Salary.aggregate([
    { $match: { userId: toObjectId(req.user._id) } },
    { $group: { _id: "$year" } },
    { $sort: { _id: -1 } },
  ]);
  const availableYears = yearsAgg.map((y) => y._id);

  const yearQuery = { userId: toObjectId(req.user._id) };
  if (period !== "all" && year) yearQuery.year = Number(year);
  if (period === "monthly" && monthNumber)
    yearQuery.monthNumber = Number(monthNumber);

  const yearSummary = await Salary.aggregate([
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
  });
});

const createSalary = asyncHandler(async (req, res) => {
  const {
    amount,
    currency,
    year,
    monthNumber,
    status,
    paymentMethod,
    noted,
    images,
    image,
  } = req.body;

  if (!amount || !currency || !year || !monthNumber) {
    return error(res, msg(req, "salary.validationRequired"), 400);
  }

  const mn = Number(monthNumber);
  if (mn < 1 || mn > 12) {
    return error(res, msg(req, "salary.invalidMonth"), 400);
  }

  const amountUSD = toUSD(amount, currency, req.user);

  let imageList = [];
  if (Array.isArray(images)) {
    imageList = images.filter(Boolean);
  } else if (image) {
    imageList = [image];
  }

  const salary = await Salary.create({
    userId: toObjectId(req.user._id),
    amount: Number(amount),
    currency,
    amountUSD,
    originalAmount: Number(amount),
    year: Number(year),
    month: MONTH_NAMES[mn - 1],
    monthNumber: mn,
    status: status || "Confirmed",
    paymentMethod: paymentMethod || "ABA Bank",
    noted: noted || "",
    images: imageList,
  });

  return success(res, salary, msg(req, "salary.created"), 201);
});

const updateSalary = asyncHandler(async (req, res) => {
  const salary = await Salary.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!salary) {
    return error(res, msg(req, "salary.notFound"), 404);
  }

  const fields = [
    "amount",
    "currency",
    "year",
    "monthNumber",
    "status",
    "paymentMethod",
    "noted",
  ];

  fields.forEach((f) => {
    if (req.body[f] !== undefined) salary[f] = req.body[f];
  });

  if (req.body.images !== undefined) {
    salary.images = Array.isArray(req.body.images)
      ? req.body.images.filter(Boolean)
      : [];
  } else if (req.body.image !== undefined) {
    salary.images = req.body.image ? [req.body.image] : [];
  }

  if (req.body.monthNumber) {
    salary.month = MONTH_NAMES[Number(req.body.monthNumber) - 1];
  }
  if (req.body.amount !== undefined || req.body.currency) {
    salary.amountUSD = toUSD(salary.amount, salary.currency, req.user);
  }

  const updated = await salary.save();
  return success(res, updated, msg(req, "salary.updated"));
});

const deleteSalary = asyncHandler(async (req, res) => {
  const salary = await Salary.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!salary) {
    return error(res, msg(req, "salary.notFound"), 404);
  }
  return success(res, null, msg(req, "salary.deleted"));
});

const deleteAllSalaries = asyncHandler(async (req, res) => {
  const result = await Salary.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "salary.allDeleted"),
  );
});

const getSalaryBonusHistory = asyncHandler(async (req, res) => {
  const { year, monthNumber, page = 1, limit = 50 } = req.query;
  const query = { userId: toObjectId(req.user._id) };
  if (year) query.year = Number(year);
  if (monthNumber) query.monthNumber = Number(monthNumber);

  const skip = (Number(page) - 1) * Number(limit);
  const total = await SalaryBonusHistory.countDocuments(query);
  const items = await SalaryBonusHistory.find(query)
    .sort("-createdAt")
    .skip(skip)
    .limit(Number(limit))
    .populate("bonusId", "amount tag status currency")
    .populate("salaryId", "amount originalAmount currency status");

  let snapshot = null;
  if (year && monthNumber) {
    const salary = await Salary.findOne({
      userId: toObjectId(req.user._id),
      year: Number(year),
      monthNumber: Number(monthNumber),
    });
    const bonuses = await Bonus.find({
      userId: toObjectId(req.user._id),
      year: Number(year),
      monthNumber: Number(monthNumber),
    }).sort("-createdAt");
    const bonusTotal = bonuses.reduce((s, b) => s + Number(b.amount || 0), 0);
    snapshot = {
      salary: salary
        ? {
            _id: salary._id,
            amount: salary.amount,
            originalAmount: salary.originalAmount ?? salary.amount,
            currency: salary.currency,
            amountUSD: salary.amountUSD,
            status: salary.status,
          }
        : null,
      bonuses,
      bonusTotal,
      remaining: salary != null ? Number(salary.amount) : null,
    };
  }

  return success(res, {
    items,
    snapshot,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
  });
});

const exportSalaries = asyncHandler(async (req, res) => {
  const items = await Salary.find({ userId: toObjectId(req.user._id) }).sort(
    "-year,-monthNumber",
  );

  const headers = [
    "Year",
    "MonthNumber",
    "Amount",
    "Currency",
    "Status",
    "PaymentMethod",
    "Noted",
  ];
  const rows = items.map((i) => [
    i.year,
    i.monthNumber,
    i.amount,
    i.currency,
    i.status,
    `"${(i.paymentMethod || "").replace(/"/g, '""')}"`,
    `"${(i.noted || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n",
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=salaries-${Date.now()}.csv`,
  );
  return res.status(200).send(csvContent);
});

const importSalaries = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "salary.importNoItems"), 400);
  }

  const userId = toObjectId(req.user._id);
  const docsToInsert = [];

  for (const row of items) {
    const amount = Number(row.amount ?? row.Amount);
    const currency = String(
      row.currency ?? row.Currency ?? "USD",
    ).toUpperCase();
    const year = Number(row.year ?? row.Year);
    const monthNumber = Number(row.monthNumber ?? row.MonthNumber);

    if (
      !amount ||
      isNaN(amount) ||
      !year ||
      isNaN(year) ||
      !monthNumber ||
      isNaN(monthNumber)
    ) {
      continue;
    }

    const amountUSD = toUSD(amount, currency, req.user);

    docsToInsert.push({
      userId,
      amount,
      currency,
      amountUSD,
      originalAmount: amount,
      year,
      month: MONTH_NAMES[monthNumber - 1] || "January",
      monthNumber,
      status: row.status ?? row.Status ?? "Confirmed",
      paymentMethod: row.paymentMethod ?? row.PaymentMethod ?? "ABA Bank",
      noted: row.noted ?? row.Noted ?? "",
      image: "",
    });
  }

  if (docsToInsert.length === 0) {
    return error(res, msg(req, "salary.importNoRowsFound"), 400);
  }

  const created = await Salary.insertMany(docsToInsert);
  return success(
    res,
    { count: created.length },
    `${created.length} ${msg(req, "salary.importedSuccess")}`,
    201,
  );
});

module.exports = {
  getSalaries,
  getSalaryBonusHistory,
  createSalary,
  updateSalary,
  deleteSalary,
  deleteAllSalaries,
  exportSalaries,
  importSalaries,
};
