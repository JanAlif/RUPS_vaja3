import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Quiz from "./pages/Quiz";
import SloQuiz from "./pages/SloQuiz";
import LeaderBoards from "./pages/LeaderBoard";
import Profile from "./pages/Profile";
import "./leaflet-icons-fix";
import "./styles/layout.css";
import "./styles/styles.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }
  
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <Routes>
        <Route path="/"element={<Protected><Home /></Protected>}/>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/quiz" element={<Protected> <Quiz/> </Protected>}/>
        <Route path="/sloquiz" element={<Protected> <SloQuiz/> </Protected>}/>
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/leaderboards" element={<Protected><LeaderBoards /></Protected>} />
      </Routes>
    </div>
  );
}