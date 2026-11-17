import { BaseDocument } from "@/lib/document";

export type Workspace = BaseDocument & {
  name: string;
  imageUrl: string;
  inviteCode: string;
  userId: string;
};
