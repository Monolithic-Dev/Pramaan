import { Navigate, Route, Routes } from "react-router-dom";
import { ReportPage } from "./pages/ReportPage.js";
import { OfficerPage } from "./pages/OfficerPage.js";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/officer" element={<OfficerPage />} />
    </Routes>
  );
}

export default App;
