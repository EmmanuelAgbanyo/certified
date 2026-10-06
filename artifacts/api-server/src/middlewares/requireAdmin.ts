import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const allowedEmail = process.env.CERTIFICATE_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    req.log.error("CERTIFICATE_ADMIN_EMAIL is not configured");
    res.status(503).json({ error: "Administrator access is not configured." });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const verifiedAdminAddress = user.emailAddresses.find(
      (item) =>
        item.emailAddress.trim().toLowerCase() === allowedEmail &&
        item.verification?.status === "verified",
    );
    if (!verifiedAdminAddress) {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }

    next();
  } catch (error) {
    req.log.error({ err: error }, "Unable to verify administrator account");
    res.status(503).json({ error: "Unable to verify administrator access." });
  }
}
