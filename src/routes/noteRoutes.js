const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getNotes,
  createNote,
  updateNote,
  togglePin,
  toggleChecklistItem,
  duplicateNote,
  deleteNote,
  deleteAllNotes,
  exportNotes,
  importNotes,
  reorderNotes,
} = require("../controllers/noteController");

router.use(protect);

router.route("/").get(getNotes).post(createNote).delete(deleteAllNotes);

router.get("/export", exportNotes);
router.post("/import", importNotes);
router.patch("/reorder", reorderNotes);
router.route("/:id").put(updateNote).delete(deleteNote);

router.patch("/:id/pin", togglePin);
router.patch("/:id/items/:itemId", toggleChecklistItem);
router.post("/:id/duplicate", duplicateNote);

module.exports = router;
