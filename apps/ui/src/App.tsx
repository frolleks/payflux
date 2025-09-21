import { BrowserRouter, Route, Routes } from "react-router-dom";
import PayPage from "./routes/pay";
import Dashboard from "./routes/dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pay/:id" element={<PayPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
