import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { HomeIcon } from '../components/HomeIcon';
import { fetchGuildSettings } from '../api/client';

export function PublicLayout() {
  const { t } = useTranslation();
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });

  return (
    <div className="app-shell">
      <header className="app-header app-header-main">
        <Link to="/" className="guild-name" style={{ textDecoration: 'none', color: 'inherit' }}>
          {settingsQuery.data?.guildName ?? 'RFONext DKP'}
        </Link>
        <div className="app-header-bottom">
          <nav className="public-nav">
            <NavLink to="/" end aria-label={t('nav.home') as string} title={t('nav.home') as string}>
              <HomeIcon />
            </NavLink>
            <NavLink to="/leiloes">{t('nav.auctions')}</NavLink>
            <NavLink to="/codigo">{t('nav.code')}</NavLink>
            <NavLink to="/saldo">{t('nav.balances')}</NavLink>
            <NavLink to="/extrato">{t('nav.feed')}</NavLink>
            <NavLink to="/perfil">{t('nav.profile')}</NavLink>
          </nav>
          <LanguageSwitcher />
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
