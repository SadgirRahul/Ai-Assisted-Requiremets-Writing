import React, { useRef, useState } from "react";
import axios from "axios";
import { DOMAIN_OPTIONS } from "./DomainSelect";
import "./FileUpload.css";

// Default `/api` uses Vite proxy in dev (same origin → no CORS). Override VITE_API_URL for production.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const ACCEPTED_TYPES = (import.meta.env.VITE_ACCEPTED_FILE_TYPES || ".pdf,.doc,.docx").split(",");

/**
 * FileUpload component
 * Props:
 *   onResult(result)  — called with the API response on success
 *   onError(message)  — called with an error string on failure
 *   onLoading(name)   — called when generation starts (receives filename)
 *   selectedDomain    — optional domain id from DomainSelect
 */
const FileUpload = ({ onResult, onError, onLoading, selectedDomain }) => {
  const domainLabel = DOMAIN_OPTIONS.find((d) => d.id === selectedDomain)?.name;
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState(""); // step label shown under spinner

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (onError) onError(null); // clear any previous error
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (onError) onError(null);
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    inputRef.current.value = "";
    if (onError) onError(null);
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      if (onError) onError("Please select a PDF or Word file first.");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setStatus("Uploading file…");
    if (onError) onError(null);
    if (onResult) onResult(null);
    if (onLoading) onLoading(selectedFile.name);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("domain", selectedDomain ?? "");

      setStatus("Extracting text…");
      const response = await axios.post(`${API_BASE_URL}/generate-requirements`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
            if (percent === 100) setStatus("Generating requirements with AI…");
          }
        },
      });

      setStatus("Done!");
      if (onResult) onResult(response.data);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        "Something went wrong. Please try again.";
      if (onError) onError(message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setStatus("");
    }
  };

  return (
    <div className="file-upload-wrapper">
      {domainLabel ? (
        <p className="file-upload__domain">
          Domain: <strong>{domainLabel}</strong>
        </p>
      ) : null}
      {/* Drop zone */}
      <div
        className={`drop-zone ${
          dragOver ? "drag-over" : ""
        } ${loading ? "disabled" : ""}`}
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={!loading ? handleDrop : undefined}
      >
        <div className="drop-icon">{selectedFile ? "📎" : "📄"}</div>
        <p>
          {selectedFile
            ? selectedFile.name
            : "Click or drag & drop your file here"}
        </p>
        <span className="file-hint">Supported: PDF, DOC, DOCX</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          style={{ display: "none" }}
          disabled={loading}
        />
      </div>

      {/* Selected file info bar */}
      {selectedFile && !loading && (
        <div className="selected-file-info">
          <span>📎 {selectedFile.name}</span>
          <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          <button
            className="remove-btn"
            onClick={handleRemoveFile}
            title="Remove file"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading spinner + progress */}
      {loading && (
        <div className="loading-section">
          <div className="spinner" />
          <div className="loading-info">
            <span className="loading-status">{status}</span>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="progress-bar-wrapper">
                <div
                  className="progress-bar"
                  style={{ width: `${uploadProgress}%` }}
                />
                <span className="progress-label">{uploadProgress}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        className="generate-btn"
        onClick={handleGenerate}
        disabled={!selectedFile || loading}
      >
        {loading ? "⏳ Processing…" : "⚡ Generate Requirements"}
      </button>
    </div>
  );
};

export default FileUpload;
