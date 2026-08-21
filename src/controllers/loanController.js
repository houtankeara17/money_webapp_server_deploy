const asyncHandler = require("express-async-handler");
const Loan = require("../models/Loan");
const Expense = require("../models/Expense");
const Saving = require("../models/Saving");
const Budget = require("../models/Budget");
const { toUSD, toObjectId, getDateParts } = require("../utils/currency");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");
const { enrichLoanInterest } = require("../utils/loanInterest");

const EXPENSE_PAYMENTS = [
  "Cash",
  "ABA Bank",
  "ACLEDA Bank",
  "Credit Card",
  "Wing",
  "Other",
];

const expensePaymentMethod = (method) =>
  EXPENSE_PAYMENTS.includes(method) ? method : "Other";

const parseLocalDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const truthy = (v) =>
  v === true ||
  v === "true" ||
  v === 1 ||
  v === "1" ||
  v === undefined ||
  v === null;

const recomputeStatus = (loan) => {
  if (loan.status === "Cancelled") return "Cancelled";
  const enriched = enrichLoanInterest(loan);
  const repaid = Number(loan.repaidAmountUSD) || 0;
  if (repaid <= 0) return "Active";
  if (repaid + 0.001 >= enriched.totalDueUSD) return "Paid";
  return "Partial";
};

/**
 * Adjust monthly Budget spending envelope.
 * deltaUSD > 0 → add money into budget (borrowed)
 * deltaUSD < 0 → take money out of budget (lent)
 */
const adjustBudgetSpending = async (
  userId,
  year,
  monthNumber,
  deltaUSD,
  note,
) => {
  let budget = await Budget.findOne({ userId, year, monthNumber });
  if (!budget) {
    // auto-create minimal budget row so loan can still affect "ថវិកា"
    budget = await Budget.create({
      userId,
      year,
      monthNumber,
      month: "",
      currency: "USD",
      plannedIncome: 0,
      plannedIncomeUSD: 0,
      savingsAmount: 0,
      savingsAmountUSD: 0,
      remittanceAmount: 0,
      remittanceAmountUSD: 0,
      spendingAmount: Math.max(0, deltaUSD),
      spendingAmountUSD: Math.max(0, deltaUSD),
      noted: note || "Auto from Loan",
    });
    return budget;
  }

  const nextUSD = Math.max(
    0,
    (Number(budget.spendingAmountUSD) || 0) + deltaUSD,
  );
  budget.spendingAmountUSD = Math.round(nextUSD * 100) / 100;
  // keep display amount in budget.currency roughly in sync if USD
  if (budget.currency === "USD") {
    budget.spendingAmount = budget.spendingAmountUSD;
  } else {
    budget.spendingAmount = Math.max(
      0,
      (Number(budget.spendingAmount) || 0) + deltaUSD,
    );
  }
  if (note) {
    budget.noted = [budget.noted, note]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 500);
  }
  await budget.save();
  return budget;
};

// GET /api/loans
const getLoans = asyncHandler(async (req, res) => {
  const { direction, status, page = 1, limit = 50 } = req.query;
  const query = { userId: toObjectId(req.user._id) };
  if (direction) query.direction = direction;
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Loan.countDocuments(query);
  const raw = await Loan.find(query)
    .sort("-loanDate")
    .skip(skip)
    .limit(Number(limit));
  const items = raw.map((doc) => enrichLoanInterest(doc));

  const allActive = await Loan.find({
    userId: toObjectId(req.user._id),
    status: { $ne: "Cancelled" },
  });

  const summary = {
    lent: {
      principalUSD: 0,
      repaidUSD: 0,
      outstandingUSD: 0,
      interestUSD: 0,
      count: 0,
    },
    borrowed: {
      principalUSD: 0,
      repaidUSD: 0,
      outstandingUSD: 0,
      interestUSD: 0,
      count: 0,
    },
  };

  allActive.forEach((doc) => {
    const e = enrichLoanInterest(doc);
    const bucket = summary[e.direction] || summary.lent;
    bucket.principalUSD += e.amountUSD || 0;
    bucket.repaidUSD += e.repaidAmountUSD || 0;
    bucket.outstandingUSD += e.outstandingUSD || 0;
    bucket.interestUSD += e.interestAccruedUSD || 0;
    bucket.count += 1;
  });

  Object.keys(summary).forEach((k) => {
    ["principalUSD", "repaidUSD", "outstandingUSD", "interestUSD"].forEach(
      (f) => {
        summary[k][f] = Math.round(summary[k][f] * 100) / 100;
      },
    );
  });

  return success(res, {
    items,
    summary,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
  });
});

// POST /api/loans
const createLoan = asyncHandler(async (req, res) => {
  const {
    direction = "lent",
    person,
    relation = "Friend",
    amount,
    currency = "USD",
    loanDate,
    dueDate,
    paymentMethod = "Cash",
    noted = "",
    trackCashFlow = true,
    interestRate = 0,
    interestType = "simple",
  } = req.body;

  if (!person || amount == null) {
    return error(res, msg(req, "loan.requiredFields"), 400);
  }
  if (!["lent", "borrowed"].includes(direction)) {
    return error(res, msg(req, "loan.invalidDirection"), 400);
  }

  const cur = currency || "USD";
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return error(res, msg(req, "loan.invalidAmount"), 400);
  }

  const amountUSD = toUSD(amt, cur, req.user);
  const date = parseLocalDate(loanDate);
  const parts = getDateParts(date);
  const expenseDateParts = {
    year: parts.year,
    monthNumber: parts.monthNumber,
    day: parts.day,
    dayOfWeek: parts.dayOfWeek,
  };
  const savingDateParts = {
    year: parts.year,
    monthNumber: parts.monthNumber,
  };
  const userId = toObjectId(req.user._id);
  const shouldTrack = truthy(trackCashFlow);

  const loan = await Loan.create({
    userId,
    direction,
    person: String(person).trim(),
    relation,
    amount: amt,
    currency: cur,
    amountUSD,
    repaidAmount: 0,
    repaidAmountUSD: 0,
    interestRate: Number(interestRate) || 0,
    interestType: interestType === "compound" ? "compound" : "simple",
    status: "Active",
    loanDate: date,
    dueDate: dueDate ? parseLocalDate(dueDate) : null,
    paymentMethod,
    noted: noted || "",
    trackCashFlow: !!shouldTrack,
    repayments: [],
  });

  if (shouldTrack) {
    try {
      if (direction === "lent") {
        /**
         * គេខ្ចី:
         * - ដកពី Budget
         * - បញ្ចូល Expense
         */
        const exp = await Expense.create({
          userId,
          amount: amt,
          currency: cur,
          amountUSD,
          category: "Loan",
          paymentMethod: expensePaymentMethod(paymentMethod),
          expenseDate: date,
          ...expenseDateParts,
          noted: noted || `Loan to ${person}`,
          images: [],
          loanId: loan._id,
        });
        loan.linkedExpenseId = exp._id;

        const budget = await adjustBudgetSpending(
          userId,
          parts.year,
          parts.monthNumber,
          -amountUSD,
          `Loan lent to ${person}`,
        );
        if (budget) loan.linkedBudgetId = budget._id;
      } else {
        /**
         * ខ្ចីគេ:
         * - ដាក់ចូល Budget (លុយចូល)
         * (loan entity holds the debt)
         */
        const budget = await adjustBudgetSpending(
          userId,
          parts.year,
          parts.monthNumber,
          +amountUSD,
          `Borrowed from ${person}`,
        );
        if (budget) loan.linkedBudgetId = budget._id;

        // Also record as Saving so "money in" is visible in savings list
        const sav = await Saving.create({
          userId,
          amount: amt,
          currency: cur,
          amountUSD,
          category: "LoanReturn",
          savingDate: date,
          ...savingDateParts,
          noted: noted || `Borrowed from ${person}`,
          loanId: loan._id,
        });
        loan.linkedSavingId = sav._id;
      }

      await loan.save({ validateBeforeSave: false });
    } catch (err) {
      console.error("[loan create cashflow]", err);
      return error(
        res,
        `Loan created but cash-flow failed: ${err.message}`,
        400,
      );
    }
  }

  return success(res, enrichLoanInterest(loan), msg(req, "loan.created"), 201);
});

// PUT /api/loans/:id
const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!loan) return error(res, msg(req, "loan.notFound"), 404);

  ["person", "relation", "paymentMethod", "noted", "status"].forEach((f) => {
    if (req.body[f] !== undefined) loan[f] = req.body[f];
  });
  if (req.body.dueDate !== undefined) {
    loan.dueDate = req.body.dueDate ? parseLocalDate(req.body.dueDate) : null;
  }
  if (req.body.interestRate !== undefined) {
    loan.interestRate = Number(req.body.interestRate) || 0;
  }
  if (req.body.interestType !== undefined) {
    loan.interestType =
      req.body.interestType === "compound" ? "compound" : "simple";
  }

  // Allow amount change only if no repayments yet
  if (req.body.amount !== undefined && (loan.repayments?.length || 0) === 0) {
    const oldUSD = Number(loan.amountUSD) || 0;
    loan.amount = Number(req.body.amount);
    if (req.body.currency) loan.currency = req.body.currency;
    loan.amountUSD = toUSD(loan.amount, loan.currency, req.user);
    const delta = loan.amountUSD - oldUSD;

    if (loan.linkedExpenseId) {
      await Expense.findOneAndUpdate(
        { _id: loan.linkedExpenseId, userId: loan.userId },
        {
          amount: loan.amount,
          currency: loan.currency,
          amountUSD: loan.amountUSD,
        },
      );
    }
    if (loan.linkedSavingId) {
      await Saving.findOneAndUpdate(
        { _id: loan.linkedSavingId, userId: loan.userId },
        {
          amount: loan.amount,
          currency: loan.currency,
          amountUSD: loan.amountUSD,
        },
      );
    }
    // Adjust budget by delta (lent was negative impact; borrowed positive)
    if (loan.trackCashFlow && delta !== 0) {
      const d = loan.loanDate || new Date();
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const signed = loan.direction === "lent" ? -delta : +delta;
      await adjustBudgetSpending(
        loan.userId,
        y,
        m,
        signed,
        "Loan amount adjusted",
      );
    }
  }

  loan.status = recomputeStatus(loan);
  const updated = await loan.save();
  return success(res, enrichLoanInterest(updated), msg(req, "loan.updated"));
});

// POST /api/loans/:id/repay
const addRepayment = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!loan) return error(res, msg(req, "loan.notFound"), 404);
  if (loan.status === "Cancelled" || loan.status === "Paid") {
    return error(res, msg(req, "loan.cannotRepay"), 400);
  }

  const { amount, currency, date, noted = "" } = req.body;
  const amt = Number(amount);
  if (!amount || Number.isNaN(amt) || amt <= 0) {
    return error(res, msg(req, "loan.invalidRepayAmount"), 400);
  }

  const cur = currency || loan.currency || "USD";
  const amountUSD = toUSD(amt, cur, req.user);
  const when = parseLocalDate(date);
  const parts = getDateParts(when);
  const expenseDateParts = {
    year: parts.year,
    monthNumber: parts.monthNumber,
    day: parts.day,
    dayOfWeek: parts.dayOfWeek,
  };
  const savingDateParts = {
    year: parts.year,
    monthNumber: parts.monthNumber,
  };
  const userId = toObjectId(req.user._id);

  let linkedSavingId = null;
  let linkedExpenseId = null;

  if (loan.trackCashFlow !== false) {
    try {
      if (loan.direction === "lent") {
        /**
         * គេសងវិញ → ដាក់ចូល Saving
         */
        const sav = await Saving.create({
          userId,
          amount: amt,
          currency: cur,
          amountUSD,
          category: "LoanReturn",
          savingDate: when,
          ...savingDateParts,
          noted: noted || `Repayment from ${loan.person}`,
          loanId: loan._id,
        });
        linkedSavingId = sav._id;

        // Optional: put repaid money back toward budget spending envelope
        await adjustBudgetSpending(
          userId,
          parts.year,
          parts.monthNumber,
          +amountUSD,
          `Loan repayment from ${loan.person}`,
        );
      } else {
        /**
         * អ្នកសងគេ → កត់ក្នុង loan entity + Expense (លុយចេញ)
         */
        const exp = await Expense.create({
          userId,
          amount: amt,
          currency: cur,
          amountUSD,
          category: "Loan",
          paymentMethod: expensePaymentMethod(loan.paymentMethod || "Cash"),
          expenseDate: when,
          ...expenseDateParts,
          noted: noted || `Repay loan to ${loan.person}`,
          images: [],
          loanId: loan._id,
        });
        linkedExpenseId = exp._id;

        await adjustBudgetSpending(
          userId,
          parts.year,
          parts.monthNumber,
          -amountUSD,
          `Repaid borrow to ${loan.person}`,
        );
      }
    } catch (err) {
      console.error("[loan repay cashflow]", err);
      return error(res, `Repayment cash-flow failed: ${err.message}`, 400);
    }
  }

  loan.repayments.push({
    amount: amt,
    currency: cur,
    amountUSD,
    date: when,
    noted: noted || "",
    linkedSavingId,
    linkedExpenseId,
  });
  loan.repaidAmount = (Number(loan.repaidAmount) || 0) + amt;
  loan.repaidAmountUSD = (Number(loan.repaidAmountUSD) || 0) + amountUSD;
  loan.status = recomputeStatus(loan);

  const updated = await loan.save();
  return success(res, enrichLoanInterest(updated), msg(req, "loan.repaid"));
});

const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndDelete({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!loan) return error(res, msg(req, "loan.notFound"), 404);
  return success(res, null, msg(req, "loan.deleted"));
});

const deleteAllLoans = asyncHandler(async (req, res) => {
  const result = await Loan.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deletedCount: result.deletedCount },
    msg(req, "loan.allDeleted"),
  );
});

// GET /api/loans/export
const exportLoans = asyncHandler(async (req, res) => {
  const query = { userId: toObjectId(req.user._id) };
  const items = await Loan.find(query).sort("-loanDate");
  return success(res, items, msg(req, "loan.exportReady"));
});

// POST /api/loans/import
const importLoans = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return error(res, msg(req, "loan.importNoItems"), 400);
  }

  const userId = toObjectId(req.user._id);
  const docsToInsert = [];

  for (const row of items) {
    const person = String(row.person ?? row.Person ?? "").trim();
    const amount = Number(row.amount ?? row.Amount);
    if (!person || !amount || isNaN(amount)) continue;

    const direction = String(
      row.direction ?? row.Direction ?? "lent",
    ).toLowerCase();
    const relation = row.relation ?? row.Relation ?? "Friend";
    const currency = String(
      row.currency ?? row.Currency ?? "USD",
    ).toUpperCase();
    const paymentMethod =
      row.paymentMethod ?? row.PaymentMethod ?? row["Payment Method"] ?? "Cash";
    const noted = row.noted ?? row.Noted ?? "";
    const interestRate = Number(
      row.interestRate ?? row.InterestRate ?? row["Interest Rate"] ?? 0,
    );
    const interestType =
      String(row.interestType ?? row.InterestType ?? "simple").toLowerCase() ===
      "compound"
        ? "compound"
        : "simple";

    const rawDate = row.loanDate ?? row.LoanDate ?? row["Loan Date"];
    let dateVal = rawDate ? new Date(rawDate) : new Date();
    if (isNaN(dateVal.getTime())) dateVal = new Date();

    const rawDueDate = row.dueDate ?? row.DueDate ?? row["Due Date"];
    let dueDateVal = rawDueDate ? new Date(rawDueDate) : null;
    if (dueDateVal && isNaN(dueDateVal.getTime())) dueDateVal = null;

    const amountUSD = toUSD(amount, currency, req.user);

    docsToInsert.push({
      userId,
      direction: ["lent", "borrowed"].includes(direction) ? direction : "lent",
      person,
      relation,
      amount,
      currency,
      amountUSD,
      repaidAmount: 0,
      repaidAmountUSD: 0,
      interestRate: isNaN(interestRate) ? 0 : interestRate,
      interestType,
      status: "Active",
      loanDate: dateVal,
      dueDate: dueDateVal,
      paymentMethod,
      noted,
      trackCashFlow: false,
      repayments: [],
    });
  }

  if (docsToInsert.length === 0) {
    return error(res, msg(req, "loan.importNoRowsFound"), 400);
  }

  const created = await Loan.insertMany(docsToInsert);
  return success(
    res,
    created,
    msg(req, "loan.importedSuccess", { count: created.length }),
    201,
  );
});

module.exports = {
  getLoans,
  createLoan,
  updateLoan,
  addRepayment,
  deleteLoan,
  deleteAllLoans,
  exportLoans,
  importLoans,
};
