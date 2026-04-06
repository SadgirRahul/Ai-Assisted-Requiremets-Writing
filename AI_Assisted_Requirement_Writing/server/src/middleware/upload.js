const multer = require("multer");
const path = require("path");

const ALLOWED_TYPES = (process.env.ALLOWED_FILE_TYPES || "pdf,docx,doc").split(",");
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || "10") * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (ALLOWED_TYPES.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Only ${ALLOWED_TYPES.join(", ")} files are allowed`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

module.exports = upload;
