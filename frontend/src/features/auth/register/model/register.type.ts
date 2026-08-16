import type { User } from "@/entities/user/model/userTypes";

export interface RegisterResponse {
  status: string;
  message: string;
  data: User;
}