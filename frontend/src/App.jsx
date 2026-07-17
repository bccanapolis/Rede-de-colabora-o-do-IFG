import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import CampusProfile from "./pages/CampusProfile";
import ResearcherProfile from "./pages/ResearcherProfile";
import AreaProfile from "./pages/AreaProfile";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <div className="wrap" style={{ paddingTop: 14 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/campus/:slug" element={<CampusProfile />} />
          <Route path="/pesquisador/:id" element={<ResearcherProfile />} />
          <Route path="/area/:nome" element={<AreaProfile />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
