import { Router } from "express";
import { z } from "zod";
import { revenueCatEntitlementId, revenueCatWebhookAuthToken } from "../config.js";
import { upsertSubscriptionEntitlement } from "../shared/subscriptionEntitlements.js";
const revenueCatEventSchema = z.object({
    event: z
        .object({
        app_user_id: z.string().trim().min(1),
        type: z.string().trim().min(1),
        product_id: z.string().trim().min(1).nullable().optional(),
        entitlement_id: z.string().trim().min(1).nullable().optional(),
        entitlement_ids: z.array(z.string().trim().min(1)).optional(),
        expiration_at_ms: z.number().nullable().optional()
    })
        .passthrough()
});
export const revenueCatRouter = Router();
function isAuthorized(headerValue) {
    if (!revenueCatWebhookAuthToken) {
        return false;
    }
    const value = headerValue?.trim();
    if (!value) {
        return false;
    }
    return value === revenueCatWebhookAuthToken || value === `Bearer ${revenueCatWebhookAuthToken}`;
}
function isActiveEvent(eventType, expiresAt) {
    if (eventType === "EXPIRATION") {
        return false;
    }
    return expiresAt === null || expiresAt.getTime() > Date.now();
}
revenueCatRouter.post("/webhooks/revenuecat", async (req, res) => {
    if (!isAuthorized(req.header("Authorization"))) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const parsed = revenueCatEventSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const event = parsed.data.event;
    const eventType = event.type.trim().toUpperCase();
    const expiresAt = typeof event.expiration_at_ms === "number" && Number.isFinite(event.expiration_at_ms)
        ? new Date(event.expiration_at_ms)
        : null;
    const entitlementIdentifier = event.entitlement_id ?? event.entitlement_ids?.[0] ?? null;
    const isActive = entitlementIdentifier === revenueCatEntitlementId && isActiveEvent(eventType, expiresAt);
    try {
        await upsertSubscriptionEntitlement({
            supabaseUserId: event.app_user_id,
            isActive,
            productIdentifier: event.product_id ?? null,
            entitlementIdentifier,
            expiresAt,
            rawPayload: req.body
        });
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
