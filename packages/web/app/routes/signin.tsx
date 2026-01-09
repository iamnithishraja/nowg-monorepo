import type { Route } from "./+types/signin";
import { useState } from "react";
import { Link, redirect, useSearchParams } from "react-router";
import { signIn, authClient } from "../lib/authClient";
import { auth } from "../lib/auth";
import AuthLayout from "~/components/AuthLayout";
import AuthForm from "~/components/AuthForm";
// cleaned unused UI imports

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
      title="Welcome"
      subtitle={
        inviteToken
          ? "Sign in to accept the organization invitation"
          : "Continue bringing your ideas to life."
      }
      footer={
        <p className="text-xs text-muted-foreground text-center">
          By continuing, you agree to our{" "}
          <Link
            to="/privacy-policy"
            className="underline underline-offset-2 hover:text-foreground"
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
