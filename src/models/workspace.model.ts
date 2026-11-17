import "server-only";

import { Schema, model, models, type Document } from "mongoose";

import { withDocumentTransform } from "@/lib/mongoose-schema";

export interface WorkspaceDocument extends Document {
  name: string;
  imageUrl?: string;
  inviteCode: string;
  userId: string;
}

const workspaceSchema = withDocumentTransform(
  new Schema<WorkspaceDocument>({
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    inviteCode: { type: String, required: true },
    userId: { type: String, required: true },
  }),
);

export const WorkspaceModel = models.Workspace ?? model<WorkspaceDocument>("Workspace", workspaceSchema);
