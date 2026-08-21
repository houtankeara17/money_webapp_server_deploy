const asyncHandler = require("express-async-handler");
const Expense = require("../models/Expense");
const Salary = require("../models/Salary");
const Bonus = require("../models/Bonus");
const Saving = require("../models/Saving");
const Remittance = require("../models/Remittance");
const Plan = require("../models/Plan");
const Note = require("../models/Note");
const ExchangeLog = require("../models/ExchangeLog");
const { success } = require("../utils/response");
const { toObjectId } = require("../utils/currency");

const getSummary = asyncHandler(async (req, res) => {
  const userId = toObjectId(req.user._id);
  const now = new Date();

  const isAllTime = req.query.allTime === "true";
  const year = isAllTime ? null : Number(req.query.year) || now.getFullYear();
  const isAllYear = !req.query.monthNumber || req.query.monthNumber === "all";
  const month = isAllTime || isAllYear ? null : Number(req.query.monthNumber);

  // Build dynamic match filter
  const matchFilter = { userId };
  if (!isAllTime) {
    if (year) matchFilter.year = year;
    if (month) matchFilter.monthNumber = month;
  }

  const [
    expenseTotal,
    salaryTotal,
    bonusTotal,
    savingTotal,
    remittanceTotal,
    planCount,
    noteCount,
    exchangeCount,
  ] = await Promise.all([
    Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalUSD: { $sum: "$amountUSD" },
          count: { $sum: 1 },
        },
      },
    ]),
    Salary.aggregate([
      {
        $match: {
          ...matchFilter,
          status: { $in: ["Confirmed", "Disbursed"] },
        },
      },
      { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
    ]),
    Bonus.aggregate([
      {
        $match: {
          ...matchFilter,
          status: { $in: ["Confirmed", "Disbursed"] },
        },
      },
      { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
    ]),
    Saving.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
    ]),
    Remittance.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
    ]),
    Plan.countDocuments({ userId, status: { $ne: "Accomplished" } }),
    Note.countDocuments({ userId }),
    ExchangeLog.countDocuments(matchFilter),
  ]);

  return success(res, {
    month: month || "all",
    year: year || "all",
    expenses: {
      totalUSD: expenseTotal[0]?.totalUSD || 0,
      count: expenseTotal[0]?.count || 0,
    },
    salary: { totalUSD: salaryTotal[0]?.totalUSD || 0 },
    bonus: { totalUSD: bonusTotal[0]?.totalUSD || 0 },
    savings: { totalUSD: savingTotal[0]?.totalUSD || 0 },
    remittances: { totalUSD: remittanceTotal[0]?.totalUSD || 0 },
    activePlans: planCount,
    notes: noteCount,
    exchangesThisMonth: exchangeCount,
  });
});

const getCharts = asyncHandler(async (req, res) => {
  const userId = toObjectId(req.user._id);

  // 1. Safely parse query parameters without breaking previous defaults
  const isAllTime = req.query.allTime === "true" || req.query.year === "all";
  const yearQuery = req.query.year ? Number(req.query.year) : null;
  const monthNumber = req.query.monthNumber
    ? Number(req.query.monthNumber)
    : null;

  // Default to current year if no mode/year is provided (keeps Dashboard working exactly as before)
  const targetYear = isAllTime ? null : yearQuery || new Date().getFullYear();

  // 2. Build the filter match query dynamically
  const matchYear = { userId };
  if (!isAllTime && targetYear) {
    matchYear.year = targetYear;
  }
  if (monthNumber) {
    matchYear.monthNumber = monthNumber;
  }

  const [expenseData, salaryData, bonusData, savingData, remittanceData] =
    await Promise.all([
      Expense.aggregate([
        { $match: matchYear },
        {
          $facet: {
            byMonth: [
              {
                $group: {
                  _id: "$monthNumber",
                  totalUSD: { $sum: "$amountUSD" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            byCategory: [
              {
                $group: {
                  _id: "$category",
                  totalUSD: { $sum: "$amountUSD" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { totalUSD: -1 } },
            ],
            yearTotal: [
              {
                $group: {
                  _id: null,
                  totalUSD: { $sum: "$amountUSD" },
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),
      Salary.aggregate([
        {
          $match: { ...matchYear, status: { $in: ["Confirmed", "Disbursed"] } },
        },
        {
          $facet: {
            byMonth: [
              {
                $group: {
                  _id: "$monthNumber",
                  totalUSD: { $sum: "$amountUSD" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            yearTotal: [
              { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
            ],
          },
        },
      ]),
      Bonus.aggregate([
        {
          $match: { ...matchYear, status: { $in: ["Confirmed", "Disbursed"] } },
        },
        {
          $facet: {
            byMonth: [
              {
                $group: {
                  _id: "$monthNumber",
                  totalUSD: { $sum: "$amountUSD" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            yearTotal: [
              { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
            ],
          },
        },
      ]),
      Saving.aggregate([
        { $match: matchYear },
        {
          $facet: {
            byMonth: [
              {
                $group: {
                  _id: "$monthNumber",
                  totalUSD: { $sum: "$amountUSD" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            yearTotal: [
              { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
            ],
          },
        },
      ]),
      Remittance.aggregate([
        { $match: matchYear },
        {
          $facet: {
            byMonth: [
              {
                $group: {
                  _id: "$monthNumber",
                  totalUSD: { $sum: "$amountUSD" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            yearTotal: [
              { $group: { _id: null, totalUSD: { $sum: "$amountUSD" } } },
            ],
          },
        },
      ]),
    ]);

  const yearsFrom = await Promise.all([
    Expense.distinct("year", { userId }),
    Salary.distinct("year", { userId }),
    Bonus.distinct("year", { userId }),
  ]);

  const currentYear = new Date().getFullYear();
  const availableYears = [
    ...new Set([
      ...yearsFrom[0],
      ...yearsFrom[1],
      ...yearsFrom[2],
      currentYear,
    ]),
  ].sort((a, b) => b - a);

  const expensesByMonth = expenseData[0]?.byMonth || [];
  const expensesByCategory = expenseData[0]?.byCategory || [];
  const expYear = expenseData[0]?.yearTotal || [];

  const salaryByMonth = salaryData[0]?.byMonth || [];
  const salYear = salaryData[0]?.yearTotal || [];

  const bonusByMonth = bonusData[0]?.byMonth || [];
  const bonYear = bonusData[0]?.yearTotal || [];

  const savingsByMonth = savingData[0]?.byMonth || [];
  const savYear = savingData[0]?.yearTotal || [];

  const remittancesByMonth = remittanceData[0]?.byMonth || [];
  const remYear = remittanceData[0]?.yearTotal || [];

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const toMap = (arr) => {
    const m = {};
    arr.forEach((x) => {
      m[x._id] = x.totalUSD || 0;
    });
    return m;
  };

  const expMap = toMap(expensesByMonth);
  const salMap = toMap(salaryByMonth);
  const bonMap = toMap(bonusByMonth);
  const savMap = toMap(savingsByMonth);
  const remMap = toMap(remittancesByMonth);

  const monthlyTrend = monthNames.map((name, i) => {
    const m = i + 1;
    const income = (salMap[m] || 0) + (bonMap[m] || 0);
    const expense = expMap[m] || 0;
    return {
      month: name,
      monthNumber: m,
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      savings: Math.round((savMap[m] || 0) * 100) / 100,
      remittances: Math.round((remMap[m] || 0) * 100) / 100,
      net: Math.round((income - expense) * 100) / 100,
    };
  });

  const salaryTotal = salYear[0]?.totalUSD || 0;
  const bonusTotal = bonYear[0]?.totalUSD || 0;
  const incomeTotal = salaryTotal + bonusTotal;
  const expenseTotal = expYear[0]?.totalUSD || 0;

  return success(res, {
    year: targetYear || "all",
    availableYears,
    monthlyTrend,
    expensesByCategory: expensesByCategory.map((c) => ({
      name: c._id,
      value: Math.round((c.totalUSD || 0) * 100) / 100,
      count: c.count,
    })),
    yearTotals: {
      salary: Math.round(salaryTotal * 100) / 100,
      bonus: Math.round(bonusTotal * 100) / 100,
      income: Math.round(incomeTotal * 100) / 100,
      expenses: Math.round(expenseTotal * 100) / 100,
      savings: Math.round((savYear[0]?.totalUSD || 0) * 100) / 100,
      remittances: Math.round((remYear[0]?.totalUSD || 0) * 100) / 100,
      net: Math.round((incomeTotal - expenseTotal) * 100) / 100,
      expenseCount: expYear[0]?.count || 0,
    },
  });
});

module.exports = { getSummary, getCharts };
