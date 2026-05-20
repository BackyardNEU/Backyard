# Login/Signup Design Brief for Milo

> **What this is:** A handoff doc listing every component, prop, state, and interaction that needs visual design work for the new login/signup flow. Ryan + Claude handle the implementation logic — you own the look and feel.

---

## Overview

We're redesigning the login/signup modal (`LoginMorph.jsx`) to support:
1. Google OAuth button (Apple later)
2. Email/password login AND sign-up (with new fields)
3. Forgot password flow
4. "Need help?" placeholder
5. Raccoon mascot animation (future)

---

## Components That Need Design

### 1. `LoginMorph.jsx` — The Main Modal

**Current state:** Full-viewport card (`120vh` wide) with dark overlay. Contains a raccoon image, heading, email/password form, and a toggle link.

**What's changing:** The modal now has 3 view states instead of 2:

| View State | Shows |
|-----------|-------|
| `login` | Google button → "or" divider → email + password inputs → Login button → "Forgot password?" link → "Don't have an account? Sign up" toggle → "Need help?" |
| `signup` | Google button → "or" divider → first name + last name + username + email + password inputs → Sign Up button → "Already have an account? Login" toggle → "Need help?" |
| `forgot` | Heading "Reset Password" → email input → "Send reset link" button → success/error message → "Back to login" link |

**Design decisions for you:**
- Overall card dimensions and spacing (keep full-viewport or go compact?)
- How the Google OAuth button looks (branded with G icon? full-width or inline?)
- The "or" divider style (horizontal rule with text?)
- Input field styling for new fields (first name, last name, username)
- Where "Forgot password?" sits relative to the form
- "Need help?" link styling (subtle, bottom of card)
- Transitions between the 3 views (Framer Motion `AnimatePresence` is available)

**Props/state you'll work with:**
```jsx
// view: 'login' | 'signup' | 'forgot'
// setView: function to switch views
// open: boolean (modal open/closed)
// setOpen: function to close modal
```

### 2. `form.jsx` — The Auth Form

**Current state:** Grid layout, `70vh`-wide inputs with 3px borders, teal submit button.

**What's changing in signup mode — 5 inputs instead of 1:**
```
[ First name          ]
[ Last name           ]
[ Username            ]   ← may show green check / red "taken" indicator
[ Email               ]
[ Password            ]
[     Sign Up         ]
```

**In login mode — same as before:**
```
[ Email               ]
[ Password            ]
[      Login          ]
```

**Design decisions:**
- Input field widths — still `70vh`? (that's very wide on desktop)
- First + last name: side-by-side on one row? Or stacked?
- Username field: how to show real-time availability feedback (checkmark? red border? small text below?)
- Error message styling (currently a plain div with class `form-error`)
- Loading state on submit button (currently just text change)

### 3. `ForgotPasswordForm.jsx` — NEW Component

**What it does:** Simple form shown inside the LoginMorph card when view === 'forgot'.

**Elements:**
```
   Reset your password

   Enter the email you signed up with
   and we'll send you a reset link.

   [ Email                          ]
   [     Send Reset Link            ]

   ✓ Check your email!  (success state)
   ✗ Error message       (error state)

   ← Back to login
```

**Design decisions:**
- Does this replace the form inside the same card, or slide in?
- Success state styling (green text? checkmark icon?)
- "Back to login" — text link or button?

### 4. `ResetPasswordPage.jsx` — NEW Full Page

**What it does:** Standalone page (NOT in the modal) at route `/reset-password`. User lands here after clicking the email link.

**Elements:**
```
   🦝 Raccoon logo

   Set a new password

   [ New password               ]
   [ Confirm password           ]
   [     Update Password        ]

   ✓ Password updated! Redirecting...  (success)
   ✗ Error message                      (error)
```

**Design decisions:**
- Page layout — centered card on a clean background? (similar to ProfileSetupPage?)
- Should it match the LoginMorph card aesthetic or stand alone?
- Password strength indicator? (optional)
- Auto-redirect to `/profile` on success, or show a "Go to profile" button?

### 5. Google OAuth Button

**Current state:** `Login.jsx` is a standalone component with a plain `<button>Sign in with Google</button>`. It's not even rendered inside the LoginMorph modal currently.

**What's changing:** The OAuth button moves inside the LoginMorph card, above the email form.

**Design decisions:**
- Follow Google's brand guidelines? (white button with G logo + "Sign in with Google" text)
- Full-width matching the form inputs, or narrower?
- Apple button will be added later in the same row/stack

### 6. "Need Help?" Link

**What it does:** Nothing for now — placeholder.

**Design decisions:**
- Position: bottom of the LoginMorph card, below the toggle link
- Style: subtle text link with a help icon? (`lucide-react` has `HelpCircle`)
- Could eventually open a support modal or mailto link

---

## Raccoon Mascot Animation (Future Feature)

This is a stretch goal. Here's the technical approach so you can plan the asset.

### What We Need From You: An SVG Raccoon

The animation requires a **layered SVG** (not a flat PNG) with these separate groups:

```xml
<svg>
  <g id="body">  <!-- raccoon head/body, static -->  </g>
  <g id="left-eye">
    <circle class="pupil" />  <!-- this gets animated -->
  </g>
  <g id="right-eye">
    <circle class="pupil" />  <!-- this gets animated -->
  </g>
</svg>
```

Or alternatively: the existing `raccoon_pfp.png` as the base with two small circular `<div>`s overlaid as pupils — but this is fragile across screen sizes.

### Three Animation Behaviors

**A. Eye-tracking (idle state):**
- Raccoon sits in a circular frame above the form
- As the user types in any input, the raccoon's pupils follow the cursor position
- Pupils translate on X/Y within a ~6px radius (Framer Motion spring animation)
- Feels playful and alive

**B. Login button hover — drop out:**
- When user hovers the submit button, the raccoon "drops" out of its circle frame
- The circle has `overflow: hidden`, so the raccoon slides down and disappears
- Duration: ~0.3s ease-out

**C. Login button hover — peek from behind:**
- Simultaneously, a second raccoon element "pops up" from behind the submit button
- Positioned `absolute` below the button, animates upward with a bouncy spring
- The raccoon peeks over the top edge of the button

**Component we'll build:** `RaccoonMascot.jsx`
```jsx
<RaccoonMascot
  eyeOffset={{ x: 3, y: -2 }}     // from input tracking
  variant="idle"                    // 'idle' | 'dropping' | 'peeking'
/>
```

---

## Current CSS Files You'll Modify

| File | What's in it |
|------|-------------|
| `src/login_components/LoginMorph.css` | Modal card, close button, raccoon image, heading, toggle link, responsive |
| `src/login_components/form.css` | Input fields, submit button, error message |

### Existing Design Tokens to Match
- **Card background:** `rgb(252, 252, 252)`
- **Card border:** `1px solid rgb(162, 162, 162)`, `border-radius: 15px`
- **Card shadow:** `0 20px 80px rgba(0,0,0,0.4)`, overlay `rgba(0,0,0,0.65)`
- **Heading font:** Be Vietnam Pro, 60px, weight 800
- **Input border:** `3px solid rgb(102, 102, 102)`
- **Button color:** `rgb(46, 120, 139)` (teal)
- **Toggle link:** `#555`, underlined, `0.95rem`
- **Raccoon image:** `180px × 180px`

---

## File Map

```
src/login_components/
├── LoginMorph.jsx      ← MODIFY (3 view states, OAuth button, forgot link, help link)
├── LoginMorph.css      ← MODIFY (new layout, OAuth button styles, divider)
├── form.jsx            ← MODIFY (new sign-up fields, username check indicator)
├── form.css            ← MODIFY (layout for 5 inputs, availability indicator)
├── ForgotPasswordForm.jsx  ← NEW (email input + send link + success/error)
├── ResetPasswordPage.jsx   ← NEW (full page, new password form)
├── Login.jsx           ← MODIFY or DELETE (OAuth logic moves into LoginMorph)
├── AuthListener.jsx    ← NO DESIGN CHANGES (logic only)
├── AuthCallbackPage.jsx ← NO DESIGN CHANGES (logic only)
├── Logout.jsx          ← NO DESIGN CHANGES
└── RaccoonMascot.jsx   ← NEW, FUTURE (animated SVG raccoon)
```

---

## Questions for You

1. Full-viewport card or compact centered card (~420px wide)?
2. First name + last name: one row or two rows?
3. Want a password visibility toggle (eye icon)?
4. Any specific animation preferences for view transitions?
5. Can you create a layered raccoon SVG for the mascot animation?
