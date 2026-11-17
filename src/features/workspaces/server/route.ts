import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { MemberRole } from "@/features/members/types";
import { TaskStatus } from "@/features/tasks/types";
import { getMember } from "@/features/members/utils";

import { generateInviteCode } from "@/lib/utils";
import { connectToDatabase } from "@/lib/mongodb";
import { sessionMiddleware } from "@/lib/session-middleware";
import { MemberModel } from "@/models/member.model";
import { TaskModel } from "@/models/task.model";
import { WorkspaceModel } from "@/models/workspace.model";

import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");

    await connectToDatabase();

    const members = await MemberModel.find({ userId: user.$id });

    if (members.length === 0) {
      return c.json({ data: { documents: [], total: 0 } });
    }

    const workspaceIds = members.map((member) => member.workspaceId);

    const workspaces = await WorkspaceModel.find({ _id: { $in: workspaceIds } }).sort({ createdAt: -1 });

    return c.json({
      data: {
        documents: workspaces.map((workspace) => workspace.toJSON()),
        total: workspaces.length,
      },
    });
  })
  .get(
    "/:workspaceId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.param();

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const workspace = await WorkspaceModel.findById(workspaceId);

      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      return c.json({ data: workspace.toJSON() });
    }
  )
  .get(
    "/:workspaceId/info",
    sessionMiddleware,
    async (c) => {
      const { workspaceId } = c.req.param();

      await connectToDatabase();

      const workspace = await WorkspaceModel.findById(workspaceId);

      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      return c.json({
        data: {
          $id: workspace.id,
          name: workspace.name,
          imageUrl: workspace.imageUrl,
        }
      });
    }
  )
  .post(
    "/",
    zValidator("form", createWorkspaceSchema),
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");

      const { name, image } = c.req.valid("form");

      await connectToDatabase();

      // NOTE: image upload is not implemented yet; only string URLs are accepted.
      const imageUrl = typeof image === "string" ? image : undefined;

      const workspace = await WorkspaceModel.create({
        name,
        userId: user.$id,
        imageUrl,
        inviteCode: generateInviteCode(6),
      });

      await MemberModel.create({
        userId: user.$id,
        workspaceId: workspace.id,
        role: MemberRole.ADMIN,
      });

      return c.json({ data: workspace.toJSON() });
    }
  )
  .patch(
    "/:workspaceId",
    sessionMiddleware,
    zValidator("form", updateWorkspaceSchema),
    async (c) => {
      const user = c.get("user");

      const { workspaceId } = c.req.param();
      const { name, image } = c.req.valid("form");

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member || member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // NOTE: image upload is not implemented yet; only string URLs are accepted.
      const imageUrl = typeof image === "string" ? image : undefined;

      const workspace = await WorkspaceModel.findByIdAndUpdate(
        workspaceId,
        { name, imageUrl },
        { new: true },
      );

      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      return c.json({ data: workspace.toJSON() });
    }
  )
  .delete(
    "/:workspaceId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");

      const { workspaceId } = c.req.param();

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member || member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await MemberModel.deleteMany({ workspaceId });
      await TaskModel.deleteMany({ workspaceId });
      await WorkspaceModel.findByIdAndDelete(workspaceId);

      return c.json({ data: { $id: workspaceId } });
    }
  )
  .post(
    "/:workspaceId/reset-invite-code",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");

      const { workspaceId } = c.req.param();

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member || member.role !== MemberRole.ADMIN) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const workspace = await WorkspaceModel.findByIdAndUpdate(
        workspaceId,
        { inviteCode: generateInviteCode(6) },
        { new: true },
      );

      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      return c.json({ data: workspace.toJSON() });
    }
  )
  .post(
    "/:workspaceId/join",
    sessionMiddleware,
    zValidator("json", z.object({ code: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.param();
      const { code } = c.req.valid("json");

      const user = c.get("user");

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (member) {
        return c.json({ error: "Already a member" }, 400);
      }

      const workspace = await WorkspaceModel.findById(workspaceId);

      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      if (workspace.inviteCode !== code) {
        return c.json({ error: "Invalid invite code" }, 400);
      }

      await MemberModel.create({
        workspaceId,
        userId: user.$id,
        role: MemberRole.MEMBER,
      });

      return c.json({ data: workspace.toJSON() });
    }
  )
  .get(
    "/:workspaceId/analytics",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.param();

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const countTasks = (filter: Record<string, unknown>) =>
        TaskModel.countDocuments({ workspaceId, ...filter });

      const taskCount = await countTasks({
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      });
      const lastMonthTaskCount = await countTasks({
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      });
      const taskDifference = taskCount - lastMonthTaskCount;

      const assignedTaskCount = await countTasks({
        assigneeId: member.$id,
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      });
      const lastMonthAssignedTaskCount = await countTasks({
        assigneeId: member.$id,
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      });
      const assignedTaskDifference = assignedTaskCount - lastMonthAssignedTaskCount;

      const incompleteTaskCount = await countTasks({
        status: { $ne: TaskStatus.DONE },
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      });
      const lastMonthIncompleteTaskCount = await countTasks({
        status: { $ne: TaskStatus.DONE },
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      });
      const incompleteTaskDifference = incompleteTaskCount - lastMonthIncompleteTaskCount;

      const completedTaskCount = await countTasks({
        status: TaskStatus.DONE,
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      });
      const lastMonthCompletedTaskCount = await countTasks({
        status: TaskStatus.DONE,
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      });
      const completedTaskDifference = completedTaskCount - lastMonthCompletedTaskCount;

      const overdueTaskCount = await countTasks({
        status: { $ne: TaskStatus.DONE },
        dueDate: { $lt: now },
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      });
      const lastMonthOverdueTaskCount = await countTasks({
        status: { $ne: TaskStatus.DONE },
        dueDate: { $lt: now },
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      });
      const overdueTaskDifference = overdueTaskCount - lastMonthOverdueTaskCount;

      return c.json({
        data: {
          taskCount,
          taskDifference,
          assignedTaskCount,
          assignedTaskDifference,
          completedTaskCount,
          completedTaskDifference,
          incompleteTaskCount,
          incompleteTaskDifference,
          overdueTaskCount,
          overdueTaskDifference,
        },
      });
    }
  )

export default app;
