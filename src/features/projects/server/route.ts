import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { TaskStatus } from "@/features/tasks/types";
import { getMember } from "@/features/members/utils";

import { connectToDatabase } from "@/lib/mongodb";
import { sessionMiddleware } from "@/lib/session-middleware";
import { ProjectModel } from "@/models/project.model";
import { TaskModel } from "@/models/task.model";

import { createProjectSchema, updateProjectSchema } from "../schemas";

const app = new Hono()
  .post(
    "/",
    sessionMiddleware,
    zValidator("form", createProjectSchema),
    async (c) => {
      const user = c.get("user");

      const { name, image, workspaceId } = c.req.valid("form");

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // NOTE: image upload is not implemented yet; only string URLs are accepted.
      const imageUrl = typeof image === "string" ? image : undefined;

      const project = await ProjectModel.create({
        name,
        imageUrl,
        workspaceId,
      });

      return c.json({ data: project.toJSON() });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");

      const { workspaceId } = c.req.valid("query");

      if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
      }

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const projects = await ProjectModel.find({ workspaceId }).sort({ createdAt: -1 });

      return c.json({
        data: {
          documents: projects.map((project) => project.toJSON()),
          total: projects.length,
        },
      });
    }
  )
  .get(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { projectId } = c.req.param();

      await connectToDatabase();

      const project = await ProjectModel.findById(projectId);

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: project.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({ data: project.toJSON() });
    }
  )
  .patch(
    "/:projectId",
    sessionMiddleware,
    zValidator("form", updateProjectSchema),
    async (c) => {
      const user = c.get("user");

      const { projectId } = c.req.param();
      const { name, image } = c.req.valid("form");

      await connectToDatabase();

      const existingProject = await ProjectModel.findById(projectId);

      if (!existingProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: existingProject.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // NOTE: image upload is not implemented yet; only string URLs are accepted.
      const imageUrl = typeof image === "string" ? image : undefined;

      existingProject.name = name ?? existingProject.name;
      existingProject.imageUrl = imageUrl;
      await existingProject.save();

      return c.json({ data: existingProject.toJSON() });
    }
  )
  .delete(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");

      const { projectId } = c.req.param();

      await connectToDatabase();

      const existingProject = await ProjectModel.findById(projectId);

      if (!existingProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: existingProject.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await TaskModel.deleteMany({ projectId });
      await existingProject.deleteOne();

      return c.json({ data: { $id: existingProject.id } });
    }
  )
  .get(
    "/:projectId/analytics",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { projectId } = c.req.param();

      await connectToDatabase();

      const project = await ProjectModel.findById(projectId);

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const member = await getMember({
        workspaceId: project.workspaceId,
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
        TaskModel.countDocuments({ projectId, ...filter });

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
