import type { Route } from "./+types/signup";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import AuthLayout from "~/components/AuthLayout";
import AuthForm from "~/components/AuthForm";

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
      subtitle={inviteToken ? "Create your account to accept the organization invitation" : "Start building with Nowgai in minutes."}
      footer={
        <p className="text-xs text-muted-foreground text-center">
          By creating an account, you agree to our{" "}
          <Link to="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
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
