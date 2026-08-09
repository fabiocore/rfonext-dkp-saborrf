import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { HomePage } from './pages/HomePage';
import { BalancesPage } from './pages/BalancesPage';
import { PublicAuctionsListPage } from './pages/PublicAuctionsListPage';
import { PublicAuctionDetailPage } from './pages/PublicAuctionDetailPage';
import { TransparencyFeedPage } from './pages/TransparencyFeedPage';
import { PlayerAuctionPage } from './pages/PlayerAuctionPage';
import { ProfileCodeEntryPage } from './pages/ProfileCodeEntryPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/admin/LoginPage';
import { RecoverPasswordPage } from './pages/admin/RecoverPasswordPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { ImportsPage } from './pages/admin/ImportsPage';
import { CharactersPage } from './pages/admin/CharactersPage';
import { ActivitiesPage } from './pages/admin/ActivitiesPage';
import { ProtectionsPage } from './pages/admin/ProtectionsPage';
import { CouncilUsersPage } from './pages/admin/CouncilUsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { ChangePasswordPage } from './pages/admin/ChangePasswordPage';
import { AuctionsListPage } from './pages/admin/AuctionsListPage';
import { AuctionBuilderPage } from './pages/admin/AuctionBuilderPage';
import { CustomEventsPage } from './pages/admin/CustomEventsPage';
import { TransferPage } from './pages/admin/TransferPage';
import { ManualAdjustmentPage } from './pages/admin/ManualAdjustmentPage';
import { AnnouncementsPage } from './pages/admin/AnnouncementsPage';
import { BackupPage } from './pages/admin/BackupPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="saldo" element={<BalancesPage />} />
        <Route path="leiloes" element={<PublicAuctionsListPage />} />
        <Route path="leiloes/:id" element={<PublicAuctionDetailPage />} />
        {/* O código do leilão passou a ser digitado direto na página Leilões (2026-08-09) — redireciona quem tinha o link antigo salvo. */}
        <Route path="codigo" element={<Navigate to="/leiloes" replace />} />
        <Route path="extrato" element={<TransparencyFeedPage />} />
        <Route path="perfil" element={<ProfileCodeEntryPage />} />
      </Route>

      <Route path="/oferta/:code" element={<PlayerAuctionPage />} />
      <Route path="/perfil/:code" element={<ProfilePage />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/recuperar-senha" element={<RecoverPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="imports" replace />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="characters" element={<CharactersPage />} />
          <Route path="activities" element={<ActivitiesPage />} />
          <Route path="protections" element={<ProtectionsPage />} />
          <Route path="auctions" element={<AuctionsListPage />} />
          <Route path="auctions/:id" element={<AuctionBuilderPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="custom-events" element={<CustomEventsPage />} />
          <Route path="ledger/transfer" element={<TransferPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route element={<ProtectedRoute gmOnly />}>
            <Route path="council" element={<CouncilUsersPage />} />
            <Route path="ledger/manual-adjustment" element={<ManualAdjustmentPage />} />
            <Route path="backup" element={<BackupPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
