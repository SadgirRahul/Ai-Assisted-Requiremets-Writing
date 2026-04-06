const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");

const SUPPORTED_EXTENSIONS = (process.env.ALLOWED_FILE_TYPES || "pdf,docx,doc").split(",");

/**
 * Extracts plain text from a PDF or Word file buffer.
 * @param {Express.Multer.File} file - The uploaded file object from multer (memory storage)
 * @returns {Promise<string>} Extracted plain text
 */
const parseFile = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

  console.log(`[fileParser] Parsing file: ${file.originalname} (${ext.toUpperCase()}, ${(file.size / 1024).toFixed(1)} KB)`);

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Supported types: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }

  if (ext === "pdf") {
    // Try strict parse first, then fall back to lenient mode for malformed PDFs
    const parseAttempts = [
      { options: {}, label: "strict" },
      { options: { version: "v1.10.100" }, label: "lenient (v1.10.100)" },
      { options: { version: "v2.0.550" }, label: "lenient (v2.0.550)" },
    ];

    let lastErr;
    for (const attempt of parseAttempts) {
      try {
        const data = await pdfParse(file.buffer, attempt.options);
        if (!data.text || data.text.trim().length === 0) {
          throw new Error("PDF appears to be empty or contains only images/scanned content");
        }
        console.log(`[fileParser] PDF extracted (${attempt.label}): ${data.numpages} page(s), ${data.text.length} characters`);
        return data.text;
      } catch (err) {
        console.warn(`[fileParser] PDF parse attempt (${attempt.label}) failed: ${err.message}`);
        lastErr = err;
      }
    }
    throw new Error(
      `Failed to parse PDF: ${lastErr.message}. Try saving the PDF as a newer version, or convert it to DOCX.`
    );
  }

  if (ext === "docx" || ext === "doc") {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      if (result.messages && result.messages.length > 0) {
        console.warn("[fileParser] Mammoth warnings:", result.messages.map((m) => m.message).join("; "));
      }
      if (!result.value || result.value.trim().length === 0) {
        throw new Error("Word document appears to be empty");
      }
      console.log(`[fileParser] DOCX extracted: ${result.value.length} characters`);
      return result.value;
    } catch (err) {
      throw new Error(`Failed to parse Word document: ${err.message}`);
    }
  }
};

module.exports = { parseFile };
