import { Navigate, Route, Routes } from "react-router-dom";
import { ReportPage } from "./pages/ReportPage.js";
import { OfficerPage } from "./pages/OfficerPage.js";
import { StatusPage } from "./pages/StatusPage.js";
import { TransparencyPage } from "./pages/TransparencyPage.js";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/transparency" element={<TransparencyPage />} />
      <Route path="/officer" element={<OfficerPage />} />
    </Routes>
  );
}

export default App;
