import { LoaderCircle, LogOut, Monitor, Moon, RefreshCw, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigError } from './lib/supabase'
import './App.css'

const THEME_KEY = 'summerbuild.todo-list.theme'

const filterOptions = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
]

const priorityOptions = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
]

const defaultTagPlaceholder = 'work, home, errand'

const themeOptions = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'auto', label: 'Auto', icon: Monitor },
]

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDueTimestamp(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function buildDueTimestamp(dateValue, timeValue) {
  if (!dateValue && !timeValue) {
    return null
  }

  if (!dateValue || !timeValue) {
    return undefined
  }

  return new Date(`${dateValue}T${timeValue}`).toISOString()
}

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  return themeOptions.some((option) => option.key === stored) ? stored : 'auto'
}

function mapTodo(row) {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    priority: row.priority,
    dueAt: row.due_at,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
  }
}

function parseTags(value) {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
}

function App() {
  const [session, setSession] = useState(null)
  const [todos, setTodos] = useState([])
  const [theme, setTheme] = useState(loadTheme)
  const [draft, setDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeTag, setActiveTag] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [authMode, setAuthMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loadingAuth, setLoadingAuth] = useState(Boolean(supabase))
  const [loadingTodos, setLoadingTodos] = useState(false)
  const [submittingAuth, setSubmittingAuth] = useState(false)
  const [savingTodo, setSavingTodo] = useState(false)

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)

    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function applyTheme() {
      const resolvedTheme =
        theme === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : theme

      root.dataset.theme = resolvedTheme
    }

    applyTheme()

    if (theme === 'auto') {
      mediaQuery.addEventListener('change', applyTheme)
    }

    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let active = true

    async function bootstrapSession() {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession()

      if (!active) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
      }

      setSession(currentSession)
      if (!currentSession) {
        setTodos([])
      }
      setLoadingAuth(false)
    }

    bootstrapSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setTodos([])
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      return undefined
    }

    let active = true

    async function loadTodos() {
      setLoadingTodos(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('todos')
        .select('id, text, completed, priority, due_at, tags, created_at')
        .order('created_at', { ascending: false })

      if (!active) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
        setTodos([])
      } else {
        setTodos(data.map(mapTodo))
      }

      setLoadingTodos(false)
    }

    loadTodos()

    return () => {
      active = false
    }
  }, [session])

  const counts = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length
    const active = todos.length - completed

    return {
      total: todos.length,
      active,
      completed,
      percent: todos.length ? Math.round((completed / todos.length) * 100) : 0,
    }
  }, [todos])

  const availableTags = useMemo(
    () => [...new Set(todos.flatMap((todo) => todo.tags))].sort((left, right) => left.localeCompare(right)),
    [todos],
  )
  const selectedTag =
    activeTag === 'all' || availableTags.includes(activeTag) ? activeTag : 'all'

  const visibleTodos = useMemo(() => {
    const filterByState = (() => {
      if (filter === 'active') {
        return todos.filter((todo) => !todo.completed)
      }

      if (filter === 'completed') {
        return todos.filter((todo) => todo.completed)
      }

      return todos
    })()

    if (selectedTag === 'all') {
      return filterByState
    }

    return filterByState.filter((todo) => todo.tags.includes(selectedTag))
  }, [filter, selectedTag, todos])

  async function refreshTodos() {
    if (!supabase || !session?.user) {
      return
    }

    setLoadingTodos(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('todos')
      .select('id, text, completed, priority, due_at, tags, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setLoadingTodos(false)
      return
    }

    setTodos(data.map(mapTodo))
    setLoadingTodos(false)
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()

    if (!supabase) {
      return
    }

    setSubmittingAuth(true)
    setErrorMessage('')
    setStatusMessage('')

    const normalisedEmail = email.trim()

    const action =
      authMode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email: normalisedEmail, password })
        : supabase.auth.signUp({ email: normalisedEmail, password })

    const { error } = await action

    if (error) {
      setErrorMessage(error.message)
    } else if (authMode === 'sign-up') {
      setStatusMessage('Account created. Check your email if Supabase asks for confirmation.')
      setAuthMode('sign-in')
    } else {
      setStatusMessage('Signed in.')
      setEmail('')
      setPassword('')
    }

    setSubmittingAuth(false)
  }

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    setErrorMessage('')
    setStatusMessage('')
    setEditingId(null)
    setEditingText('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setTodos([])
    setStatusMessage('Signed out.')
  }

  async function handleAddTodo(event) {
    event.preventDefault()

    if (!supabase || !session?.user) {
      return
    }

    const text = draft.trim()
    const tags = parseTags(tagDraft)

    if (!text) {
      return
    }

    const dueAt = buildDueTimestamp(dueDate, dueTime)

    if (dueAt === undefined) {
      setErrorMessage('Set both due date and due time, or leave both blank.')
      return
    }

    setSavingTodo(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: session.user.id,
        text,
        completed: false,
        priority,
        due_at: dueAt,
        tags,
      })
      .select('id, text, completed, priority, due_at, tags, created_at')
      .single()

    if (error) {
      setErrorMessage(error.message)
      setSavingTodo(false)
      return
    }

    setTodos((current) => [mapTodo(data), ...current])
    setDraft('')
    setTagDraft('')
    setPriority('medium')
    setDueDate('')
    setDueTime('')
    setSavingTodo(false)
  }

  async function handleToggleTodo(id) {
    if (!supabase) {
      return
    }

    const currentTodo = todos.find((todo) => todo.id === id)

    if (!currentTodo) {
      return
    }

    setSavingTodo(true)
    setErrorMessage('')

    const { error } = await supabase
      .from('todos')
      .update({ completed: !currentTodo.completed })
      .eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setSavingTodo(false)
      return
    }

    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    )
    setSavingTodo(false)
  }

  async function handleDeleteTodo(id) {
    if (!supabase) {
      return
    }

    setSavingTodo(true)
    setErrorMessage('')

    const { error } = await supabase.from('todos').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setSavingTodo(false)
      return
    }

    setTodos((current) => current.filter((todo) => todo.id !== id))

    if (editingId === id) {
      setEditingId(null)
      setEditingText('')
    }

    setSavingTodo(false)
  }

  function handleStartEditing(todo) {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  async function handleSaveEdit(id) {
    if (!supabase) {
      return
    }

    const text = editingText.trim()

    if (!text) {
      await handleDeleteTodo(id)
      return
    }

    setSavingTodo(true)
    setErrorMessage('')

    const { error } = await supabase.from('todos').update({ text }).eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setSavingTodo(false)
      return
    }

    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, text } : todo)),
    )
    setEditingId(null)
    setEditingText('')
    setSavingTodo(false)
  }

  async function handleClearCompleted() {
    if (!supabase) {
      return
    }

    const completedIds = todos
      .filter((todo) => todo.completed)
      .map((todo) => todo.id)

    if (completedIds.length === 0) {
      return
    }

    setSavingTodo(true)
    setErrorMessage('')

    const { error } = await supabase.from('todos').delete().in('id', completedIds)

    if (error) {
      setErrorMessage(error.message)
      setSavingTodo(false)
      return
    }

    setTodos((current) => current.filter((todo) => !todo.completed))
    setSavingTodo(false)
  }

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className="app-header">
          <div>
            <h1>Today</h1>
            <p className="subtitle">
              {session?.user
                ? 'Your tasks now live in Supabase, so you can pick them up on any device.'
                : 'Sign in with Supabase to keep your tasks online instead of only in this browser.'}
            </p>
          </div>
          <div className="header-actions">
            <div className="theme-toggle" role="group" aria-label="Theme mode">
              {themeOptions.map((option) => {
                const Icon = option.icon

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={theme === option.key ? 'active' : ''}
                    aria-pressed={theme === option.key}
                    aria-label={`${option.label} mode`}
                    title={option.label}
                    onClick={() => setTheme(option.key)}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </button>
                )
              })}
            </div>
            <div className="stats-row" aria-label="Todo summary">
              <StatChip label="Total" value={counts.total} tone="neutral" />
              <StatChip label="Active" value={counts.active} tone="blue" />
              <StatChip label="Done" value={counts.completed} tone="green" />
            </div>
          </div>
        </header>

        {supabaseConfigError ? (
          <section className="setup-card">
            <h2>Connect Supabase first</h2>
            <p>
              Add your project values to <code>.env.local</code> before the app can sign in
              or load hosted todos.
            </p>
            <pre>{`VITE_SUPABASE_URL=your-project-url\nVITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key`}</pre>
            <p className="inline-note">{supabaseConfigError}</p>
          </section>
        ) : loadingAuth ? (
          <section className="setup-card setup-card-loading">
            <LoaderCircle className="spinning-icon" size={18} />
            <p>Connecting to Supabase...</p>
          </section>
        ) : !session?.user ? (
          <section className="auth-card">
            <div className="auth-card-copy">
              <h2>Sign in to sync your tasks</h2>
              <p>
                Use email and password for now. Once signed in, every todo will be saved to
                your hosted database.
              </p>
            </div>

            <div className="filter-tabs auth-tabs" role="tablist" aria-label="Authentication">
              <button
                type="button"
                className={authMode === 'sign-in' ? 'active' : ''}
                onClick={() => setAuthMode('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === 'sign-up' ? 'active' : ''}
                onClick={() => setAuthMode('sign-up')}
              >
                Create account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label className="sr-only" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

              <label className="sr-only" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                required
              />

              <button type="submit" disabled={submittingAuth}>
                {submittingAuth
                  ? authMode === 'sign-in'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : authMode === 'sign-in'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="composer-card" aria-label="Add a todo">
              <form className="composer-form" onSubmit={handleAddTodo}>
                <label className="sr-only" htmlFor="todo-input">
                  Add a todo
                </label>
                <input
                  id="todo-input"
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Add a task for today"
                />

                <label className="sr-only" htmlFor="tag-input">
                  Tags
                </label>
                <input
                  id="tag-input"
                  type="text"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  placeholder={defaultTagPlaceholder}
                />

                <label className="sr-only" htmlFor="priority-select">
                  Priority
                </label>
                <select
                  id="priority-select"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <label className="sr-only" htmlFor="due-date-input">
                  Due date
                </label>
                <input
                  id="due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />

                <label className="sr-only" htmlFor="due-time-input">
                  Due time
                </label>
                <input
                  id="due-time-input"
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                />

                <button type="submit" disabled={savingTodo}>
                  {savingTodo ? 'Saving...' : 'Add task'}
                </button>
              </form>
            </section>

            {statusMessage ? <StatusBanner tone="success" message={statusMessage} /> : null}
            {errorMessage ? <StatusBanner tone="error" message={errorMessage} /> : null}

            <div className="content-grid">
              <section className="list-panel">
                <div className="list-toolbar">
                  <div className="filter-tabs" role="tablist" aria-label="Filters">
                    {filterOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={filter === option.key ? 'active' : ''}
                        aria-pressed={filter === option.key}
                        onClick={() => setFilter(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="toolbar-actions">
                    <div className="tag-filter-wrap">
                      <span className="tag-filter-label">Tag</span>
                      <div className="tag-filter-list" aria-label="Tag filter">
                        <button
                          type="button"
                          className={selectedTag === 'all' ? 'active' : ''}
                          aria-pressed={selectedTag === 'all'}
                          onClick={() => setActiveTag('all')}
                        >
                          All tags
                        </button>
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={selectedTag === tag ? 'active' : ''}
                            aria-pressed={selectedTag === tag}
                            onClick={() => setActiveTag(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ghost-button icon-inline"
                      onClick={refreshTodos}
                      disabled={loadingTodos}
                    >
                      <RefreshCw size={14} className={loadingTodos ? 'spinning-icon' : ''} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={handleClearCompleted}
                      disabled={counts.completed === 0 || savingTodo}
                    >
                      Clear done
                    </button>
                  </div>
                </div>

                <ul className="todo-list">
                  {loadingTodos ? (
                    <li className="empty-state">
                      <p>Loading tasks...</p>
                      <span>Reading your hosted todos from Supabase.</span>
                    </li>
                  ) : visibleTodos.length === 0 ? (
                    <li className="empty-state">
                      <p>No tasks in this view.</p>
                      <span>Switch filter or add a fresh item above.</span>
                    </li>
                  ) : (
                    visibleTodos.map((todo) => (
                      <li
                        key={todo.id}
                        className={todo.completed ? 'todo-card is-complete' : 'todo-card'}
                      >
                        <label className="check-control">
                          <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => handleToggleTodo(todo.id)}
                          />
                          <span aria-hidden="true" />
                        </label>

                        <div className="todo-copy">
                          <div className="todo-line">
                            <span
                              className={`priority-dot priority-${todo.priority}`}
                              aria-hidden="true"
                            />
                            {editingId === todo.id ? (
                              <input
                                className="edit-input"
                                value={editingText}
                                onChange={(event) => setEditingText(event.target.value)}
                                onBlur={() => handleSaveEdit(todo.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    handleSaveEdit(todo.id)
                                  }

                                  if (event.key === 'Escape') {
                                    setEditingId(null)
                                    setEditingText('')
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <p>{todo.text}</p>
                            )}
                          </div>
                          <div className="todo-meta">
                            <span>
                              {priorityOptions.find((item) => item.key === todo.priority)?.label}
                            </span>
                            {todo.dueAt ? <span>Due {formatDueTimestamp(todo.dueAt)}</span> : null}
                            {todo.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className="tag-chip"
                                onClick={() => setActiveTag(tag)}
                              >
                                #{tag}
                              </button>
                            ))}
                            <span>{formatTimestamp(todo.createdAt)}</span>
                          </div>
                        </div>

                        <div className="todo-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleStartEditing(todo)}
                            aria-label={`Edit ${todo.text}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => handleDeleteTodo(todo.id)}
                            aria-label={`Delete ${todo.text}`}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <aside className="side-panel">
                <section className="progress-card">
                  <div
                    className="progress-ring"
                    style={{ '--progress': `${counts.percent}%` }}
                    aria-label={`${counts.percent}% completed`}
                  >
                    <div className="progress-ring-copy">
                      <strong>{counts.percent}%</strong>
                      <span>Complete</span>
                    </div>
                  </div>
                  <div className="progress-copy">
                    <h2>Progress</h2>
                    <p>
                      {counts.active === 0
                        ? 'All tasks are wrapped up.'
                        : `${counts.active} task${counts.active === 1 ? '' : 's'} still need attention.`}
                    </p>
                    {availableTags.length > 0 ? (
                      <p>{availableTags.length} tag{availableTags.length === 1 ? '' : 's'} in use.</p>
                    ) : null}
                  </div>
                </section>

                <section className="details-card">
                  <h2>Quick actions</h2>
                  <ul>
                    <li>
                      <span>Enter</span>
                      <p>Save an edit or submit a new task</p>
                    </li>
                    <li>
                      <span>Refresh</span>
                      <p>Pull the latest hosted data back from Supabase</p>
                    </li>
                    <li>
                      <span>Cloud</span>
                      <p>Signed in as {session.user.email}</p>
                    </li>
                  </ul>
                </section>

                <section className="details-card account-card">
                  <h2>Account</h2>
                  <p>You can now open the same account on another device and see the same list.</p>
                  <button type="button" className="sign-out-button" onClick={handleSignOut}>
                    <LogOut size={15} />
                    Sign out
                  </button>
                </section>
              </aside>
            </div>
          </>
        )}

        {!supabaseConfigError && !session?.user && !loadingAuth && statusMessage ? (
          <StatusBanner tone="success" message={statusMessage} />
        ) : null}
        {!supabaseConfigError && !session?.user && !loadingAuth && errorMessage ? (
          <StatusBanner tone="error" message={errorMessage} />
        ) : null}
      </section>
    </main>
  )
}

function StatChip({ label, value, tone }) {
  return (
    <div className={`stat-chip tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusBanner({ tone, message }) {
  return <div className={`status-banner tone-${tone}`}>{message}</div>
}

export default App
