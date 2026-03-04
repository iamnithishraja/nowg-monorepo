import { Link, redirect, useSearchParams } from "react-router";
import AuthForm from "~/components/AuthForm";
import AuthLayout from "~/components/AuthLayout";
import { auth } from "../lib/auth";
import type { Route } from "./+types/signin";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (session) {
    throw redirect("/home");
  }

  return null;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign in - Nowgai" },
    { name: "description", content: "Sign in to your Nowgai account" },
  ];
}

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("inviteToken");

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        inviteToken
          ? "Sign in to accept the organization invitation"
          : "Continue bringing your ideas to life."
      }
      footer={
        <p className="text-xs text-white/40 text-center">
          By continuing, you agree to our{" "}
          <Link
            to="/terms-and-conditions"
            className="text-white/60 hover:text-white underline underline-offset-2 transition-colors"
          >
            Terms and Conditions
          </Link>
          {" "}and{" "}
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
      <AuthForm initialTab="signin" inviteToken={inviteToken || undefined} />
    </AuthLayout>
  );
}
