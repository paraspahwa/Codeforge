/** Builder case studies for marketing trust */

export const CASE_STUDIES = [
  {
    id: "kirana-saas",
    title: "Kirana SaaS — inventory for 200+ shops",
    founder: "Priya M., Pune",
    category: "B2B SaaS",
    timeline: "3 weekends",
    summary:
      "A non-technical founder used CodeForge to go from WhatsApp notes to a working admin dashboard with Supabase auth and Razorpay Lite billing.",
    metrics: [
      { label: "Time to prototype", value: "4 hours" },
      { label: "Lines of agent-written code", value: "2,400+" },
      { label: "Deploy readiness", value: "92%" },
    ],
    stack: ["Next.js", "Supabase", "Razorpay", "Vercel"],
    quote:
      "Maine sirf Hindi mein idea explain kiya — PRD aur plan samajh aa gaya, phir agent ne code likh diya.",
  },
  {
    id: "local-marketplace",
    title: "Handmade marketplace — artisans near Jaipur",
    founder: "Rahul K., Jaipur",
    category: "Marketplace MVP",
    timeline: "2 weeks",
    summary:
      "Built a two-sided marketplace with INR listings, seller onboarding, and Razorpay checkout — guided by the India marketplace template pack.",
    metrics: [
      { label: "First paying seller", value: "Day 12" },
      { label: "Agent sessions", value: "18" },
      { label: "Test pass rate after /loop", value: "100%" },
    ],
    stack: ["Next.js", "Supabase", "Razorpay"],
    quote: "Deploy checklist ne bataya exactly kya missing tha production ke liye.",
  },
  {
    id: "dev-agency",
    title: "Agency client portal — dev team in Bangalore",
    founder: "Team of 4, Bangalore",
    category: "Developer wedge",
    timeline: "1 sprint",
    summary:
      "A small agency replaced ad-hoc Claude Code + Cursor with CodeForge Team for shared memory, parallel agent forks, and cowork scrape jobs.",
    metrics: [
      { label: "Cost vs USD tools", value: "~60% lower" },
      { label: "Parallel forks used", value: "12" },
      { label: "Cowork jobs automated", value: "5" },
    ],
    stack: ["FastAPI", "CodeForge IDE", "Cowork"],
    quote: "Parallel sessions let us try two refactor approaches without losing the main thread.",
  },
];
