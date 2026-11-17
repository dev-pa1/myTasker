import { BaseDocument } from "@/lib/document";

export enum MemberRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER"
};

export type Member = BaseDocument & {
  workspaceId: string;
  userId: string;
  role: MemberRole;
  name: string;
  email: string;
};
