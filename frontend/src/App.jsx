import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './components/layout/DashboardLayout'
import ProtectedRoute from './routes/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import PacientesPage from './pages/PacientesPage'
import ConsultasPage from './pages/ConsultasPage'
import AntecedentesPatologicosPage from './pages/AntecedentesPatologicosPage'
import AntecedentesNoPatologicosPage from './pages/AntecedentesNoPatologicosPage'
import AntecedentesHeredoFamiliaresPage from './pages/AntecedentesHeredoFamiliaresPage'
import UsuariosPage from './pages/UsuariosPage'
import PacienteDetallePage from './pages/PacienteDetallePage'
import ConsultaDetallePage from './pages/ConsultaDetallePage'
import DashboardPage from './pages/DashboardPage'
import RespaldosPage from './pages/RespaldosPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pacientes" element={<PacientesPage />} />
        <Route path="/pacientes/:id" element={<PacienteDetallePage />} />
        <Route path="/consultas" element={<ConsultasPage />} />
        <Route path="/consultas/:id" element={<ConsultaDetallePage />} />
        <Route path="/antecedentes-patologicos" element={<AntecedentesPatologicosPage />} />
        <Route path="/antecedentes-no-patologicos" element={<AntecedentesNoPatologicosPage />} />
        <Route path="/antecedentes-heredo-familiares" element={<AntecedentesHeredoFamiliaresPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/respaldos" element={<RespaldosPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
