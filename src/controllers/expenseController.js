const asyncHandler = require("express-async-handler");
const Expense = require("../models/Expense");
const { toUSD, getDateParts, toObjectId } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

// @desc    Get all expenses (with filters + pagination)
// @route   GET /api/expenses
const getExpenses = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    year,
    monthNumber,
    category,
    paymentMethod,
    search,
    sort = "-expenseDate",
    from,
    to,
  } = req.query;

  const query = { userId: toObjectId(req.user._id) };

  if (year) query.year = Number(year);
  if (monthNumber) query.monthNumber = Number(monthNumber);
  if (category) query.category = category;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (search) {
    query.$or = [
      { noted: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { paymentMethod: { $regex: search, $options: "i" } },
    ];
  }
  if (from || to) {
    query.expenseDate = {};
    if (from) query.expenseDate.$gte = new Date(from);
    if (to) query.expenseDate.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Expense.countDocuments(query);
  const items = await Expense.find(query)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  // Totals by currency
  const totals = await Expense.aggregate([
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

  return success(res, {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
    totals,
  });
});

// @desc    Create expense
// @route   POST /api/expenses
const createExpense = asyncHandler(async (req, res) => {
  const {
    amount,
    currency,
    category,
    paymentMethod,
    expenseDate,
    noted,
    images,
  } = req.body;

  if (!amount || !currency || !category || !paymentMethod) {
    return error(res, msg(req, "expense.requiredFields"), 400);
  }

  const date = expenseDate ? new Date(expenseDate) : new Date();
  const parts = getDateParts(date);
  const amountUSD = toUSD(amount, currency, req.user);

  const expense = await Expense.create({
    userId: toObjectId(req.user._id),
    amount,
    currency,
    amountUSD,
    category,
    paymentMethod,
    expenseDate: date,
    ...parts,
    noted: noted || "",
    images: images || [],
  });

  return success(res, expense, msg(req, "expense.created"), 201);
});

// @desc    Update expense
// @route   PUT /api/expenses/:id
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!expense) {
    return error(res, msg(req, "expense.notFound"), 404);
  }

  const fields = [
    "amount",
    "currency",
    "category",
    "paymentMethod",
    "expenseDate",
    "noted",
    "images",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) expense[f] = req.body[f];
  });

  if (req.body.amount || req.body.currency) {
    expense.amountUSD = toUSD(expense.amount, expense.currency, req.user);
  }
  if (req.body.expenseDate) {
    Object.assign(expense, getDateParts(new Date(req.body.expenseDate)));
  }

  const updated = await expense.save();
  return success(res, updated, msg(req, "expense.updated"));
});

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!expense) {
    return error(res, msg(req, "expense.notFound"), 404);
  }

  return success(res, null, msg(req, "expense.deleted"));
});

// @desc    Delete all expenses
// @route   DELETE /api/expenses
const deleteAllExpenses = asyncHandler(async (req, res) => {
  const result = await Expense.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "expense.allDeleted"),
  );
});

// GET /api/expenses/export
const exportExpenses = asyncHandler(async (req, res) => {
  const items = await Expense.find({ userId: toObjectId(req.user._id) }).sort(
    "-expenseDate",
  );

  return success(res, items, msg(req, "expense.exportReady"));
});

// @desc    Import expenses from Excel JSON payload
// @route   POST /api/expenses/import
const importExpenses = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "expense.importNoData"), 400);
  }

  const createdExpenses = [];

  for (const row of items) {
    const amount = Number(row.Amount ?? row.amount);
    const currency = row.Currency || row.currency || "USD";
    const category = row.Category || row.category || "Other";
    const paymentMethod =
      row.PaymentMethod || row.paymentMethod || row["Payment Method"] || "Cash";
    const rawDate = row.ExpenseDate || row.expenseDate || row.Date || row.date;
    const noted = row.Noted || row.noted || row.Note || row.note || "";

    if (!amount || isNaN(amount) || amount <= 0) {
      continue;
    }

    const date = rawDate ? new Date(rawDate) : new Date();
    const parts = getDateParts(date);
    const amountUSD = toUSD(amount, currency, req.user);

    const expense = await Expense.create({
      userId: toObjectId(req.user._id),
      amount,
      currency,
      amountUSD,
      category,
      paymentMethod,
      expenseDate: date,
      ...parts,
      noted,
      images: [],
    });

    createdExpenses.push(expense);
  }

  return success(
    res,
    { count: createdExpenses.length },
    msg(req, "expense.importedSuccess", { count: createdExpenses.length }),
  );
});

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  deleteAllExpenses,
  exportExpenses,
  importExpenses,
};
