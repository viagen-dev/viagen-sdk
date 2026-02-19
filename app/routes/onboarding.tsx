import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { redirect } from 'react-router'
import { getSessionUser } from '~/lib/session.server'

export async function loader({ request }: { request: Request }) {
  const session = await getSessionUser(request)
  if (!session) return redirect('/login')

  return {
    hasOrg: session.memberships.length > 0,
    orgId: session.memberships[0]?.organizationId ?? null,
  }
}

type Step = 'team' | 'github' | 'vercel' | 'done'
const STEP_KEY = 'viagen-onboarding-step'

export default function Onboarding({ loaderData }: { loaderData: { hasOrg: boolean; orgId: string | null } }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasOrg, orgId } = loaderData

  const getInitialStep = (): Step => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected === 'vercel') return 'done'
    if (error === 'vercel') return 'vercel'
    if (connected === 'github') return 'vercel'
    if (error === 'github') return 'github'
    if (hasOrg) {
      const saved = localStorage.getItem(STEP_KEY)
      if (saved === 'github' || saved === 'vercel') return saved
      return 'github'
    }
    return 'team'
  }

  const [step, setStep] = useState<Step>(getInitialStep)

  useEffect(() => {
    if (searchParams.has('connected') || searchParams.has('error')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (step !== 'team') localStorage.setItem(STEP_KEY, step)
  }, [step])

  const finish = () => {
    localStorage.removeItem(STEP_KEY)
    navigate('/', { replace: true })
  }

  useEffect(() => {
    if (step === 'done') finish()
  }, [step])

  const handleOrgCreated = async () => {
    setStep('github')
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    navigate('/login', { replace: true })
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.steps}>
          <StepDot active={step === 'team'} done={step !== 'team'} label="1" />
          <div style={styles.stepLine} />
          <StepDot active={step === 'github'} done={step === 'vercel'} label="2" />
          <div style={styles.stepLine} />
          <StepDot active={step === 'vercel'} done={false} label="3" />
        </div>

        {step === 'team' && <TeamStep onNext={handleOrgCreated} />}
        {step === 'github' && (
          <GitHubStep githubError={searchParams.get('error') === 'github'} onSkip={() => setStep('vercel')} />
        )}
        {step === 'vercel' && (
          <VercelStep vercelError={searchParams.get('error') === 'vercel'} onSkip={finish} />
        )}

        <button onClick={handleLogout} style={styles.signOut}>Sign out</button>
      </div>
    </div>
  )
}

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
      <p style={styles.subtitle}>Teams let you organize projects and collaborate with others.</p>
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

function GitHubStep({ githubError, onSkip }: { githubError: boolean; onSkip: () => void }) {
  return (
    <>
      <h1 style={styles.title}>Connect GitHub</h1>
      <p style={styles.subtitle}>Link your GitHub account so viagen can access your repositories and save sandbox changes.</p>
      {githubError && <p style={styles.error}>Failed to connect GitHub. Please try again.</p>}
      <a
        href="/api/integrations/github/start"
        style={{ ...styles.button, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
      >
        Connect GitHub
      </a>
      <button onClick={onSkip} style={styles.skip}>Skip for now</button>
    </>
  )
}

function VercelStep({ vercelError, onSkip }: { vercelError: boolean; onSkip: () => void }) {
  return (
    <>
      <h1 style={styles.title}>Connect Vercel</h1>
      <p style={styles.subtitle}>Link your Vercel account to deploy projects and manage environments.</p>
      {vercelError && <p style={styles.error}>Failed to connect Vercel. Please try again.</p>}
      <a
        href="/api/integrations/vercel/start"
        style={{ ...styles.button, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
      >
        Connect Vercel
      </a>
      <button onClick={onSkip} style={styles.skip}>Skip for now</button>
    </>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 600,
        background: active || done ? 'var(--ds-gray-1000)' : 'var(--ds-gray-200)',
        color: active || done ? 'var(--ds-background-100)' : 'var(--ds-gray-500)',
        transition: 'all 0.2s ease',
      }}
    >
      {done ? '\u2713' : label}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  card: { width: '100%', maxWidth: 400, padding: '2rem' },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' },
  stepLine: { width: 40, height: 1, background: 'var(--ds-gray-300)' },
  title: { fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', textAlign: 'center' },
  subtitle: { fontSize: '0.875rem', color: 'var(--ds-gray-600)', textAlign: 'center', marginBottom: '2rem', lineHeight: 1.5 },
  field: { marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--ds-gray-700)' },
  input: { width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--ds-gray-300)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--ds-gray-1000)', background: 'var(--ds-background-100)', boxSizing: 'border-box' as const },
  error: { fontSize: '0.8125rem', color: '#ef4444', marginBottom: '1rem', textAlign: 'center' },
  button: { width: '100%', padding: '0.625rem 1.25rem', background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s ease' },
  skip: { display: 'block', width: '100%', marginTop: '1rem', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--ds-gray-500)', fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline' },
  signOut: { display: 'block', width: '100%', marginTop: '2rem', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--ds-gray-400)', fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center' },
}
