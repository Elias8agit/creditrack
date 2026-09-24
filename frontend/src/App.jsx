import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Simulator from './pages/Simulator';
import Applications from './pages/Applications';
import ApplicationForm from './pages/ApplicationForm';
import ApplicationDetail from './pages/ApplicationDetail';
import Users from './pages/Users';
import Products from './pages/Products';
import Reports from './pages/Reports';

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/simulador" replace />;
  return <Navigate to="/solicitudes" replace />;
}

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const salir = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">CrediTrack</div>
        <nav>
          <NavLink to="/simulador">Simulador</NavLink>
          {user && <NavLink to="/solicitudes">{user.rol === 'CLIENTE' ? 'Mis solicitudes' : 'Solicitudes'}</NavLink>}
          {user?.rol === 'CLIENTE' && <NavLink to="/solicitudes/nueva">Nueva solicitud</NavLink>}
          {user && user.rol !== 'CLIENTE' && <NavLink to="/reportes">Reportes</NavLink>}
          {user?.rol === 'ADMIN' && <NavLink to="/usuarios">Usuarios</NavLink>}
          {user?.rol === 'ADMIN' && <NavLink to="/productos">Productos</NavLink>}
        </nav>
        <div className="session">
          {user ? (
            <>
              <span data-testid="usuario-actual">{user.nombre} ({user.rol})</span>
              <button className="btn btn-light" onClick={salir}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Iniciar sesión</NavLink>
              <NavLink to="/registro">Registrarse</NavLink>
            </>
          )}
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/simulador" element={<Simulator />} />
          <Route path="/solicitudes" element={<RequireRole><Applications /></RequireRole>} />
          <Route path="/solicitudes/nueva" element={<RequireRole roles={['CLIENTE']}><ApplicationForm /></RequireRole>} />
          <Route path="/solicitudes/:id/editar" element={<RequireRole roles={['CLIENTE']}><ApplicationForm /></RequireRole>} />
          <Route path="/solicitudes/:id" element={<RequireRole><ApplicationDetail /></RequireRole>} />
          <Route path="/usuarios" element={<RequireRole roles={['ADMIN']}><Users /></RequireRole>} />
          <Route path="/productos" element={<RequireRole roles={['ADMIN']}><Products /></RequireRole>} />
          <Route path="/reportes" element={<RequireRole roles={['ADMIN', 'ANALISTA']}><Reports /></RequireRole>} />
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
    </div>
  );
}
