import { BrowserRouter, Route, Routes } from "react-router-dom";
import PayPage from "./routes/pay";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pay/:id" element={<PayPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
