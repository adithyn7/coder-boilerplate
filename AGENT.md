# Agent Quick Reference

Use this file as your primary reference when building with this codebase.

---

## File Locations

| What | Where | Command to Add |
|------|-------|----------------|
| Pages | `src/pages/{Name}.tsx` | Create file + add route |
| Components | `src/components/{Name}.tsx` | Create file |
| UI Primitives | `src/components/ui/` | `npx shadcn@latest add {name}` |
| Hooks | `src/hooks/use{Name}.ts` | Create file |
| Utilities | `src/lib/{name}.ts` | Create file |
| Types | `src/types/{name}.ts` | Create file |
| Routes | `src/App.tsx` | Edit file |
| Edge Functions | `supabase/functions/{name}/index.ts` | Create folder + file |
| Styles | `src/index.css` | Edit CSS variables |

---

## Add a New Page

1. Create file:
```tsx
// src/pages/Dashboard.tsx
export default function Dashboard() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
    </div>
  )
}
```

2. Add route in `src/App.tsx`:
```tsx
import Dashboard from '@/pages/Dashboard'

// Inside <Routes>:
<Route path="/dashboard" element={<Dashboard />} />
```

---

## Add a Component

```tsx
// src/components/UserCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface UserCardProps {
  name: string
  email: string
  avatarUrl?: string
}

export function UserCard({ name, email, avatarUrl }: UserCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar>
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{name}</CardTitle>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </CardHeader>
    </Card>
  )
}
```

---

## Supabase Queries

### Fetch Data
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Item {
  id: string
  name: string
  created_at: string
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setItems(data || [])
        setLoading(false)
      })
  }, [])

  return { items, loading, error }
}
```

### Insert Data
```tsx
const createItem = async (name: string) => {
  const { data, error } = await supabase
    .from('items')
    .insert({ name })
    .select()
    .single()

  if (error) throw error
  return data
}
```

### Update Data
```tsx
const updateItem = async (id: string, name: string) => {
  const { error } = await supabase
    .from('items')
    .update({ name })
    .eq('id', id)

  if (error) throw error
}
```

### Delete Data
```tsx
const deleteItem = async (id: string) => {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) throw error
}
```

---

## Authentication

**This sandbox uses SuperAGI OIDC ("Sign in with SuperAGI") as the only auth method.** Do not generate email/password forms, do not generate `/login` or `/signup` routes, and do not call `supabase.auth.signInWithPassword` or `supabase.auth.signUp`. Server-side OIDC provider registration is fully automated by coder-service — no Supabase dashboard configuration is needed and you should not instruct the user to do any. The provider identifier is `custom:superagi` and the user's `auth.uid()` equals their SuperAGI `auth_users.id`, so RLS policies work without custom mapping.

### Auth Provider (`src/context/AuthProvider.tsx`)
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthCtx = { user: User | null; session: Session | null; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return <Ctx.Provider value={{ user: session?.user ?? null, session, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
```

### Sign-In Button (`src/components/SignInButton.tsx`)
```tsx
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export function SignInButton() {
  return (
    <Button
      onClick={() =>
        supabase.auth.signInWithOAuth({
          provider: 'custom:superagi',
          options: { redirectTo: window.location.href },
        })
      }
      size="lg"
    >
      Sign in with SuperAGI
    </Button>
  )
}
```

### Sign-In Page (`src/pages/SignInPage.tsx`)
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInButton } from '@/components/SignInButton'

export function SignInPage({ appName }: { appName: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{appName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignInButton />
          <p className="text-sm text-muted-foreground">
            You'll be signed in using your SuperAGI account. No extra password needed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Auth Gate (`src/components/AuthGate.tsx`)

Wraps protected content. Auto-triggers silent SSO when the app is opened from inside super_sales (so the user never sees a login screen); shows the `<SignInPage />` button otherwise.

```tsx
import { useEffect, ReactNode } from 'react'
import { useAuth } from '@/context/AuthProvider'
import { SignInPage } from '@/pages/SignInPage'
import { supabase } from '@/lib/supabase'

function isEmbeddedLaunch() {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).get('source') === 'super_sales') return true
  if (document.referrer.startsWith('https://sales.superagi.com')) return true
  if (document.cookie.split(';').some(c => c.trim().startsWith('_superagi_session_'))) return true
  return false
}

export function AuthGate({ children, appName }: { children: ReactNode; appName: string }) {
  const { session, loading } = useAuth()

  useEffect(() => {
    if (loading || session) return
    if (isEmbeddedLaunch()) {
      supabase.auth.signInWithOAuth({
        provider: 'custom:superagi',
        options: { redirectTo: window.location.href },
      })
    }
  }, [loading, session])

  if (loading || (!session && isEmbeddedLaunch())) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>
  }
  if (!session) return <SignInPage appName={appName} />
  return <>{children}</>
}
```

### Wrap Routes in `App.tsx`
```tsx
import { AuthProvider } from '@/context/AuthProvider'
import { AuthGate } from '@/components/AuthGate'

export default function App() {
  return (
    <AuthProvider>
      <AuthGate appName="My App">
        <Routes>
          {/* protected routes here */}
        </Routes>
      </AuthGate>
    </AuthProvider>
  )
}
```

### Reading user / signing out
```tsx
const { user } = useAuth()
await supabase.auth.signOut()
```

---

## Forms

### Basic Form
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Your submit logic here
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  )
}
```

---

## Available UI Components

Import from `@/components/ui/{component}`:

| Component | Key Exports |
|-----------|-------------|
| button | `Button`, `buttonVariants` |
| card | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| input | `Input` |
| label | `Label` |
| textarea | `Textarea` |
| badge | `Badge` |
| separator | `Separator` |
| skeleton | `Skeleton` |
| dialog | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` |
| dropdown-menu | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` |
| avatar | `Avatar`, `AvatarImage`, `AvatarFallback` |
| tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| select | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |
| switch | `Switch` |
| checkbox | `Checkbox` |
| sonner | `Toaster` (use with `toast()` from sonner) |

### Add More Components
```bash
npx shadcn@latest add accordion alert-dialog popover tooltip
```

---

## Toast Notifications

```tsx
import { toast } from 'sonner'

// Success
toast.success('Saved successfully!')

// Error
toast.error('Something went wrong')

// With description
toast('Event created', {
  description: 'Your event has been scheduled',
})

// Don't forget to add <Toaster /> in App.tsx or main.tsx
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <>
      <Routes>...</Routes>
      <Toaster />
    </>
  )
}
```

---

## Icons (Lucide React)

```tsx
import { Home, Settings, User, Plus, Trash2, Edit, Search } from 'lucide-react'

<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>
```

Browse icons: https://lucide.dev/icons

---

## Edge Function

### Create Function
```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { data } = await req.json()

    // Your logic here

    return new Response(
      JSON.stringify({ result: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Call Function
```tsx
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { data: 'value' }
})
```

---

## Common Layouts

### Centered Card
```tsx
<div className="min-h-screen flex items-center justify-center p-4">
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>
      Content here
    </CardContent>
  </Card>
</div>
```

### Sidebar Layout
```tsx
<div className="flex min-h-screen">
  <aside className="w-64 border-r p-4">
    Sidebar
  </aside>
  <main className="flex-1 p-8">
    Main content
  </main>
</div>
```

### Grid of Cards
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id}>
      <CardContent className="p-4">
        {item.name}
      </CardContent>
    </Card>
  ))}
</div>
```

---

## Responsive Classes

```
sm:  → 640px+
md:  → 768px+
lg:  → 1024px+
xl:  → 1280px+
2xl: → 1536px+
```

Example: `className="text-sm md:text-base lg:text-lg"`

---

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Pages | PascalCase | `Dashboard.tsx` |
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Utils | camelCase | `formatDate.ts` |
| Types | camelCase | `user.ts` |

---

## Quick Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run lint       # Check for errors
npm run typecheck  # Type check
```