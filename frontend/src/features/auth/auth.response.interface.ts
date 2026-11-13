export interface RegisterResponseData {
  id: string;
  email: string;
  role: "BUYER";
  status: "UNVERIFIED";
  createdAt: string;
}

export interface RegisterResponse {
  status: "success";
  message: string;
  data: RegisterResponseData;
}

export interface LoginResponseData {
  user: {
    id: string;
    email: string;
    role: "ADMIN" | "BUYER";
    status: "UNVERIFIED" | "ACTIVE" | "SUSPENDED";
    createdAt: string;
  };
}

export interface LoginResponse {
  status: "success";
  message: string;
  data: LoginResponseData;
}
