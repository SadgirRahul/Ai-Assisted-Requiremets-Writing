import React from "react";
import Home from "./pages/Home";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>AI Requirements Generator</h1>
        <p>Upload a PDF or Word document to generate structured requirements</p>
      </header>
      <main>
        <Home />
      </main>
    </div>
  );
}

export default App;
