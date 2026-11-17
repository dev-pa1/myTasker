import "server-only";

import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { AUTH_COOKIE } from "@/features/auth/constants";

import { connectToDatabase } from "./mongodb";
import { verifySessionToken } from "./session";
import { UserModel } from "@/models/user.model";

export type SessionUser = {
  $id: string;
  name: string;
  email: string;
};

type AdditionalContext = {
  Variables: {
    user: SessionUser;
  };
};

export const sessionMiddleware = createMiddleware<AdditionalContext>(
  async (c, next) => {
    const token = getCookie(c, AUTH_COOKIE);

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = verifySessionToken(token);

    if (!payload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await connectToDatabase();

    const user = await UserModel.findById(payload.userId);

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", {
      $id: user.id,
      name: user.name,
      email: user.email,
    });

    await next();
  },
);
