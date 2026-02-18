import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

interface OnboardingProps {
  /** Called after org creation to refresh auth state */
  onCreated: () => Promise<void>
  onLogout: () => Promise<void>
  /** If user already has an org (returning from OAuth redirect), provide the org ID */
  orgId?: string
}

type Step = 'team' | 'github' | 'vercel' | 'done'

const STEP_KEY = 'viagen-onboarding-step'

export function Onboarding({ onCreated, onLogout, orgId }: OnboardingProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Determine initial step
  const getInitialStep = (): Step => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    // Returning from Vercel OAuth?
    if (connected === 'vercel') {
      return 'done'
    }
    if (error === 'vercel') {
      return 'vercel'
    }
    // Returning from GitHub OAuth?
    if (connected === 'github') {
      return 'vercel'
    }
    if (error === 'github') {
      return 'github'
    }
    // Already have an org? Skip team creation
    if (orgId) {
      const saved = localStorage.getItem(STEP_KEY)
      if (saved === 'github' || saved === 'vercel') return saved
      return 'github'
    }
    return 'team'
  }

  const [step, setStep] = useState<Step>(getInitialStep)

  // Clean URL params after reading them
  useEffect(() => {
    if (searchParams.has('connected') || searchParams.has('error')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Persist step
  useEffect(() => {
    if (step !== 'team') {
      localStorage.setItem(STEP_KEY, step)
    }
  }, [step])

  const finish = () => {
    localStorage.removeItem(STEP_KEY)
    navigate('/', { replace: true })
  }

  // Auto-finish when returning from final OAuth
  useEffect(() => {
    if (step === 'done') finish()
  }, [step])

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Step indicator */}
        <div style={styles.steps}>
          <StepDot active={step === 'team'} done={step !== 'team'} label="1" />
          <div style={styles.stepLine} />
          <StepDot active={step === 'github'} done={step === 'vercel'} label="2" />
          <div style={styles.stepLine} />
          <StepDot active={step === 'vercel'} done={false} label="3" />
        </div>

        {step === 'team' && (
          <TeamStep
            onNext={async () => {
              await onCreated()
              setStep('github')
            }}
          />
        )}

        {step === 'github' && (
          <GitHubStep
            orgId={orgId!}
            githubError={searchParams.get('error') === 'github'}
            onSkip={() => setStep('vercel')}
          />
        )}

        {step === 'vercel' && (
          <VercelStep
            vercelError={searchParams.get('error') === 'vercel'}
            onSkip={finish}
          />
        )}

        <button onClick={onLogout} style={styles.signOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}

// --- Step Components ---

function TeamStep({ onNext }: { onNext: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Failed to create team')
        return
      }
      await onNext()
    } catch {
      setError('Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <h1 style={styles.title}>Create your team</h1>
      <p style={styles.subtitle}>
        Teams let you organize projects and collaborate with others.
      </p>

      <div style={styles.field}>
        <label style={styles.label}>Team name</label>
        <input
          type="text"
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          style={styles.input}
          autoFocus
        />
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating || !name.trim()}
        style={{ ...styles.button, opacity: creating || !name.trim() ? 0.5 : 1 }}
      >
        {creating ? 'Creating...' : 'Continue'}
      </button>
    </>
  )
}

function GitHubStep({ orgId, githubError, onSkip }: { orgId: string; githubError: boolean; onSkip: () => void }) {
  return (
    <>
      <h1 style={styles.title}>Connect GitHub</h1>
      <p style={styles.subtitle}>
        Link your GitHub account so viagen can access your repositories
        and save sandbox changes.
      </p>

      {githubError && (
        <p style={styles.error}>Failed to connect GitHub. Please try again.</p>
      )}

      <a
        href="/api/integrations/github/start"
        style={{ ...styles.button, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
      >
        <GitHubIcon />
        Connect GitHub
      </a>

      <button onClick={onSkip} style={styles.skip}>
        Skip for now
      </button>
    </>
  )
}

function VercelStep({ vercelError, onSkip }: { vercelError: boolean; onSkip: () => void }) {
  return (
    <>
      <h1 style={styles.title}>Connect Vercel</h1>
      <p style={styles.subtitle}>
        Link your Vercel account to deploy projects and manage environments.
      </p>

      {vercelError && (
        <p style={styles.error}>Failed to connect Vercel. Please try again.</p>
      )}

      <a
        href="/api/integrations/vercel/start"
        style={{ ...styles.button, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
      >
        <VercelIcon />
        Connect Vercel
      </a>

      <button onClick={onSkip} style={styles.skip}>
        Skip for now
      </button>
    </>
  )
}

// --- Small Components ---

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: active ? 'var(--ds-gray-1000)' : done ? 'var(--ds-gray-1000)' : 'var(--ds-gray-200)',
        color: active || done ? 'var(--ds-background-100)' : 'var(--ds-gray-500)',
        transition: 'all 0.2s ease',
      }}
    >
      {done ? '\u2713' : label}
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function VercelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 76 65" fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  )
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: '2rem',
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
  },
  stepLine: {
    width: 40,
    height: 1,
    background: 'var(--ds-gray-300)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--ds-gray-600)',
    textAlign: 'center',
    marginBottom: '2rem',
    lineHeight: 1.5,
  },
  field: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.5rem',
    color: 'var(--ds-gray-700)',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 6,
    fontFamily: 'inherit',
    color: 'var(--ds-gray-1000)',
    background: 'var(--ds-background-100)',
    boxSizing: 'border-box',
  },
  error: {
    fontSize: '0.8125rem',
    color: '#ef4444',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    padding: '0.625rem 1.25rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  skip: {
    display: 'block',
    width: '100%',
    marginTop: '1rem',
    padding: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--ds-gray-500)',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'underline',
  },
  signOut: {
    display: 'block',
    width: '100%',
    marginTop: '2rem',
    padding: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--ds-gray-400)',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'center',
  },
}
