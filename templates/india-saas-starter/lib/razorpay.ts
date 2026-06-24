/** Razorpay subscription helpers — India SaaS starter template */

export type SaasPlan = "lite" | "pro" | "team";

const PLAN_AMOUNTS_INR: Record<SaasPlan, number> = {
  lite: 19900,
  pro: 49900,
  team: 129900,
};

export function planAmountPaise(plan: SaasPlan): number {
  return PLAN_AMOUNTS_INR[plan];
}

export async function createSubscriptionOrder(plan: SaasPlan, customerEmail: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    throw new Error("RAZORPAY_KEY_ID is not configured");
  }
  return {
    key_id: keyId,
    amount: planAmountPaise(plan),
    currency: "INR",
    notes: { plan, customerEmail },
  };
}
