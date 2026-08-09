import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { fetchGuildSettings, isGmLevel } from '../../api/client';

const ROLE_LABEL: Record<string, string> = { GM: 'GM', VICE_GM: 'Vice-GM', COUNCIL: 'Conselho' };

export function AdminLayout() {
  const { user, logout } = useAuth();
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const gmLevel = isGmLevel(user?.role);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <span className="guild-name">{settingsQuery.data?.guildName ?? 'RFONext DKP'} — Admin</span>
        <div className="admin-header-right">
          <span className="admin-user">
            {user?.username} ({user ? ROLE_LABEL[user.role] : ''})
          </span>
          <button type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <div className="admin-body">
        <nav className="admin-nav">
          <div className="admin-nav-group">
            <span className="admin-nav-group-label">Dados do Jogo</span>
            <NavLink to="/admin/imports">Importações</NavLink>
            <NavLink to="/admin/characters">Personagens</NavLink>
          </div>
          <div className="admin-nav-group">
            <span className="admin-nav-group-label">Atividades &amp; Conteúdo Público</span>
            <NavLink to="/admin/activities">Atividades do Jogo</NavLink>
            <NavLink to="/admin/custom-events">Eventos Personalizados</NavLink>
            <NavLink to="/admin/announcements">Mural</NavLink>
          </div>
          <div className="admin-nav-group">
            <span className="admin-nav-group-label">Leilões</span>
            <NavLink to="/admin/auctions">Leilões</NavLink>
            <NavLink to="/admin/protections">Proteções</NavLink>
          </div>
          <div className="admin-nav-group">
            <span className="admin-nav-group-label">Ledger</span>
            <NavLink to="/admin/ledger/transfer">Transferência</NavLink>
            {gmLevel && <NavLink to="/admin/ledger/manual-adjustment">Emissão manual</NavLink>}
          </div>
          <div className="admin-nav-group">
            <span className="admin-nav-group-label">Sistema</span>
            {gmLevel && <NavLink to="/admin/council">Equipe</NavLink>}
            <NavLink to="/admin/settings">Configurações</NavLink>
            {gmLevel && <NavLink to="/admin/backup">Backup</NavLink>}
            <NavLink to="/admin/change-password">Minha Senha</NavLink>
          </div>
        </nav>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
