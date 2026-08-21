const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getSummary, getCharts } = require("../controllers/reportController");

router.use(protect);
router.get("/summary", getSummary);
router.get("/charts", getCharts);

module.exports = router;
