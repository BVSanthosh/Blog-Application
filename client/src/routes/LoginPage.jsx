import { SignIn } from "@clerk/clerk-react";

const LoginPage = () => {
  return (
    // Was h-[calc(100vh-80)] — a length with no unit, which Tailwind emits but
    // the browser discards, so the wrapper had no height at all.
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] py-8">
      <SignIn signUpUrl="/register" />
    </div>
  );
};

export default LoginPage;
