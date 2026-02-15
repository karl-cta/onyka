import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { IoCloseOutline, IoPeopleOutline, IoPersonAddOutline, IoTrashOutline, IoChevronDownOutline, IoSyncOutline, IoSearchOutline, IoClose } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import type { Permission, Collaborator, ResourceType } from '@onyka/shared'
import { sharesApi, usersApi, type UserSearchResult } from '@/services/api'
import { getInitials } from '@/utils/format'
import { getAvatarRingClass } from '@/utils/avatar'
import { useSharesStore } from '@/stores/shares'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  resourceId: string
  resourceType: ResourceType
  resourceTitle: string
}

function usePermissionOptions() {
  const { t } = useTranslation()
  return [
    { value: 'read' as Permission, label: t('share.permissions.read'), description: t('share.permissions.read_desc') },
    { value: 'edit' as Permission, label: t('share.permissions.edit'), description: t('share.permissions.edit_desc') },
    { value: 'admin' as Permission, label: t('share.permissions.admin'), description: t('share.permissions.admin_desc') },
  ]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function ShareDialog({
  isOpen,
  onClose,
  resourceId,
  resourceType,
  resourceTitle,
}: ShareDialogProps) {
  const { t } = useTranslation()
  const permissionOptions = usePermissionOptions()
  const fetchMyShares = useSharesStore((s) => s.fetchMyShares)
  const focusTrapRef = useFocusTrap(isOpen)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [permission, setPermission] = useState<Permission>('read')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false)

  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)

  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const debouncedUsername = useDebounce(username, 300)

  useEffect(() => {
    const searchUsers = async () => {
      if (debouncedUsername.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setIsSearching(true)
      try {
        const { users } = await usersApi.search(debouncedUsername)
        const filtered = users.filter(
          (u) => !collaborators.some((c) => c.username === u.username)
        )
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
        setSelectedIndex(-1)
      } catch (err) {
        console.error('Failed to search users:', err)
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }

    searchUsers()
  }, [debouncedUsername, collaborators])

  useEffect(() => {
    if (isOpen && resourceId) {
      loadCollaborators()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resourceId])

  const loadCollaborators = async () => {
    setIsLoading(true)
    try {
      const { collaborators: data } = await sharesApi.getForResource(resourceType, resourceId)
      setCollaborators(data)
    } catch (err) {
      console.error('Failed to load collaborators:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectUser = useCallback((user: UserSearchResult) => {
    setUsername(user.username)
    setSelectedUser(user)
    setShowSuggestions(false)
    setSuggestions([])
  }, [])

  const handleClearSelectedUser = useCallback(() => {
    setUsername('')
    setSelectedUser(null)
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [])

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    setIsAdding(true)
    setError(null)
    try {
      await sharesApi.create({
        resourceId,
        resourceType,
        username: username.trim(),
        permission,
      })
      setUsername('')
      setSelectedUser(null)
      setPermission('read')
      setSuggestions([])
      setShowSuggestions(false)
      await loadCollaborators()
      fetchMyShares()
    } catch {
      setError(t('share.add_error'))
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    try {
      await sharesApi.delete(collaboratorId)
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
      fetchMyShares()
    } catch (err) {
      console.error('Failed to remove collaborator:', err)
    }
  }

  const handleUpdatePermission = async (collaboratorId: string, newPermission: Permission) => {
    try {
      await sharesApi.update(collaboratorId, newPermission)
      setCollaborators((prev) =>
        prev.map((c) => (c.id === collaboratorId ? { ...c, permission: newPermission } : c))
      )
    } catch (err) {
      console.error('Failed to update permission:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault()
          handleSelectUser(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label={t('share.title')} className="relative w-full max-w-lg bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl border border-[var(--color-border)] animate-scale-in">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--color-accent)]/10">
              <IoPeopleOutline className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t('share.title')}
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {t('share.description')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-xl transition-colors"
          >
            <IoCloseOutline className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </header>

        <form onSubmit={handleAddCollaborator} className="px-6 py-4 border-b border-[var(--color-border)]">
          <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 block">
            {t('share.share_with')}
          </label>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 relative">
              {selectedUser ? (
                <div className="flex items-center gap-2 h-9 pl-2 pr-1 bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-accent)] rounded-xl">
                  {selectedUser.avatarUrl ? (
                    <img
                      src={selectedUser.avatarUrl}
                      alt={selectedUser.username}
                      className={`w-6 h-6 rounded-full object-cover ring-1.5 ${getAvatarRingClass(selectedUser.avatarColor)}`}
                    />
                  ) : (
                    <div className={`w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] text-[10px] font-medium ring-1.5 ${getAvatarRingClass(selectedUser.avatarColor)}`}>
                      {getInitials(selectedUser.username)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {selectedUser.username}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedUser}
                    aria-label={t('common.clear')}
                    className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                  >
                    <IoClose className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        setError(null)
                      }}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('share.username_placeholder')}
                      className="w-full pl-9 pr-3 h-9 bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-accent)]/40 rounded-xl text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-[var(--color-accent)] transition-shadow"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <IoSyncOutline className="w-4 h-4 animate-spin text-[var(--color-text-tertiary)]" />
                      </div>
                    )}
                  </div>

                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto"
                    >
                      {suggestions.map((user, index) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectUser(user)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            index === selectedIndex
                              ? 'bg-[var(--color-accent)]/10'
                              : 'hover:bg-[var(--color-bg-tertiary)]'
                          }`}
                        >
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.username}
                              className={`w-8 h-8 rounded-full object-cover ring-2 ${getAvatarRingClass(user.avatarColor)}`}
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] text-xs font-medium ring-2 ${getAvatarRingClass(user.avatarColor)}`}>
                              {getInitials(user.username)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {user.username}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPermissionDropdown(!showPermissionDropdown)}
                className="flex items-center gap-1.5 px-3 h-9 bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:ring-[var(--color-accent)]/40 transition-all text-sm whitespace-nowrap"
              >
                {permissionOptions.find((p) => p.value === permission)?.label}
                <IoChevronDownOutline className="w-3.5 h-3.5" />
              </button>
              {showPermissionDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPermissionDropdown(false)} />
                  <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg z-20 overflow-hidden animate-scale-in py-1">
                    {permissionOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setPermission(opt.value)
                          setShowPermissionDropdown(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                          permission === opt.value ? 'bg-[var(--color-accent)]/10' : ''
                        }`}
                      >
                        <div className={`text-sm font-medium ${permission === opt.value ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                          {opt.label}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          {opt.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={isAdding || !username.trim()}
              className="flex items-center gap-1.5 px-4 h-9 bg-[var(--color-accent)] text-white rounded-xl hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 text-sm font-medium"
            >
              {isAdding ? (
                <IoSyncOutline className="w-4 h-4 animate-spin" />
              ) : (
                <IoPersonAddOutline className="w-4 h-4" />
              )}
              {t('share.add_collaborator')}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}
        </form>

        <div className="min-h-[200px] max-h-72 overflow-y-auto">
          <div className="px-6 py-3 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
            {t('share.collaborators')}
          </div>
          {isLoading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <IoSyncOutline className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
              <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                {t('common.loading')}
              </p>
            </div>
          ) : collaborators.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mx-auto mb-3">
                <IoPeopleOutline className="w-6 h-6 text-[var(--color-text-tertiary)] opacity-50" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {t('share.no_collaborators')}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {t('share.no_collaborators_hint')}
              </p>
            </div>
          ) : (
            <div className="pb-2">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  className="flex items-center gap-3 px-6 py-2.5 hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  {collaborator.avatarUrl ? (
                    <img
                      src={collaborator.avatarUrl}
                      alt={collaborator.username}
                      className={`w-9 h-9 rounded-full object-cover shadow-sm ring-2 ${getAvatarRingClass(collaborator.avatarColor)}`}
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] text-sm font-medium shadow-sm ring-2 ${getAvatarRingClass(collaborator.avatarColor)}`}>
                      {getInitials(collaborator.username)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {collaborator.username}
                    </div>
                  </div>

                  <select
                    value={collaborator.permission}
                    onChange={(e) =>
                      handleUpdatePermission(collaborator.id, e.target.value as Permission)
                    }
                    className="px-2.5 py-1.5 text-xs bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] focus:outline-none focus:ring-[var(--color-accent)]/60 transition-shadow"
                  >
                    {permissionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleRemoveCollaborator(collaborator.id)}
                    aria-label={t('common.remove')}
                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors"
                  >
                    <IoTrashOutline className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-[var(--color-border)] rounded-b-2xl">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {collaborators.length > 0
              ? `${collaborators.length} ${t('share.collaborators').toLowerCase()}`
              : resourceTitle}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
