# India SaaS scaffold layout

```
app/
  (auth)/login/page.tsx
  (dashboard)/dashboard/page.tsx
  api/billing/webhook/route.ts
lib/
  supabase.ts
  razorpay.ts
.env.example
```

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## Billing plans (INR)

| Plan | Price | Notes |
|------|-------|-------|
| Lite | ₹199/mo | Solo builder |
| Pro | ₹499/mo | Teams |
| Team | ₹1299/mo | Shared workspace |
