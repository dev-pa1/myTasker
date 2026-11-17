import "server-only";

import { cookies } from "next/headers";

import { connectToDatabase } from "@/lib/mongodb";
import { verifySessionToken } from "@/lib/session";
import { UserModel } from "@/models/user.model";

import { AUTH_COOKIE } from "./constants";

export const getCurrent = async () => {
  try {
    const token = cookies().get(AUTH_COOKIE)?.value;

    if (!token) {
      return null;
    }

    const payload = verifySessionToken(token);

    if (!payload) {
      return null;
    }

    await connectToDatabase();

    const user = await UserModel.findById(payload.userId);

    if (!user) {
      return null;
    }

    return {
      $id: user.id,
      name: user.name,
      email: user.email,
    };
  } catch {
    return null;
  }
};
