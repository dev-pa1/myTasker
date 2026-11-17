import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { connectToDatabase } from "@/lib/mongodb";
import { sessionMiddleware } from "@/lib/session-middleware";
import { UserModel } from "@/models/user.model";
import { MemberModel } from "@/models/member.model";

import { getMember } from "../utils";
import { MemberRole } from "../types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const members = await MemberModel.find({ workspaceId }).sort({ createdAt: -1 });

      const populatedMembers = await Promise.all(
        members.map(async (member) => {
          const memberUser = await UserModel.findById(member.userId);

          return {
            ...member.toJSON(),
            name: memberUser?.name || memberUser?.email,
            email: memberUser?.email,
          };
        })
      );

      return c.json({
        data: {
          documents: populatedMembers,
          total: populatedMembers.length,
        },
      });
    }
  )
  .delete(
    "/:memberId",
    sessionMiddleware,
    async (c) => {
      const { memberId } = c.req.param();
      const user = c.get("user");

      await connectToDatabase();

      const memberToDelete = await MemberModel.findById(memberId);

      if (!memberToDelete) {
        return c.json({ error: "Member not found" }, 404);
      }

      const allMembersInWorkspace = await MemberModel.find({ workspaceId: memberToDelete.workspaceId });

      const member = await getMember({
        workspaceId: memberToDelete.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (member.$id !== memberToDelete.id && member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (allMembersInWorkspace.length === 1) {
        return c.json({ error: "Cannot delete the only member" }, 400);
      }

      await memberToDelete.deleteOne();

      return c.json({ data: { $id: memberToDelete.id } });
    }
  )
  .patch(
    "/:memberId",
    sessionMiddleware,
    zValidator("json", z.object({ role: z.nativeEnum(MemberRole) })),
    async (c) => {
      const { memberId } = c.req.param();
      const { role } = c.req.valid("json");
      const user = c.get("user");

      await connectToDatabase();

      const memberToUpdate = await MemberModel.findById(memberId);

      if (!memberToUpdate) {
        return c.json({ error: "Member not found" }, 404);
      }

      const allMembersInWorkspace = await MemberModel.find({ workspaceId: memberToUpdate.workspaceId });

      const member = await getMember({
        workspaceId: memberToUpdate.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (allMembersInWorkspace.length === 1) {
        return c.json({ error: "Cannot downgrade the only member" }, 400);
      }

      memberToUpdate.role = role;
      await memberToUpdate.save();

      return c.json({ data: { $id: memberToUpdate.id } });
    }
  )

export default app;
