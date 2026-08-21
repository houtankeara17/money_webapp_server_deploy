/**
 * Automatic loan interest helpers
 *
 * Simple:  I = P × (r/100) × (days/365)
 * Compound (monthly): I = P × ((1 + r/100/12)^months − 1)
 *
 * Interest is calculated on original principal (flat) by default —
 * easy for personal lending in KH/USD/THB contexts.
 */

const MS_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from, to) {
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, (b.getTime() - a.getTime()) / MS_DAY);
}

/**
 * @param {object} opts
 * @param {number} opts.principalUSD
 * @param {number} opts.rateAnnual  e.g. 12 for 12% per year
 * @param {'simple'|'compound'} opts.type
 * @param {Date|string} opts.fromDate  loan start
 * @param {Date|string} [opts.toDate]  default now
 * @returns {number} interest USD (rounded 2 dp)
 */
function calculateInterest({
  principalUSD,
  rateAnnual = 0,
  type = "simple",
  fromDate,
  toDate = new Date(),
}) {
  const P = Number(principalUSD) || 0;
  const r = Number(rateAnnual) || 0;
  if (P <= 0 || r <= 0) return 0;

  const days = daysBetween(fromDate, toDate);
  if (days <= 0) return 0;

  let interest = 0;
  if (type === "compound") {
    const months = days / 30.4375;
    const monthlyRate = r / 100 / 12;
    interest = P * (Math.pow(1 + monthlyRate, months) - 1);
  } else {
    // simple interest
    interest = P * (r / 100) * (days / 365);
  }

  return Math.round(interest * 100) / 100;
}

/**
 * Enrich a loan document/plain object with live interest figures
 */
function enrichLoanInterest(loan, asOf = new Date()) {
  const obj =
    typeof loan.toObject === "function" ? loan.toObject() : { ...loan };
  const rate = Number(obj.interestRate) || 0;
  const type = obj.interestType === "compound" ? "compound" : "simple";
  const principalUSD = Number(obj.amountUSD) || 0;
  const repaidUSD = Number(obj.repaidAmountUSD) || 0;

  const interestAccruedUSD = calculateInterest({
    principalUSD,
    rateAnnual: rate,
    type,
    fromDate: obj.loanDate,
    toDate: asOf,
  });

  const totalDueUSD =
    Math.round((principalUSD + interestAccruedUSD) * 100) / 100;
  const outstandingUSD = Math.max(
    0,
    Math.round((totalDueUSD - repaidUSD) * 100) / 100,
  );

  return {
    ...obj,
    interestRate: rate,
    interestType: type,
    interestAccruedUSD,
    totalDueUSD,
    outstandingUSD,
    interestDays: Math.floor(daysBetween(obj.loanDate, asOf)),
  };
}

module.exports = {
  calculateInterest,
  enrichLoanInterest,
  daysBetween,
};
