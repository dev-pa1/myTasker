import "server-only";

import { MemberModel } from "@/models/member.model";

interface GetMemberProps {
  workspaceId: string;
  userId: string;
};

export const getMember = async ({
  workspaceId,
  userId,
}: GetMemberProps) => {
  const member = await MemberModel.findOne({ workspaceId, userId });

  return member ? member.toJSON() : null;
};
