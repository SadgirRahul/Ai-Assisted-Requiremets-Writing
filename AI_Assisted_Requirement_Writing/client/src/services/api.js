import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const uploadFileAndGenerateRequirements = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });

  return response.data;
};
