import "server-only";

import { Schema } from "mongoose";

export function withDocumentTransform(schema: Schema) {
  schema.set("timestamps", true);
  schema.set("toJSON", {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.$id = ret._id.toString();
      ret.$createdAt = ret.createdAt?.toISOString?.() ?? ret.createdAt;
      ret.$updatedAt = ret.updatedAt?.toISOString?.() ?? ret.updatedAt;

      delete ret._id;
      delete ret.id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      delete ret.password;

      for (const key of Object.keys(ret)) {
        if (ret[key] instanceof Date) {
          ret[key] = ret[key].toISOString();
        }
      }

      return ret;
    },
  });

  return schema;
}
