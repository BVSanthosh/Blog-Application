import { SignUp } from "@clerk/clerk-react";

const RegisterPage = () => {
  return (
    // Was h-[calc(100vh - 80)]: the spaces make it an invalid arbitrary value,
    // so Tailwind generated no class whatsoever.
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] py-8">
      <SignUp signInUrl="/login" />
    </div>
  );
};

export default RegisterPage;
