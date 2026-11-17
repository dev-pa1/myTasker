import "server-only";

import { Schema, model, models, type Document } from "mongoose";

import { withDocumentTransform } from "@/lib/mongoose-schema";
import { TaskStatus } from "@/features/tasks/types";

export interface TaskDocument extends Document {
  name: string;
  status: TaskStatus;
  workspaceId: string;
  assigneeId: string;
  projectId: string;
  position: number;
  dueDate: Date;
  description?: string;
}

const taskSchema = withDocumentTransform(
  new Schema<TaskDocument>({
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(TaskStatus), required: true },
    workspaceId: { type: String, required: true },
    assigneeId: { type: String, required: true },
    projectId: { type: String, required: true },
    position: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    description: { type: String },
  }),
);

export const TaskModel = models.Task ?? model<TaskDocument>("Task", taskSchema);
