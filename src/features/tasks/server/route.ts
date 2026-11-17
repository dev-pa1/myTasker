import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { getMember } from "@/features/members/utils";
import { ProjectModel } from "@/models/project.model";

import { connectToDatabase } from "@/lib/mongodb";
import { sessionMiddleware } from "@/lib/session-middleware";
import { MemberModel } from "@/models/member.model";
import { TaskModel } from "@/models/task.model";
import { UserModel } from "@/models/user.model";

import { TaskStatus } from "../types";
import { createTaskSchema } from "../schemas";

const app = new Hono()
  .delete(
    "/:taskId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { taskId } = c.req.param();

      await connectToDatabase();

      const task = await TaskModel.findById(taskId);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const member = await getMember({
        workspaceId: task.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await task.deleteOne();

      return c.json({ data: { $id: task.id } });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.nativeEnum(TaskStatus).nullish(),
        search: z.string().nullish(),
        dueDate: z.string().nullish(),
      })
    ),
    async (c) => {
      const user = c.get("user");

      const {
        workspaceId,
        projectId,
        status,
        search,
        assigneeId,
        dueDate,
      } = c.req.valid("query");

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const filter: Record<string, unknown> = { workspaceId };

      if (projectId) {
        filter.projectId = projectId;
      }

      if (status) {
        filter.status = status;
      }

      if (assigneeId) {
        filter.assigneeId = assigneeId;
      }

      if (dueDate) {
        filter.dueDate = new Date(dueDate);
      }

      if (search) {
        filter.name = { $regex: search, $options: "i" };
      }

      const tasks = await TaskModel.find(filter).sort({ createdAt: -1 });

      const projectIds = tasks.map((task) => task.projectId);
      const assigneeIds = tasks.map((task) => task.assigneeId);

      const projects = await ProjectModel.find({ _id: { $in: projectIds } });
      const members = await MemberModel.find({ _id: { $in: assigneeIds } });

      const assignees = await Promise.all(
        members.map(async (member) => {
          const memberUser = await UserModel.findById(member.userId);

          return {
            ...member.toJSON(),
            name: memberUser?.name || memberUser?.email,
            email: memberUser?.email,
          };
        })
      );

      const populatedTasks = tasks.map((task) => {
        const project = projects.find(
          (project) => project.id === task.projectId,
        );
        const assignee = assignees.find(
          (assignee) => assignee.$id === task.assigneeId,
        );

        return {
          ...task.toJSON(),
          project: project?.toJSON(),
          assignee,
        };
      });

      return c.json({
        data: {
          documents: populatedTasks,
          total: populatedTasks.length,
        },
      });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTaskSchema),
    async (c) => {
      const user = c.get("user");
      const {
        name,
        status,
        workspaceId,
        projectId,
        dueDate,
        assigneeId
      } = c.req.valid("json");

      await connectToDatabase();

      const member = await getMember({
        workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const highestPositionTask = await TaskModel
        .findOne({ status, workspaceId })
        .sort({ position: 1 });

      const newPosition = highestPositionTask
        ? highestPositionTask.position + 1000
        : 1000;

      const task = await TaskModel.create({
        name,
        status,
        workspaceId,
        projectId,
        dueDate,
        assigneeId,
        position: newPosition,
      });

      return c.json({ data: task.toJSON() });
    }
  )
  .patch(
    "/:taskId",
    sessionMiddleware,
    zValidator("json", createTaskSchema.partial()),
    async (c) => {
      const user = c.get("user");
      const {
        name,
        status,
        description,
        projectId,
        dueDate,
        assigneeId
      } = c.req.valid("json");
      const { taskId } = c.req.param();

      await connectToDatabase();

      const existingTask = await TaskModel.findById(taskId);

      if (!existingTask) {
        return c.json({ error: "Task not found" }, 404);
      }

      const member = await getMember({
        workspaceId: existingTask.workspaceId,
        userId: user.$id
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (name !== undefined) existingTask.name = name;
      if (status !== undefined) existingTask.status = status;
      if (projectId !== undefined) existingTask.projectId = projectId;
      if (dueDate !== undefined) existingTask.dueDate = dueDate;
      if (assigneeId !== undefined) existingTask.assigneeId = assigneeId;
      if (description !== undefined) existingTask.description = description;

      await existingTask.save();

      return c.json({ data: existingTask.toJSON() });
    }
  )
  .get(
    "/:taskId",
    sessionMiddleware,
    async (c) => {
      const currentUser = c.get("user");
      const { taskId } = c.req.param();

      await connectToDatabase();

      const task = await TaskModel.findById(taskId);

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const currentMember = await getMember({
        workspaceId: task.workspaceId,
        userId: currentUser.$id,
      });

      if (!currentMember) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const project = await ProjectModel.findById(task.projectId);
      const member = await MemberModel.findById(task.assigneeId);

      if (!member) {
        return c.json({ error: "Assignee not found" }, 404);
      }

      const memberUser = await UserModel.findById(member.userId);

      const assignee = {
        ...member.toJSON(),
        name: memberUser?.name || memberUser?.email,
        email: memberUser?.email,
      };

      return c.json({
        data: {
          ...task.toJSON(),
          project: project?.toJSON(),
          assignee,
        },
      });
    }
  )
  .post(
    "/bulk-update",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            $id: z.string(),
            status: z.nativeEnum(TaskStatus),
            position: z.number().int().positive().min(1000).max(1_000_000),
          })
        )
      })
    ),
    async (c) => {
      const user = c.get("user");
      const { tasks } = await c.req.valid("json");

      await connectToDatabase();

      const tasksToUpdate = await TaskModel.find({ _id: { $in: tasks.map((task) => task.$id) } });

      const workspaceIds = new Set(tasksToUpdate.map(task => task.workspaceId));
      if (workspaceIds.size !== 1) {
        return c.json({ error: "All tasks must belong to the same workspace" })
      }

      const workspaceId = workspaceIds.values().next().value;

      if (!workspaceId) {
        return c.json({ error: "Workspace ID is required" }, 400);
      }

      const member = await getMember({
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const { $id, status, position } = task;

          return TaskModel.findByIdAndUpdate(
            $id,
            { status, position },
            { new: true },
          );
        })
      );

      return c.json({ data: updatedTasks.map((task) => task?.toJSON()) });
    }
  )

export default app;
