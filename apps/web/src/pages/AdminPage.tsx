import { useEffect, useState, useCallback } from 'react'
import {
  IoArrowBackOutline,
  IoShieldOutline,
  IoPeopleOutline,
  IoStatsChartOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoPersonOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoEllipsisHorizontalOutline,
  IoReloadOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoChevronDownOutline,
  IoTimeOutline,
  IoKeyOutline,
  IoMailOutline,
  IoTrendingUpOutline,
  IoTrashOutline,
  IoBanOutline,
  IoPencilOutline,
} from 'react-icons/io5'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/features'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/ui/Toast'
import { adminApi, type AdminUser, type AdminStats, type AuditLogEntry } from '@/services/api'
import { getAvatarRingClass } from '@/utils/avatar'

type Tab = 'users' | 'stats' | 'logs'

export function AdminPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('users')

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-text-primary) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <header className="mb-6 sm:mb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-5">
              <Link to="/">
                <button className="group p-2.5 rounded-xl bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/5 transition-all duration-300">
                  <IoArrowBackOutline className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
                </button>
              </Link>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
                  <IoShieldOutline className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
                    {t('admin.title')}
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--color-text-tertiary)] hidden xs:block">
                    {t('admin.subtitle', 'Gérer les utilisateurs et paramètres')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <nav className="mb-6 sm:mb-8">
          <div className="flex sm:inline-flex w-full sm:w-auto p-1 sm:p-1.5 rounded-2xl bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border-subtle)] shadow-sm">
            <TabButton
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              icon={<IoPeopleOutline className="w-4 h-4" />}
              label={t('admin.tabs.users')}
            />
            <TabButton
              active={activeTab === 'stats'}
              onClick={() => setActiveTab('stats')}
              icon={<IoStatsChartOutline className="w-4 h-4" />}
              label={t('admin.tabs.stats')}
            />
            <TabButton
              active={activeTab === 'logs'}
              onClick={() => setActiveTab('logs')}
              icon={<IoDocumentTextOutline className="w-4 h-4" />}
              label={t('admin.tabs.logs')}
            />
          </div>
        </nav>

        <main className="animate-fade-in">
          {activeTab === 'users' && <UsersSection />}
          {activeTab === 'stats' && <StatsSection />}
          {activeTab === 'logs' && <AuditLogsSection />}
        </main>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center justify-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium
        transition-all duration-300 ease-out
        ${active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-sm'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
        }
      `}
    >
      <span className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
        {icon}
      </span>
      {label}
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[var(--color-accent)]" />
      )}
    </button>
  )
}

function UsersSection() {
  const { t, i18n } = useTranslation()
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [actionType, setActionType] = useState<'disable' | 'enable' | 'delete' | 'promote' | 'demote' | 'rename' | 'send-reset' | null>(null)
  const [disableReason, setDisableReason] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const formatAdminDate = (date: string | undefined) => {
    if (!date) return '-'
    const d = new Date(typeof date === 'string' && /^\d+$/.test(date) ? Number(date) * 1000 : date)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await adminApi.listUsers({
        page,
        limit,
        search: searchQuery || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setUsers(result.users)
      setTotal(result.pagination.total)
    } catch {
      toast.error(t('admin.users.fetch_error'))
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery, statusFilter, t])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleAction = async () => {
    if (!selectedUser || !actionType) return

    setIsActionLoading(true)
    try {
      switch (actionType) {
        case 'disable':
          await adminApi.disableUser(selectedUser.id, disableReason || undefined)
          toast.success(t('admin.users.disabled'))
          break
        case 'enable':
          await adminApi.enableUser(selectedUser.id)
          toast.success(t('admin.users.enabled'))
          break
        case 'delete':
          await adminApi.deleteUser(selectedUser.id)
          toast.success(t('admin.users.deleted'))
          break
        case 'promote':
          await adminApi.changeUserRole(selectedUser.id, 'admin')
          toast.success(t('admin.users.promoted'))
          break
        case 'demote':
          await adminApi.changeUserRole(selectedUser.id, 'user')
          toast.success(t('admin.users.demoted'))
          break
        case 'rename':
          await adminApi.changeUsername(selectedUser.id, newUsername)
          toast.success(t('admin.users.username_changed'))
          break
        case 'send-reset':
          await adminApi.sendPasswordReset(selectedUser.id)
          toast.success(t('admin.users.reset_sent'))
          break
      }
      fetchUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('USERNAME_EXISTS')) {
        toast.error(t('admin.users.username_taken'))
      } else {
        toast.error(t('admin.users.action_error'))
      }
    } finally {
      setIsActionLoading(false)
      setSelectedUser(null)
      setActionType(null)
      setDisableReason('')
      setNewUsername('')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4 pb-32">
      <div className="flex gap-2 sm:gap-3 flex-wrap mb-4 sm:mb-6">
        <div className="relative flex-1 min-w-0">
          <IoSearchOutline className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            placeholder={t('admin.users.search_placeholder')}
            className="w-full h-10 sm:h-11 pl-9 sm:pl-11 pr-3 sm:pr-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'disabled')
              setPage(1)
            }}
            className="h-10 sm:h-11 pl-3 sm:pl-4 pr-8 sm:pr-10 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 appearance-none cursor-pointer transition-all duration-200 font-medium text-xs sm:text-sm"
          >
            <option value="all">{t('admin.users.status_all')}</option>
            <option value="active">{t('admin.users.status_active')}</option>
            <option value="disabled">{t('admin.users.status_disabled')}</option>
          </select>
          <IoChevronDownOutline className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" />
        </div>
      </div>

      <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <IoReloadOutline className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">{t('common.loading')}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center">
              <IoPeopleOutline className="w-8 h-8 text-[var(--color-text-tertiary)] opacity-50" />
            </div>
            <p className="text-base font-medium text-[var(--color-text-secondary)]">{t('admin.users.no_users')}</p>
            <p className="text-sm mt-1 text-[var(--color-text-tertiary)]">{t('admin.users.no_users_hint', 'Aucun utilisateur ne correspond à vos critères')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {users.map((user) => (
              <div
                key={user.id}
                className={`group flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 hover:bg-[var(--color-bg-tertiary)] transition-colors duration-150 ${
                  user.isDisabled ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover shadow-md ring-2 ${getAvatarRingClass(user.avatarColor)}`}
                      />
                    ) : (
                      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] font-semibold text-sm sm:text-base shadow-md ring-2 ${getAvatarRingClass(user.avatarColor)}`}>
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                      <p className="font-semibold text-[var(--color-text-primary)] truncate text-sm sm:text-[15px]">
                        {user.username}
                      </p>
                      {user.role === 'admin' && (
                        <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                          Admin
                        </span>
                      )}
                      {user.isDisabled && (
                        <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider rounded-md bg-red-500/15 text-red-500 dark:text-red-400">
                          {t('admin.users.disabled_badge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                      {user.email && (
                        <p className="text-xs sm:text-sm text-[var(--color-text-tertiary)] truncate max-w-[120px] sm:max-w-none">
                          {user.email}
                        </p>
                      )}
                      {user.emailVerified && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500 flex-shrink-0" title={t('profile.email_verified')}>
                          <IoCheckmarkCircleOutline className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {user.twoFactorEnabled && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500 flex-shrink-0" title={t('admin.users.2fa_enabled')}>
                          <IoKeyOutline className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      <span>{t('admin.users.created')} {formatAdminDate(user.createdAt)}</span>
                      {user.lastLoginAt && (
                        <span>· {t('admin.users.last_login')} {formatAdminDate(user.lastLoginAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {user.id !== currentUser?.id && (
                  <div className="relative flex-shrink-0 ml-1">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                      className="p-2.5 sm:p-2.5 rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all duration-200"
                    >
                      <IoEllipsisHorizontalOutline className="w-5 h-5" />
                    </button>

                    {openMenuId === user.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 sm:right-0 top-full mt-2 z-50 min-w-[200px] max-w-[calc(100vw-2rem)] bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border)] shadow-xl py-2 animate-fade-in">
                          {user.isDisabled ? (
                            <MenuButton
                              onClick={() => {
                                setSelectedUser(user)
                                setActionType('enable')
                                setOpenMenuId(null)
                              }}
                              icon={<IoCheckmarkCircleOutline className="w-4 h-4 text-emerald-500" />}
                              label={t('admin.users.enable')}
                              variant="success"
                            />
                          ) : (
                            <MenuButton
                              onClick={() => {
                                setSelectedUser(user)
                                setActionType('disable')
                                setOpenMenuId(null)
                              }}
                              icon={<IoBanOutline className="w-4 h-4" />}
                              label={t('admin.users.disable')}
                            />
                          )}

                          <MenuButton
                            onClick={() => {
                              setSelectedUser(user)
                              setActionType('rename')
                              setNewUsername(user.username)
                              setOpenMenuId(null)
                            }}
                            icon={<IoPencilOutline className="w-4 h-4" />}
                            label={t('admin.users.rename')}
                          />

                          {user.emailVerified && user.email && (
                            <MenuButton
                              onClick={() => {
                                setSelectedUser(user)
                                setActionType('send-reset')
                                setOpenMenuId(null)
                              }}
                              icon={<IoMailOutline className="w-4 h-4" />}
                              label={t('admin.users.send_reset')}
                            />
                          )}

                          <div className="h-px bg-[var(--color-border)] my-2 mx-2" />

                          {user.role === 'admin' ? (
                            <MenuButton
                              onClick={() => {
                                setSelectedUser(user)
                                setActionType('demote')
                                setOpenMenuId(null)
                              }}
                              icon={<IoPersonOutline className="w-4 h-4" />}
                              label={t('admin.users.demote')}
                              tooltip={t('admin.users.demote_tooltip')}
                            />
                          ) : (
                            <MenuButton
                              onClick={() => {
                                setSelectedUser(user)
                                setActionType('promote')
                                setOpenMenuId(null)
                              }}
                              icon={<IoShieldOutline className="w-4 h-4 text-[var(--color-accent)]" />}
                              label={t('admin.users.promote')}
                              variant="accent"
                              tooltip={t('admin.users.promote_tooltip')}
                            />
                          )}

                          <MenuButton
                            onClick={() => {
                              setSelectedUser(user)
                              setActionType('delete')
                              setOpenMenuId(null)
                            }}
                            icon={<IoTrashOutline className="w-4 h-4" />}
                            label={t('admin.users.delete')}
                            variant="danger"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50">
            <p className="text-xs sm:text-sm text-[var(--color-text-tertiary)]">
              <span className="font-medium text-[var(--color-text-secondary)]">{page}</span>/<span className="font-medium text-[var(--color-text-secondary)]">{totalPages}</span>
              <span className="mx-1.5 sm:mx-2">·</span>
              <span className="font-medium text-[var(--color-text-secondary)]">{total}</span> <span className="hidden sm:inline">utilisateurs</span>
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)] disabled:hover:text-inherit transition-all duration-150"
              >
                <IoChevronBackOutline className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)] disabled:hover:text-inherit transition-all duration-150"
              >
                <IoChevronForwardOutline className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <ConfirmDialog
          isOpen={actionType === 'disable'}
          onClose={() => {
            setSelectedUser(null)
            setActionType(null)
            setDisableReason('')
          }}
          onConfirm={handleAction}
          title={t('admin.users.disable_title')}
          message={t('admin.users.disable_message', { name: selectedUser.username })}
          confirmLabel={t('admin.users.disable')}
          isLoading={isActionLoading}
        />
      )}

      {selectedUser && (
        <ConfirmDialog
          isOpen={actionType === 'enable'}
          onClose={() => {
            setSelectedUser(null)
            setActionType(null)
          }}
          onConfirm={handleAction}
          title={t('admin.users.enable_title')}
          message={t('admin.users.enable_message', { name: selectedUser.username })}
          confirmLabel={t('admin.users.enable')}
          isLoading={isActionLoading}
        />
      )}

      {selectedUser && (
        <ConfirmDialog
          isOpen={actionType === 'delete'}
          onClose={() => {
            setSelectedUser(null)
            setActionType(null)
          }}
          onConfirm={handleAction}
          title={t('admin.users.delete_title')}
          message={t('admin.users.delete_message', { name: selectedUser.username })}
          confirmLabel={t('admin.users.delete')}
          isLoading={isActionLoading}
          variant="danger"
        />
      )}

      {selectedUser && (
        <ConfirmDialog
          isOpen={actionType === 'promote' || actionType === 'demote'}
          onClose={() => {
            setSelectedUser(null)
            setActionType(null)
          }}
          onConfirm={handleAction}
          title={actionType === 'promote' ? t('admin.users.promote_title') : t('admin.users.demote_title')}
          message={
            actionType === 'promote'
              ? t('admin.users.promote_message', { name: selectedUser.username })
              : t('admin.users.demote_message', { name: selectedUser.username })
          }
          confirmLabel={actionType === 'promote' ? t('admin.users.promote') : t('admin.users.demote')}
          isLoading={isActionLoading}
        />
      )}

      {selectedUser && (
        <ConfirmDialog
          isOpen={actionType === 'rename'}
          onClose={() => {
            setSelectedUser(null)
            setActionType(null)
            setNewUsername('')
          }}
          onConfirm={handleAction}
          title={t('admin.users.rename_title')}
          message={t('admin.users.rename_message', { name: selectedUser.username })}
          confirmLabel={t('admin.users.rename_confirm')}
          isLoading={isActionLoading}
        >
          <div className="mt-3 space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t('admin.users.new_username')}
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
              placeholder={t('admin.users.new_username_placeholder')}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors font-mono"
              autoFocus
            />
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              {t('admin.users.username_rules')}
            </p>
          </div>
        </ConfirmDialog>
      )}

      {selectedUser && (
        <ConfirmDialog
          isOpen={actionType === 'send-reset'}
          onClose={() => {
            setSelectedUser(null)
            setActionType(null)
          }}
          onConfirm={handleAction}
          title={t('admin.users.send_reset_title')}
          message={t('admin.users.send_reset_message', { name: selectedUser.username })}
          confirmLabel={t('admin.users.send_reset')}
          isLoading={isActionLoading}
        />
      )}
    </div>
  )
}

function MenuButton({
  onClick,
  icon,
  label,
  variant = 'default',
  tooltip,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  variant?: 'default' | 'danger' | 'success' | 'accent'
  tooltip?: string
}) {
  const variantStyles = {
    default: 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
    danger: 'text-red-500 hover:bg-red-500/10',
    success: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
    accent: 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10',
  }

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-sm font-medium transition-all duration-150 ${variantStyles[variant]}`}
    >
      {icon}
      {label}
    </button>
  )
}

function StatsSection() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { stats: data } = await adminApi.getStats()
        setStats(data)
      } catch {
        toast.error(t('admin.stats.fetch_error'))
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [t])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <IoReloadOutline className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
          <p className="text-sm text-[var(--color-text-tertiary)]">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-[var(--color-text-tertiary)]">
        <IoStatsChartOutline className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="text-lg">{t('admin.stats.no_data')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          icon={<IoPeopleOutline className="w-7 h-7" />}
          label={t('admin.stats.total_users')}
          value={stats.totalUsers}
          color="accent"
          featured
        />
        <StatCard
          icon={<IoCheckmarkCircleOutline className="w-7 h-7" />}
          label={t('admin.stats.active_users')}
          value={stats.activeUsers}
          color="green"
          trend={stats.totalUsers > 0 ? Math.round(((stats.activeUsers ?? 0) / stats.totalUsers) * 100) : undefined}
          trendLabel="% actifs"
        />
        <StatCard
          icon={<IoCloseCircleOutline className="w-7 h-7" />}
          label={t('admin.stats.disabled_users')}
          value={stats.disabledUsers}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCardCompact
          icon={<IoShieldOutline className="w-5 h-5" />}
          label={t('admin.stats.admin_count')}
          value={stats.adminCount}
          color="accent"
        />
        <StatCardCompact
          icon={<IoMailOutline className="w-5 h-5" />}
          label={t('admin.stats.users_with_email')}
          value={stats.usersWithEmail}
          color="blue"
        />
        <StatCardCompact
          icon={<IoKeyOutline className="w-5 h-5" />}
          label={t('admin.stats.users_with_2fa')}
          value={stats.usersWith2FA}
          color="green"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color = 'default',
  featured = false,
  trend,
  trendLabel,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color?: 'default' | 'green' | 'red' | 'accent' | 'blue'
  featured?: boolean
  trend?: number
  trendLabel?: string
}) {
  const colorConfig = {
    default: {
      iconBg: 'bg-[var(--color-bg-tertiary)]',
      iconText: 'text-[var(--color-text-secondary)]',
      accent: 'var(--color-text-tertiary)',
    },
    green: {
      iconBg: 'bg-emerald-500/10',
      iconText: 'text-emerald-500',
      accent: 'rgb(16, 185, 129)',
    },
    red: {
      iconBg: 'bg-red-500/10',
      iconText: 'text-red-500',
      accent: 'rgb(239, 68, 68)',
    },
    accent: {
      iconBg: 'bg-[var(--color-accent)]/10',
      iconText: 'text-[var(--color-accent)]',
      accent: 'var(--color-accent)',
    },
    blue: {
      iconBg: 'bg-blue-500/10',
      iconText: 'text-blue-500',
      accent: 'rgb(59, 130, 246)',
    },
  }

  const config = colorConfig[color]

  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border transition-all duration-300
        ${featured
          ? 'bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] border-[var(--color-accent)]/20 shadow-lg shadow-[var(--color-accent)]/5 hover:shadow-xl hover:shadow-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/40'
          : 'bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm border-[var(--color-border-subtle)] hover:border-[var(--color-border)] hover:shadow-md'
        }
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      <div className="relative p-4 sm:p-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className={`p-2.5 sm:p-3 rounded-xl ${config.iconBg} ${config.iconText}`}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 text-emerald-500">
              <IoTrendingUpOutline className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="text-[10px] sm:text-xs font-semibold">{trend}{trendLabel}</span>
            </div>
          )}
        </div>

        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {(value ?? 0).toLocaleString()}
          </p>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

function StatCardCompact({
  icon,
  label,
  value,
  color = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: number
  color?: 'default' | 'green' | 'red' | 'accent' | 'blue'
}) {
  const colorConfig = {
    default: { iconText: 'text-[var(--color-text-secondary)]' },
    green: { iconText: 'text-emerald-500' },
    red: { iconText: 'text-red-500' },
    accent: { iconText: 'text-[var(--color-accent)]' },
    blue: { iconText: 'text-blue-500' },
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-all duration-200">
      <div className={colorConfig[color].iconText}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{(value ?? 0).toLocaleString()}</p>
        <p className="text-[10px] sm:text-xs text-[var(--color-text-tertiary)] truncate">{label}</p>
      </div>
    </div>
  )
}

function AuditLogsSection() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true)
      try {
        const result = await adminApi.getAuditLogs({ page, limit })
        setLogs(result.logs)
        setTotalPages(result.pagination.totalPages)
        setTotal(result.pagination.total)
      } catch {
        toast.error(t('admin.logs.fetch_error'))
      } finally {
        setIsLoading(false)
      }
    }
    fetchLogs()
  }, [page, t])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const getActionConfig = (action: string): { label: string; color: 'default' | 'green' | 'red' | 'accent' | 'blue' | 'orange' } => {
    const configs: Record<string, { label: string; color: 'default' | 'green' | 'red' | 'accent' | 'blue' | 'orange' }> = {
      USER_LISTED: { label: t('admin.logs.actions.user_listed'), color: 'default' },
      USER_VIEWED: { label: t('admin.logs.actions.user_viewed'), color: 'blue' },
      USER_DISABLED: { label: t('admin.logs.actions.user_disabled'), color: 'red' },
      USER_ENABLED: { label: t('admin.logs.actions.user_enabled'), color: 'green' },
      USER_DELETED: { label: t('admin.logs.actions.user_deleted'), color: 'red' },
      USER_ROLE_CHANGED: { label: t('admin.logs.actions.user_role_changed'), color: 'orange' },
      USER_PASSWORD_RESET_SENT: { label: t('admin.logs.actions.user_password_reset_sent'), color: 'orange' },
      SETTINGS_UPDATED: { label: t('admin.logs.actions.settings_updated'), color: 'accent' },
      AUDIT_LOGS_VIEWED: { label: t('admin.logs.actions.audit_logs_viewed'), color: 'default' },
      ADMIN_LOGIN: { label: t('admin.logs.actions.admin_login'), color: 'accent' },
    }
    return configs[action] || { label: action, color: 'default' }
  }

  const getActionBadgeStyles = (color: string) => {
    const styles: Record<string, string> = {
      default: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]',
      green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      accent: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20',
      blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    }
    return styles[color] || styles.default
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <IoReloadOutline className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm rounded-2xl border border-[var(--color-border-subtle)] overflow-hidden shadow-sm">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-text-tertiary)]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center">
              <IoDocumentTextOutline className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-lg font-medium text-[var(--color-text-secondary)]">{t('admin.logs.no_logs')}</p>
            <p className="text-sm mt-1">{t('admin.logs.no_logs_hint', 'Aucune activité enregistrée')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {logs.map((log) => {
              const actionConfig = getActionConfig(log.action)
              return (
                <div
                  key={log.id}
                  className="group flex items-start sm:items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-[var(--color-bg-tertiary)]/50 transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mt-0.5 sm:mt-0">
                    <IoDocumentTextOutline className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text-tertiary)]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-md border ${getActionBadgeStyles(actionConfig.color)}`}>
                        {actionConfig.label}
                      </span>
                      {log.targetUsername && (
                        <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                          → <span className="font-medium">@{log.targetUsername}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-[var(--color-text-tertiary)]">
                      <span className="flex items-center gap-1">
                        <IoPersonOutline className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        @{log.adminUsername}
                      </span>
                      <span className="flex items-center gap-1">
                        <IoTimeOutline className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-xs sm:text-sm text-[var(--color-text-tertiary)]">
              <span className="font-medium text-[var(--color-text-secondary)]">{page}</span>
              <span className="mx-1 sm:mx-1.5">/</span>
              <span>{totalPages}</span>
              <span className="mx-1.5 sm:mx-2 text-[var(--color-border)]">•</span>
              <span>{total} <span className="hidden sm:inline">{t('admin.logs.entries', 'entrées')}</span></span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-subtle)] disabled:hover:bg-[var(--color-bg-secondary)] transition-all duration-200"
              >
                <IoChevronBackOutline className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-subtle)] disabled:hover:bg-[var(--color-bg-secondary)] transition-all duration-200"
              >
                <IoChevronForwardOutline className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPage
