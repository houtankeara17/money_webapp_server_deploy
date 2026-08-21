const mongoose = require("mongoose");

const noteItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    checked: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const noteLinkSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    label: { type: String, default: "" },
  },
  { _id: true },
);

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["note", "folder", "file", "link", "checklist"],
      default: "note",
    },
    fileType: {
      type: String,
      default: "", // e.g., 'pdf', 'image', 'document', 'audio', 'zip', or MIME type
    },
    fileUrl: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    icon: { type: String, default: "📝" },
    categoryTag: {
      type: String,
      default: "General",
      enum: [
        "Personal Finance OS",
        "Work",
        "Personal",
        "Finance",
        "Shopping",
        "Health",
        "Travel",
        "Ideas",
        "General",
      ],
    },
    image: { type: String, default: "" },
    images: [{ type: String }],
    links: [noteLinkSchema],
    color: {
      type: String,
      default: "default",
      enum: ["default", "green", "blue", "yellow", "red", "purple", "orange"],
    },
    pinned: { type: Boolean, default: false },
    items: [noteItemSchema],
    position: { type: Number, default: 0, index: true },
    column: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true },
);

noteSchema.index({ userId: 1, folderId: 1 });
noteSchema.index({ userId: 1, pinned: -1, position: -1 });
noteSchema.index({ userId: 1, categoryTag: 1 });

module.exports = mongoose.model("Note", noteSchema);
