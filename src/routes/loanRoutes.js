const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getLoans,
  createLoan,
  updateLoan,
  addRepayment,
  deleteLoan,
  deleteAllLoans,
  exportLoans,
  importLoans,
} = require("../controllers/loanController");

router.use(protect);

router.route("/").get(getLoans).post(createLoan).delete(deleteAllLoans);

router.get("/export", exportLoans);
router.post("/import", importLoans);

router.post("/:id/repay", addRepayment);
router.route("/:id").put(updateLoan).delete(deleteLoan);

module.exports = router;
