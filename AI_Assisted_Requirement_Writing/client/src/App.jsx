import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import RequirementsTreePage from "./pages/RequirementsTreePage";
import "./App.css";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <header className="app-header">
                <h1>AI Requirements Generator</h1>
                <p>Upload a PDF or Word document to generate structured requirements</p>
              </header>
              <main>
                <Home />
              </main>
            </>
          }
        />
        <Route path="/requirements/tree" element={<RequirementsTreePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
