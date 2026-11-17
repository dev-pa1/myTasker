import "server-only";

import { Schema, model, models, type Document } from "mongoose";

import { withDocumentTransform } from "@/lib/mongoose-schema";
import { MemberRole } from "@/features/members/types";

export interface MemberDocument extends Document {
  workspaceId: string;
  userId: string;
  role: MemberRole;
}

const memberSchema = withDocumentTransform(
  new Schema<MemberDocument>({
    workspaceId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: Object.values(MemberRole), required: true },
  }),
);

export const MemberModel = models.Member ?? model<MemberDocument>("Member", memberSchema);
