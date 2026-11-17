import "server-only";

import { Schema, model, models, type Document } from "mongoose";

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
});

userSchema.set("timestamps", true);
userSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, any>) => {
    ret.$id = ret._id.toString();
    delete ret._id;
    delete ret.id;
    delete ret.__v;
    delete ret.password;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
  },
});

export const UserModel = models.User ?? model<UserDocument>("User", userSchema);
