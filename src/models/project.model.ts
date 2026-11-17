import "server-only";

import { Schema, model, models, type Document } from "mongoose";

import { withDocumentTransform } from "@/lib/mongoose-schema";

export interface ProjectDocument extends Document {
  name: string;
  imageUrl?: string;
  workspaceId: string;
}

const projectSchema = withDocumentTransform(
  new Schema<ProjectDocument>({
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    workspaceId: { type: String, required: true },
  }),
);

export const ProjectModel = models.Project ?? model<ProjectDocument>("Project", projectSchema);
