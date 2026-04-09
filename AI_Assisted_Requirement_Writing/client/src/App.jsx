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
