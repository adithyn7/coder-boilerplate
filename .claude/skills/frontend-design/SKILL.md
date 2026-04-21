---
name: frontend-design
description: "Design-system playbook for our React + Vite + Tailwind + shadcn stack. Defines spacing scale, typography, color tokens, component choices, state patterns (loading/empty/error), dark-mode handling, responsive breakpoints, and a11y baselines. Use when building a new page, styling a component, or producing any UI."
when-to-use: "Any time you're about to write or modify UI, pick a component, choose colors/spacing, or create a new page or feature."
context: inline
---

# Frontend Design Playbook (React + Vite + Tailwind + shadcn)

Apply these rules **every time** you touch UI. They are not suggestions.

## Spacing (Tailwind scale only)

- Never use arbitrary pixel values (`p-[13px]`, `mt-[7px]`). Use the Tailwind scale: `1, 2, 3, 4, 6, 8, 12, 16, 24`.
- Card/section padding: `p-4` to `p-6`. Page gutters: `px-4 md:px-6 lg:px-8`.
- Vertical rhythm between sections: `space-y-6` (dense) or `space-y-8` (airy).
- Form rows: `space-y-2` inside a field, `space-y-4` between fields.

## Typography

- Use shadcn typography tokens. Page titles: `text-2xl font-semibold tracking-tight`. Section headings: `text-lg font-semibold`. Body: default. Captions/labels: `text-sm text-muted-foreground`.
- Never hand-roll font weights/sizes. If something's off, pick a bigger/smaller token, don't invent one.

## Color (tokens, not hex)

- Always use CSS variable tokens: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.
- Never write `bg-[#...]` or `text-gray-500` — those bypass dark-mode.
- Destructive actions: `variant="destructive"` on the Button, `text-destructive` for warnings.
- Success/info states: use a shadcn `Alert` with the matching variant, not raw green/blue.

## Component choices (by intent)

| Intent | Component |
|---|---|
| Read-only content block | `Card` + `CardHeader` + `CardContent` |
| Full-screen side panel | `Sheet` |
| Modal dialog that blocks the flow | `Dialog` or `AlertDialog` (for confirmations) |
| Inline expand/collapse | `Collapsible` or `Accordion` |
| Table of records | `Table` for < 100 rows; pair with `Input` + client-side filter for search |
| Forms | `Form` + `react-hook-form` + `zod` schema — never raw `<form>` |
| Dropdown menu of actions | `DropdownMenu` with `DropdownMenuItem`s |
| Single-select from many | `Select`; from a few options, `RadioGroup` |
| Multi-select | `Checkbox` list or `Command` palette for searchable |
| Status chip | `Badge` with appropriate `variant` |
| Toast for async feedback | `useToast()` from `@/components/ui/use-toast` |

## State templates (always render these three)

For any async-data UI, handle **all three** states:

```tsx
if (isLoading) return <Skeleton className="h-24 w-full" />;
if (error) return <Alert variant="destructive"><AlertTitle>Couldn't load</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>;
if (!data?.length) return <EmptyState icon={Inbox} title="No records yet" description="..." action={<Button>Create one</Button>} />;
return <DataList items={data} />;
```

- Loading: `Skeleton` matching the eventual layout shape, not a spinner.
- Error: `Alert variant="destructive"` with actionable copy ("Retry", not just "Try again").
- Empty: icon + one-line title + one-line subtitle + a primary CTA. Write real copy, never "No data available."

## Dark mode

- Always test with the `.dark` class applied to `<html>`. Tokens (`bg-background`, `text-foreground`, etc.) auto-switch; raw colors do not.
- Images/illustrations with white backgrounds need a dark wrapper: `rounded-md bg-muted p-2` around the image.

## Responsive

- Design mobile-first. Default styles = phone. Add `md:` / `lg:` only to adjust up.
- Breakpoints: `sm` (≥640), `md` (≥768 — tablet), `lg` (≥1024 — small laptop), `xl` (≥1280).
- Tables on mobile: switch to a `Card` list below `md`.
- Avoid fixed widths on cards; use `max-w-*` + `w-full`.

## Accessibility (minimum bar)

- Every interactive element must be a `<button>`, `<a>`, or `role="button"` — never a clickable `<div>`.
- Every form input must have a `<Label htmlFor>` (shadcn `FormLabel` in Form).
- Images: `alt=""` if decorative, descriptive alt otherwise.
- Icons that act as buttons: wrap in `Button` with `size="icon"` and `aria-label`.
- Focus rings: don't `outline-none` without replacing with `focus-visible:ring-2 focus-visible:ring-ring`.
- Color contrast: use tokens — they pass AA by construction. Never rely on color alone to convey state (pair with icon or text).

## Layout patterns

- Pages: `<div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">` as outer.
- Two-column form layout: `<div className="grid gap-4 md:grid-cols-2">`.
- Sticky headers: `sticky top-0 z-10 border-b bg-background/95 backdrop-blur`.
- Lists with dividers: `divide-y divide-border`.

## Anti-patterns (do NOT ship)

- Custom buttons outside `@/components/ui/button`. The variant you want already exists.
- Toasts for errors longer than one line — use an inline `Alert` instead.
- Modals triggered from modals — redesign the flow.
- `useEffect` to sync form state — use react-hook-form's `watch` / `setValue`.
- Fixed heights on content areas. Let content determine height.
- CSS `!important`. Never.

## When the user disagrees with the design system

Politely implement what they asked, *without* breaking the token system. If they say "make the button red", use `variant="destructive"` (which IS red) — don't add `bg-red-500`. If they insist on raw colors, comply once but add a `// TODO: align with design tokens` comment.
