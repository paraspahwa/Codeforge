# Marketplace MVP layout

```
app/
  (shop)/page.tsx
  (shop)/product/[id]/page.tsx
  api/checkout/route.ts
lib/
  supabase.ts
  razorpay-checkout.ts
components/
  ProductCard.tsx
  CartDrawer.tsx
```

## Env

Same Supabase + Razorpay vars as SaaS starter. Add `NEXT_PUBLIC_APP_URL` for redirect URLs.
