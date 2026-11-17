import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { deleteCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";

import { connectToDatabase } from "@/lib/mongodb";
import { createSessionToken } from "@/lib/session";
import { sessionMiddleware } from "@/lib/session-middleware";
import { UserModel } from "@/models/user.model";

import { AUTH_COOKIE } from "../constants";
import { loginSchema, registerSchema } from "../schemas";

const app = new Hono()
  .get(
    "/current",
    sessionMiddleware,
    (c) => {
      const user = c.get("user");

      return c.json({ data: user });
    }
  )
  .post(
    "/login",
    zValidator("json", loginSchema),
    async (c) => {
      const { email, password } = c.req.valid("json");

      await connectToDatabase();

      const user = await UserModel.findOne({ email: email.toLowerCase() });

      if (!user) {
        return c.json({ error: "Invalid email or password" }, 401);
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        return c.json({ error: "Invalid email or password" }, 401);
      }

      const token = createSessionToken({ userId: user.id });

      setCookie(c, AUTH_COOKIE, token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 30,
      });

      return c.json({ success: true });
    }
  )
  .post(
    "/register",
    zValidator("json", registerSchema),
    async (c) => {
      const { name, email, password } = c.req.valid("json");

      await connectToDatabase();

      const existingUser = await UserModel.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        return c.json({ error: "An account with this email already exists" }, 409);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await UserModel.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      });

      const token = createSessionToken({ userId: user.id });

      setCookie(c, AUTH_COOKIE, token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 30,
      });

      return c.json({ success: true });
    }
  )
  .post("/logout", sessionMiddleware, async (c) => {
    deleteCookie(c, AUTH_COOKIE);

    return c.json({ success: true });
  });

export default app;
