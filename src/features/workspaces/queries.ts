import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { getCurrent } from "@/features/auth/queries";
import { MemberModel } from "@/models/member.model";
import { WorkspaceModel } from "@/models/workspace.model";

export const getWorkspaces = async () => {
  const user = await getCurrent();

  if (!user) {
    return { documents: [], total: 0 };
  }

  await connectToDatabase();

  const members = await MemberModel.find({ userId: user.$id });

  if (members.length === 0) {
    return { documents: [], total: 0 };
  }

  const workspaceIds = members.map((member) => member.workspaceId);

  const workspaces = await WorkspaceModel.find({ _id: { $in: workspaceIds } }).sort({ createdAt: -1 });

  return {
    documents: workspaces.map((workspace) => workspace.toJSON()),
    total: workspaces.length,
  };
};
