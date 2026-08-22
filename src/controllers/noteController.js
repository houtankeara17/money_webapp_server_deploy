const asyncHandler = require("express-async-handler");
const Note = require("../models/Note");
const { success, error } = require("../utils/response");
const { msg } = require("../utils/i18n");
const { toObjectId } = require("../utils/currency");

const getNotes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 100,
    categoryTag,
    search,
    pinned,
    folderId,
    type,
    // CHANGED: -pinned puts pinned first, position (ascending) puts index 0 first
    sort = "-pinned position -updatedAt",
  } = req.query;

  const query = { userId: toObjectId(req.user._id) };

  // Filter by folder (null gets root items, or pass "root")
  if (folderId === "null" || folderId === "root") {
    query.folderId = null;
  } else if (folderId) {
    query.folderId = toObjectId(folderId);
  }

  if (type) query.type = type;
  if (categoryTag) query.categoryTag = categoryTag;
  if (pinned === "true") query.pinned = true;
  if (pinned === "false") query.pinned = false;

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { body: { $regex: search, $options: "i" } },
      { "items.text": { $regex: search, $options: "i" } },
      { fileType: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Note.countDocuments(query);
  const items = await Note.find(query)
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  const byCategory = await Note.aggregate([
    { $match: { userId: toObjectId(req.user._id) } },
    { $group: { _id: "$categoryTag", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const pinnedCount = await Note.countDocuments({
    userId: toObjectId(req.user._id),
    pinned: true,
  });

  return success(res, {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
    byCategory,
    pinnedCount,
  });
});

const createNote = asyncHandler(async (req, res) => {
  const {
    title,
    body,
    icon,
    categoryTag,
    image,
    images,
    links,
    color,
    pinned,
    items,
    column,
    folderId,
    type,
    fileType,
    fileUrl,
    fileSize,
  } = req.body;

  if (!title?.trim()) return error(res, msg(req, "note.titleRequired"), 400);

  // Validate folder existence if folderId provided
  if (folderId) {
    const parentFolder = await Note.findOne({
      _id: folderId,
      userId: toObjectId(req.user._id),
      type: "folder",
    });
    if (!parentFolder) return error(res, msg(req, "folder.notFound"), 404);
  }

  const itemType = type || "note";
  const defaultIcon =
    itemType === "folder" ? "📁" : itemType === "file" ? "📄" : "📝";

  const maxPos = await Note.findOne({
    userId: toObjectId(req.user._id),
    folderId: folderId ? toObjectId(folderId) : null,
  })
    .sort("-position")
    .select("position");

  const note = await Note.create({
    userId: toObjectId(req.user._id),
    folderId: folderId ? toObjectId(folderId) : null,
    type: itemType,
    fileType: fileType || "",
    fileUrl: fileUrl || "",
    fileSize: fileSize || 0,
    title: title.trim(),
    body: body || "",
    icon: icon || defaultIcon,
    categoryTag: categoryTag || "General",
    image: image || "",
    images: images || [],
    links: links || [],
    color: color || "default",
    pinned: !!pinned,
    items: items || [],
    position: (maxPos?.position || 0) + 1,
    column: column || 0,
  });

  return success(res, note, msg(req, "note.created"), 201);
});

const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!note) return error(res, msg(req, "note.notFound"), 404);

  const fields = [
    "title",
    "body",
    "icon",
    "categoryTag",
    "image",
    "images",
    "links",
    "color",
    "pinned",
    "items",
    "position",
    "column",
    "folderId",
    "type",
    "fileType",
    "fileUrl",
    "fileSize",
  ];

  fields.forEach((f) => {
    if (req.body[f] !== undefined) note[f] = req.body[f];
  });

  await note.save();
  return success(res, note, msg(req, "note.updated"));
});

const togglePin = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!note) return error(res, msg(req, "note.notFound"), 404);
  note.pinned = !note.pinned;
  await note.save();
  return success(
    res,
    note,
    note.pinned ? msg(req, "note.pinned") : msg(req, "note.unpinned"),
  );
});

const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });

  if (!note) return error(res, msg(req, "note.notFound"), 404);

  // If item is a folder, clean up items inside it recursively or delete them directly
  if (note.type === "folder") {
    await Note.deleteMany({
      folderId: note._id,
      userId: toObjectId(req.user._id),
    });
  }

  await note.deleteOne();
  return success(res, null, msg(req, "note.deleted"));
});

const deleteAllNotes = asyncHandler(async (req, res) => {
  const result = await Note.deleteMany({ userId: toObjectId(req.user._id) });
  return success(
    res,
    { deleted: result.deletedCount },
    msg(req, "note.allDeleted"),
  );
});

const exportNotes = asyncHandler(async (req, res) => {
  const items = await Note.find({ userId: toObjectId(req.user._id) }).sort(
    "-pinned,-position",
  );
  return success(res, items, msg(req, "note.exported"));
});

const toggleChecklistItem = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!note) return error(res, msg(req, "note.notFound"), 404);

  const itemId = req.params.itemId;
  const item = note.items.id(itemId);
  if (!item) return error(res, msg(req, "note.checklistItemNotFound"), 404);

  item.checked = !item.checked;
  await note.save();
  return success(res, note, msg(req, "note.checklistUpdated"));
});

const duplicateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: toObjectId(req.user._id),
  });
  if (!note) return error(res, msg(req, "note.notFound"), 404);

  const maxPos = await Note.findOne({
    userId: toObjectId(req.user._id),
    folderId: note.folderId,
  })
    .sort("-position")
    .select("position");

  const copy = await Note.create({
    userId: toObjectId(req.user._id),
    folderId: note.folderId,
    type: note.type,
    fileType: note.fileType,
    fileUrl: note.fileUrl,
    fileSize: note.fileSize,
    title: `${note.title} ${msg(req, "note.copySuffix")}`,
    body: note.body,
    icon: note.icon,
    categoryTag: note.categoryTag,
    image: note.image,
    images: note.images,
    links: note.links,
    color: note.color,
    pinned: false,
    items: note.items.map((i) => ({
      text: i.text,
      checked: false,
      order: i.order,
    })),
    position: (maxPos?.position || 0) + 1,
    column: note.column,
  });

  return success(res, copy, msg(req, "note.duplicated"), 201);
});

const importNotes = asyncHandler(async (req, res) => {
  const { text, folderId } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return error(res, msg(req, "note.importNoText"), 400);
  }

  const userId = toObjectId(req.user._id);

  const maxPosDoc = await Note.findOne({
    userId,
    folderId: folderId ? toObjectId(folderId) : null,
  })
    .sort("-position")
    .select("position");
  let startPosition = (maxPosDoc?.position || 0) + 1;

  const rawBlocks = text.split(/^---$/m);
  const docsToInsert = [];

  for (const block of rawBlocks) {
    const lines = block.trim().split("\n");
    if (!lines.length || (lines.length === 1 && !lines[0].trim())) continue;

    let title = "";
    let categoryTag = "General";
    const bodyLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!title && /^title:/i.test(line)) {
        title = line.replace(/^title:/i, "").trim();
      } else if (!title && line.startsWith("# ")) {
        title = line.replace(/^#\s*/, "").trim();
      } else if (/^category:/i.test(line)) {
        categoryTag = line.replace(/^category:/i, "").trim() || "General";
      } else if (!title && i === 0) {
        title = line.trim();
      } else {
        bodyLines.push(line);
      }
    }

    if (!title) continue;

    docsToInsert.push({
      userId,
      folderId: folderId ? toObjectId(folderId) : null,
      type: "note",
      title,
      categoryTag,
      body: bodyLines.join("\n").trim(),
      icon: "📝",
      color: "default",
      position: startPosition++,
      column: 0,
    });
  }

  if (docsToInsert.length === 0) {
    return error(res, msg(req, "note.importNoNotesFound"), 400);
  }

  const created = await Note.insertMany(docsToInsert);
  return success(
    res,
    created,
    msg(req, "note.importedSuccess", { count: created.length }),
    201,
  );
});

const reorderNotes = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.items;

  if (!items || !Array.isArray(items)) {
    return error(res, msg(req, "note.invalidItemsArray"), 400);
  }

  const bulkOps = items.map((item, index) => ({
    updateOne: {
      filter: { _id: toObjectId(item._id), userId: toObjectId(req.user._id) },
      update: { $set: { position: item.position ?? index } },
    },
  }));

  await Note.bulkWrite(bulkOps);

  return success(res, null, msg(req, "note.reorderedSuccess"));
});

module.exports = {
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
};
