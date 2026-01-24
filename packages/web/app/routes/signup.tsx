import { Link, useSearchParams } from "react-router";
import AuthForm from "~/components/AuthForm";
import AuthLayout from "~/components/AuthLayout";
import type { Route } from "./+types/signup";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign up - Nowgai" },
    { name: "description", content: "Create your Nowgai account" },
  ];
}

export default function SignUp() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("inviteToken");

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        inviteToken
          ? "Create your account to accept the organization invitation"
          : "Start building with Nowgai in minutes."
      }
      footer={
        <p className="text-xs text-white/40 text-center">
          By creating an account, you agree to our{" "}
          <Link
            to="/privacy-policy"
            className="text-white/60 hover:text-white underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </Link>
          .
        </p>
      }
    >
      <AuthForm initialTab="signup" inviteToken={inviteToken || undefined} />
    </AuthLayout>
  );
}
