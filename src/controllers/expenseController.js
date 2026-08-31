const asyncHandler = require("express-async-handler");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const { toUSD, getDateParts, toObjectId } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Adjust monthly Budget spending envelope.
 * deltaUSD < 0 → spend (expense created)
 * deltaUSD > 0 → refund (expense deleted)
 *
 * spendingAmount = remaining money in spend envelope
 * Example: budget 20$, expense 5$ → spending becomes 15$
 */
const adjustBudgetSpending = async (userId, year, monthNumber, deltaUSD, deltaOriginal, currency, note) => {
  if (!year || !monthNumber || !deltaUSD) return null;

  let budget = await Budget.findOne({ userId, year, monthNumber });
  if (!budget) {
    // No budget for this month — nothing to adjust
    return null;
  }

  const nextUSD = Math.max(0, round2((Number(budget.spendingAmountUSD) || 0) + deltaUSD));
  budget.spendingAmountUSD = nextUSD;

  if (budget.currency === "USD" || currency === "USD") {
    budget.spendingAmount = nextUSD;
  } else {
    // Adjust display amount in budget's own currency roughly by original delta
    budget.spendingAmount = Math.max(
      0,
      round2((Number(budget.spendingAmount) || 0) + (deltaOriginal || deltaUSD))
    );
  }

  if (note) {
    const tag = `[auto] ${note}`;
    if (!(budget.noted || "").includes(tag.slice(0, 40))) {
      budget.noted = [budget.noted, tag].filter(Boolean).join(" | ").slice(0, 500);
    }
  }

  await budget.save();
  return budget;
};

const debitBudgetForExpense = async (userId, expense) => {
  const y = expense.year;
  const m = expense.monthNumber;
  const usd = Number(expense.amountUSD) || 0;
  const amt = Number(expense.amount) || 0;
  return adjustBudgetSpending(
    userId,
    y,
    m,
    -usd,
    -amt,
    expense.currency,
    `expense -${usd} USD`
  );
};

const creditBudgetForExpense = async (userId, expense) => {
  const y = expense.year;
  const m = expense.monthNumber;
  const usd = Number(expense.amountUSD) || 0;
  const amt = Number(expense.amount) || 0;
  return adjustBudgetSpending(
    userId,
    y,
    m,
    +usd,
    +amt,
    expense.currency,
    `expense refund +${usd} USD`
  );
};

// GET /api/expenses
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
      pages: Math.ceil(total / Number(limit)) || 1,
    },
    totals,
  });
});

// POST /api/expenses
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
    return error(res, msg(req, "expense.requiredFields") || "Required fields missing", 400);
  }

  const date = expenseDate ? new Date(expenseDate) : new Date();
  const parts = getDateParts(date);
  const amountUSD = toUSD(amount, currency, req.user);
  const userId = toObjectId(req.user._id);

  const expense = await Expense.create({
    userId,
    amount: Number(amount),
    currency,
    amountUSD,
    category,
    paymentMethod,
    expenseDate: date,
    ...parts,
    noted: noted || "",
    images: images || [],
  });

  // Budget spending − expense amount
  try {
    await debitBudgetForExpense(userId, expense);
  } catch (err) {
    console.error("[expense→budget debit]", err.message);
  }

  return success(res, expense, msg(req, "expense.created"), 201);
});

// PUT /api/expenses/:id
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!expense) {
    return error(res, msg(req, "expense.notFound") || "Expense not found", 404);
  }

  const userId = toObjectId(req.user._id);
  // Snapshot before change (for budget reverse)
  const oldSnapshot = {
    year: expense.year,
    monthNumber: expense.monthNumber,
    amount: expense.amount,
    amountUSD: expense.amountUSD,
    currency: expense.currency,
  };

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

  if (req.body.amount !== undefined || req.body.currency) {
    expense.amountUSD = toUSD(expense.amount, expense.currency, req.user);
  }
  if (req.body.expenseDate) {
    Object.assign(expense, getDateParts(new Date(req.body.expenseDate)));
  }

  const updated = await expense.save();

  // Refund old amount to old month budget, then debit new amount on new month
  try {
    await creditBudgetForExpense(userId, oldSnapshot);
    await debitBudgetForExpense(userId, updated);
  } catch (err) {
    console.error("[expense→budget update]", err.message);
  }

  return success(res, updated, msg(req, "expense.updated"));
});

// DELETE /api/expenses/:id
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!expense) {
    return error(res, msg(req, "expense.notFound") || "Expense not found", 404);
  }

  // Return money to budget spending envelope
  try {
    await creditBudgetForExpense(toObjectId(req.user._id), expense);
  } catch (err) {
    console.error("[expense→budget credit]", err.message);
  }

  return success(res, null, msg(req, "expense.deleted"));
});

// DELETE /api/expenses
const deleteAllExpenses = asyncHandler(async (req, res) => {
  const userId = toObjectId(req.user._id);

  // Group by month and refund each budget before deleting
  const byMonth = await Expense.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: { year: "$year", monthNumber: "$monthNumber" },
        totalUSD: { $sum: "$amountUSD" },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  for (const row of byMonth) {
    try {
      await adjustBudgetSpending(
        userId,
        row._id.year,
        row._id.monthNumber,
        Number(row.totalUSD) || 0,
        Number(row.totalAmount) || 0,
        "USD",
        "refund all expenses"
      );
    } catch (err) {
      console.error("[expense deleteAll budget]", err.message);
    }
  }

  const result = await Expense.deleteMany({ userId });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "expense.allDeleted")
  );
});

// GET /api/expenses/export
const exportExpenses = asyncHandler(async (req, res) => {
  const items = await Expense.find({ userId: toObjectId(req.user._id) }).sort(
    "-expenseDate"
  );
  return success(res, items, msg(req, "expense.exportReady"));
});

// POST /api/expenses/import
const importExpenses = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "expense.importNoData") || "No data", 400);
  }

  const userId = toObjectId(req.user._id);
  const createdExpenses = [];

  for (const row of items) {
    const amount = Number(row.Amount ?? row.amount);
    const currency = row.Currency || row.currency || "USD";
    const category = row.Category || row.category || "Other";
    const paymentMethod =
      row.PaymentMethod || row.paymentMethod || row["Payment Method"] || "Cash";
    const rawDate = row.ExpenseDate || row.expenseDate || row.Date || row.date;
    const noted = row.Noted || row.noted || row.Note || row.note || "";

    if (!amount || isNaN(amount) || amount <= 0) continue;

    const date = rawDate ? new Date(rawDate) : new Date();
    const parts = getDateParts(date);
    const amountUSD = toUSD(amount, currency, req.user);

    const expense = await Expense.create({
      userId,
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

    try {
      await debitBudgetForExpense(userId, expense);
    } catch (_) {}

    createdExpenses.push(expense);
  }

  return success(
    res,
    { count: createdExpenses.length },
    msg(req, "expense.importedSuccess", { count: createdExpenses.length }) ||
      `Imported ${createdExpenses.length} expenses`
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
