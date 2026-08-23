import type { ReactNode } from "react";

interface ContainerVerifyEmailProps {
  children: ReactNode;
}

const ContainerVerifyEmail = ({ children }: ContainerVerifyEmailProps) => {
  return (
    <div className="flex items-center justify-center w-full h-screen">
      {children}
    </div>
  );
};

export default ContainerVerifyEmail;
