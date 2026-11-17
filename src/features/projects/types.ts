import { BaseDocument } from "@/lib/document";

export type Project = BaseDocument & {
  name: string;
  imageUrl: string;
  workspaceId: string;
};
