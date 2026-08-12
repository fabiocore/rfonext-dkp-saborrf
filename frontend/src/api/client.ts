import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
});

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Endpoints onde 401 significa "credencial errada" (login/troca de senha),
// não "sua sessão expirou" — não deve disparar o logout automático.
const AUTH_ENDPOINTS_WITH_OWN_401 = ['/auth/login', '/auth/change-password', '/auth/recover-password'];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = AUTH_ENDPOINTS_WITH_OWN_401.some((path) => error?.config?.url?.includes(path));
    if (error?.response?.status === 401 && onUnauthorized && !isAuthEndpoint) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export type UserRole = 'GM' | 'VICE_GM' | 'COUNCIL';

/** Vice-GM tem os mesmos direitos do GM em tudo (PREMISSAS.md seção 8). */
export function isGmLevel(role: UserRole | undefined): boolean {
  return role === 'GM' || role === 'VICE_GM';
}

export interface GuildSettings {
  guildName: string;
  currencyName: string;
  currencyAbbr: string;
  defaultLocale: string;
  weeklyTaxPercent: number;
  weeklyTaxWeekday: number;
  weeklyTaxTimeUtcMinutes: number;
  pinnedAnnouncementText: string | null;
}

export type MembershipStatus = 'ACTIVE' | 'UNKNOWN' | 'LEFT';

export interface BalanceEntry {
  id: string;
  gameName: string;
  level: number | null;
  membershipStatus: MembershipStatus;
  avatarUrl: string | null;
  balance: number;
}

export interface Character {
  id: string;
  gameName: string;
  status: 'PRINCIPAL' | 'ALT' | 'ALT_ONLY';
  linkedPrincipalId: string | null;
  level: number | null;
  membershipStatus: MembershipStatus;
  lastSeenAt: string;
  notes: string | null;
  balance: number;
  discordId: string | null;
  avatarUrl: string | null;
  profileAccessCode: string | null;
}

export interface ActivityComponentRef {
  componentActivityId: string;
  componentActivity: Activity;
}

export interface ManualEventBatchRef {
  id: string;
  occurrenceDate: string | null;
  brcValueEach: number;
  createdAt: string;
}

export interface Activity {
  id: string;
  name: string;
  brcValue: number;
  sourceType: 'XML_COLUMN' | 'MANUAL';
  isNameLocked: boolean;
  isComposite: boolean;
  isActive: boolean;
  recurrencePeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  maxOccurrencesPerPeriod: number;
  showOnEventsPanel: boolean;
  scheduleType: 'NONE' | 'ONE_TIME' | 'RECURRING';
  scheduleOneTimeAt: string | null;
  scheduleWeekdaysUtc: number[];
  scheduleTimeUtcMinutes: number | null;
  imageUrl: string | null;
  componentsOf: ActivityComponentRef[];
  manualEventBatches: ManualEventBatchRef[];
  updatedAt: string;
}

export interface Protection {
  id: string;
  name: string;
  description: string;
  minBid: number;
  minLevel: number;
  isActive: boolean;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  referenceDate: string;
  rowCount: number;
  newCharactersDetected: number;
  newActivitiesDetected: number;
  status: 'PROCESSED' | 'FAILED';
  uploadedAt: string;
}

export interface StaffUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export async function login(username: string, password: string) {
  const { data } = await apiClient.post<{ accessToken: string; user: { id: string; username: string; role: UserRole } }>(
    '/auth/login',
    { username, password },
  );
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

export interface RecoveryCodeStatus {
  isSet: boolean;
  updatedAt: string | null;
}

export async function fetchRecoveryCodeStatus(): Promise<RecoveryCodeStatus> {
  const { data } = await apiClient.get<RecoveryCodeStatus>('/auth/recovery-code');
  return data;
}

export async function setRecoveryCode(currentPassword: string, recoveryCode: string): Promise<void> {
  await apiClient.post('/auth/recovery-code', { currentPassword, recoveryCode });
}

export async function recoverPassword(username: string, recoveryCode: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/recover-password', { username, recoveryCode, newPassword });
}

export async function fetchGuildSettings(): Promise<GuildSettings> {
  const { data } = await apiClient.get<GuildSettings>('/guild-settings');
  return data;
}

export async function updateGuildSettings(patch: Partial<GuildSettings>): Promise<GuildSettings> {
  const { data } = await apiClient.put<GuildSettings>('/guild-settings', patch);
  return data;
}

export async function updatePinnedAnnouncement(text: string): Promise<GuildSettings> {
  const { data } = await apiClient.put<GuildSettings>('/guild-settings/pinned-announcement', { text });
  return data;
}

export async function downloadBackup(): Promise<void> {
  const response = await apiClient.get('/admin/backup', { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'backup.sql';
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(file: File, confirmText: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('confirmText', confirmText);
  await apiClient.post('/admin/backup/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export interface WeeklyTaxRun {
  id: string;
  runDate: string;
  percentApplied: number;
  executedAt: string;
  totalCharactersTaxed: number;
  totalAmountBurned: number;
  triggeredManually: boolean;
  reason: string | null;
  triggeredById: string | null;
}

export async function fetchWeeklyTaxRuns(): Promise<WeeklyTaxRun[]> {
  const { data } = await apiClient.get<WeeklyTaxRun[]>('/ledger/weekly-tax/runs');
  return data;
}

export async function runWeeklyTaxNow(reason: string): Promise<WeeklyTaxRun> {
  const { data } = await apiClient.post<WeeklyTaxRun>('/ledger/weekly-tax/run-now', { reason });
  return data;
}

export interface PaginatedBalances {
  items: BalanceEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchBalances(params: { page?: number; pageSize?: number } = {}): Promise<PaginatedBalances> {
  const { data } = await apiClient.get<PaginatedBalances>('/public/balances', { params });
  return data;
}

export async function fetchCharacters(): Promise<Character[]> {
  const { data } = await apiClient.get<Character[]>('/characters');
  return data;
}

export async function updateCharacter(id: string, patch: Partial<Character>): Promise<Character> {
  const { data } = await apiClient.patch<Character>(`/characters/${id}`, patch);
  return data;
}

export async function regenerateProfileCode(id: string): Promise<Character> {
  const { data } = await apiClient.post<Character>(`/characters/${id}/regenerate-profile-code`);
  return data;
}

export async function fetchActivities(): Promise<Activity[]> {
  const { data } = await apiClient.get<Activity[]>('/activities');
  return data;
}

export async function createActivity(payload: Partial<Activity>): Promise<Activity> {
  const { data } = await apiClient.post<Activity>('/activities', payload);
  return data;
}

export async function createKnownActivity(name: string, brcValue: number): Promise<Activity> {
  const { data } = await apiClient.post<Activity>('/activities/known', { name, brcValue });
  return data;
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<Activity> {
  const { data } = await apiClient.patch<Activity>(`/activities/${id}`, patch);
  return data;
}

export async function setActivityComponents(id: string, componentActivityIds: string[]): Promise<Activity> {
  const { data } = await apiClient.put<Activity>(`/activities/${id}/components`, { componentActivityIds });
  return data;
}

export async function fetchProtections(): Promise<Protection[]> {
  const { data } = await apiClient.get<Protection[]>('/protections');
  return data;
}

export async function createProtection(payload: Omit<Protection, 'id' | 'isActive'>): Promise<Protection> {
  const { data } = await apiClient.post<Protection>('/protections', payload);
  return data;
}

export async function updateProtection(id: string, patch: Partial<Protection>): Promise<Protection> {
  const { data } = await apiClient.patch<Protection>(`/protections/${id}`, patch);
  return data;
}

export async function fetchImports(): Promise<ImportBatch[]> {
  const { data } = await apiClient.get<ImportBatch[]>('/imports');
  return data;
}

export async function uploadImport(
  file: File,
): Promise<ImportBatch & { emittedCount: number; newActivityNames: string[]; isFirstImportForDate: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/imports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  const { data } = await apiClient.get<StaffUser[]>('/users/staff');
  return data;
}

export async function createStaffUser(
  username: string,
  role: 'COUNCIL' | 'VICE_GM',
): Promise<{ user: StaffUser; generatedPassword: string }> {
  const { data } = await apiClient.post('/users/staff', { username, role });
  return data;
}

export async function resetStaffPassword(id: string): Promise<{ user: StaffUser; generatedPassword: string }> {
  const { data } = await apiClient.post(`/users/staff/${id}/reset-password`);
  return data;
}

export async function setStaffActive(id: string, isActive: boolean): Promise<StaffUser> {
  const { data } = await apiClient.patch<StaffUser>(`/users/staff/${id}/active`, { isActive });
  return data;
}

export async function uploadFile(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Perfil do membro (por código de 12 caracteres, sem login) — PREMISSAS.md seção 3.
// ---------------------------------------------------------------------------

export interface LevelChangeLogEntry {
  id: string;
  characterId: string;
  level: number;
  proofImageUrl: string | null;
  createdAt: string;
}

export interface MemberProfile {
  character: {
    id: string;
    gameName: string;
    level: number | null;
    discordId: string | null;
    avatarUrl: string | null;
    balance: number;
  };
  levelChangeLog: LevelChangeLogEntry[];
}

export async function fetchProfile(code: string): Promise<MemberProfile> {
  const { data } = await apiClient.get<MemberProfile>(`/public/profile/${code}`);
  return data;
}

export async function updateProfileDiscordId(code: string, discordId: string): Promise<MemberProfile> {
  const { data } = await apiClient.put<MemberProfile>(`/public/profile/${code}/discord`, { discordId });
  return data;
}

export async function updateProfileAvatar(code: string, file: File): Promise<MemberProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.put<MemberProfile>(`/public/profile/${code}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export interface AvatarPreset {
  key: string;
  url: string;
}

export async function fetchAvatarPresets(): Promise<AvatarPreset[]> {
  const { data } = await apiClient.get<AvatarPreset[]>('/public/profile/avatar-presets');
  return data;
}

export async function selectAvatarPreset(code: string, presetKey: string): Promise<MemberProfile> {
  const { data } = await apiClient.put<MemberProfile>(`/public/profile/${code}/avatar-preset`, { presetKey });
  return data;
}

export async function updateProfileLevel(code: string, level: number, file: File | null): Promise<MemberProfile> {
  const formData = new FormData();
  formData.append('level', String(level));
  if (file) formData.append('file', file);
  const { data } = await apiClient.put<MemberProfile>(`/public/profile/${code}/level`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function recordManualEvent(payload: {
  title: string;
  brcValueEach: number;
  proofImageUrl: string;
  characterIds: string[];
  activityId?: string | null;
  occurrenceDate?: string | null;
}) {
  const { data } = await apiClient.post('/ledger/manual-event', payload);
  return data;
}

export async function recordTransfer(payload: {
  fromCharacterId: string;
  toCharacterId: string;
  amount: number;
  proofImageUrl: string;
  reasonText?: string;
}) {
  const { data } = await apiClient.post('/ledger/transfer', payload);
  return data;
}

export async function recordManualAdjustment(payload: {
  characterIds: string[];
  amount: number;
  reasonText: string;
  proofImageUrl?: string;
}) {
  const { data } = await apiClient.post('/ledger/manual-adjustment', payload);
  return data;
}

export interface PublicFeedEntry {
  id: string;
  characterId: string;
  character: { gameName: string };
  amount: number;
  type: 'TRANSFER_OUT' | 'GM_MANUAL_ADJUSTMENT' | 'MANUAL_EVENT_EMISSION' | 'ACTIVITY_EMISSION';
  reasonText: string | null;
  proofImageUrl: string | null;
  sourceActivity: { name: string } | null;
  createdAt: string;
}

export interface PublicFeedPage {
  items: PublicFeedEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchPublicFeed(
  params: { page?: number; characterId?: string; fromDate?: string; toDate?: string } = {},
): Promise<PublicFeedPage> {
  const { data } = await apiClient.get<PublicFeedPage>('/public/feed', {
    params: {
      page: params.page,
      characterId: params.characterId || undefined,
      fromDate: params.fromDate || undefined,
      toDate: params.toDate || undefined,
    },
  });
  return data;
}

export interface PublicEvent {
  id: string;
  name: string;
  brcValue: number;
  scheduleType: 'NONE' | 'ONE_TIME' | 'RECURRING';
  scheduleOneTimeAt: string | null;
  scheduleWeekdaysUtc: number[];
  scheduleTimeUtcMinutes: number | null;
  imageUrl: string | null;
}

export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  const { data } = await apiClient.get<PublicEvent[]>('/public/events');
  return data;
}

// ---------------------------------------------------------------------------
// Anúncios (mural da home)
// ---------------------------------------------------------------------------

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchPublicAnnouncements(): Promise<Announcement[]> {
  const { data } = await apiClient.get<Announcement[]>('/public/announcements');
  return data;
}

export async function fetchAnnouncementsStaff(): Promise<Announcement[]> {
  const { data } = await apiClient.get<Announcement[]>('/announcements');
  return data;
}

export async function createAnnouncement(title: string, body: string): Promise<Announcement> {
  const { data } = await apiClient.post<Announcement>('/announcements', { title, body });
  return data;
}

export async function updateAnnouncement(id: string, patch: { title?: string; body?: string }): Promise<Announcement> {
  const { data } = await apiClient.patch<Announcement>(`/announcements/${id}`, patch);
  return data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await apiClient.delete(`/announcements/${id}`);
}

// ---------------------------------------------------------------------------
// Leilão
// ---------------------------------------------------------------------------

export type AuctionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'OPEN' | 'CLOSED';

export interface AuctionItemWithdrawalRef {
  characterId: string;
  character: { gameName: string };
}

export interface AuctionItem {
  id: string;
  auctionId: string;
  name: string;
  description: string | null;
  protectionId: string | null;
  protection: Protection | null;
  imageUrl: string | null;
  winningBidId: string | null;
  winningBid: { amount: number; character: { gameName: string } } | null;
  resolutionStatus: 'PENDING' | 'WON' | 'UNCLAIMED' | 'CANCELLED';
  cancelReason: string | null;
  diceRollDetail: unknown;
  resolvedAt: string | null;
  withdrawals: AuctionItemWithdrawalRef[];
}

export interface AuctionParticipant {
  id: string;
  auctionId: string;
  characterId: string;
  accessCode: string | null;
  character: Character;
}

export interface Auction {
  id: string;
  title: string;
  status: AuctionStatus;
  scheduledEndAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  closeReason: string | null;
  createdById: string;
  items: AuctionItem[];
  participants: AuctionParticipant[];
  approvals: { id: string; userId: string }[];
}

export async function fetchAuctionsStaff(): Promise<Auction[]> {
  const { data } = await apiClient.get<Auction[]>('/auctions');
  return data;
}

export async function fetchAuctionStaff(id: string): Promise<Auction> {
  const { data } = await apiClient.get<Auction>(`/auctions/${id}`);
  return data;
}

export async function createAuctionDraft(title: string): Promise<Auction> {
  const { data } = await apiClient.post<Auction>('/auctions', { title });
  return data;
}

export async function deleteAuctionDraft(auctionId: string): Promise<void> {
  await apiClient.delete(`/auctions/${auctionId}`);
}

// GM-only: apaga um leilão/item em qualquer status (rascunho, aberto ou
// encerrado) — diferente de deleteAuctionDraft/removeAuctionItem, que só
// funcionam em rascunho. Sempre com motivo obrigatório.
export async function forceDeleteAuction(auctionId: string, reason: string): Promise<void> {
  await apiClient.delete(`/auctions/${auctionId}/force`, { data: { reason } });
}

export async function forceDeleteAuctionItem(auctionId: string, itemId: string, reason: string): Promise<void> {
  await apiClient.delete(`/auctions/${auctionId}/items/${itemId}/force`, { data: { reason } });
}

export async function addAuctionItem(
  auctionId: string,
  payload: { name: string; description?: string; protectionId?: string | null; imageUrl?: string | null },
): Promise<AuctionItem> {
  const { data } = await apiClient.post<AuctionItem>(`/auctions/${auctionId}/items`, payload);
  return data;
}

export async function removeAuctionItem(auctionId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/auctions/${auctionId}/items/${itemId}`);
}

export async function cancelAuctionItem(auctionId: string, itemId: string, reason: string): Promise<AuctionItem> {
  const { data } = await apiClient.post<AuctionItem>(`/auctions/${auctionId}/items/${itemId}/cancel`, { reason });
  return data;
}

export async function closeAuction(auctionId: string, reason: string): Promise<Auction> {
  const { data } = await apiClient.post<Auction>(`/auctions/${auctionId}/close`, { reason });
  return data;
}

export async function setAuctionParticipants(auctionId: string, characterIds: string[]): Promise<Auction> {
  const { data } = await apiClient.put<Auction>(`/auctions/${auctionId}/participants`, { characterIds });
  return data;
}

export async function setAuctionSchedule(auctionId: string, scheduledEndAt: string): Promise<Auction> {
  const { data } = await apiClient.put<Auction>(`/auctions/${auctionId}/schedule`, { scheduledEndAt });
  return data;
}

export async function approveAuction(auctionId: string): Promise<Auction> {
  const { data } = await apiClient.post<Auction>(`/auctions/${auctionId}/approve`);
  return data;
}

export interface PublicAuctionSummary {
  id: string;
  title: string;
  status: AuctionStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  items: { id: string }[];
}

export async function fetchPublicAuctions(): Promise<PublicAuctionSummary[]> {
  const { data } = await apiClient.get<PublicAuctionSummary[]>('/public/auctions');
  return data;
}

export interface PublicAuctionBid {
  id: string;
  characterId: string;
  amount: number;
  placedAt: string;
  character: { gameName: string };
}

export interface PublicAuctionItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  protection: Protection | null;
  resolutionStatus: 'PENDING' | 'WON' | 'UNCLAIMED' | 'CANCELLED';
  cancelReason: string | null;
  diceRollDetail: unknown;
  bids: PublicAuctionBid[];
  winningBid: (PublicAuctionBid & { character: { gameName: string } }) | null;
  withdrawals: { characterId: string }[];
}

export interface PublicAuctionDetail {
  id: string;
  title: string;
  status: AuctionStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  closeReason: string | null;
  items: PublicAuctionItem[];
}

export async function fetchPublicAuctionDetail(id: string): Promise<PublicAuctionDetail> {
  const { data } = await apiClient.get<PublicAuctionDetail>(`/public/auctions/${id}`);
  return data;
}

export interface PlayerAuctionItemView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  protection: Protection | null;
  eligible: boolean;
  leadingAmount: number;
  minBid: number;
  ownAmount: number;
  won: boolean;
  bidCount: number;
  withdrawn: boolean;
  resolutionStatus: 'PENDING' | 'WON' | 'UNCLAIMED' | 'CANCELLED';
  cancelReason: string | null;
}

export interface PlayerAuctionView {
  character: { id: string; gameName: string; level: number | null };
  auction: { id: string; title: string; status: AuctionStatus; expiresAt: string | null };
  isActive: boolean;
  walletBalance: number;
  availableBalance: number;
  items: PlayerAuctionItemView[];
}

export async function fetchPlayerAuctionView(code: string): Promise<PlayerAuctionView> {
  const { data } = await apiClient.get<PlayerAuctionView>(`/player-auctions/${code}`);
  return data;
}

export async function placePlayerBid(code: string, itemId: string, amount: number) {
  const { data } = await apiClient.post(`/player-auctions/${code}/items/${itemId}/bids`, { amount });
  return data;
}

export async function withdrawPlayerBid(code: string, itemId: string) {
  const { data } = await apiClient.post(`/player-auctions/${code}/items/${itemId}/withdraw`);
  return data;
}
