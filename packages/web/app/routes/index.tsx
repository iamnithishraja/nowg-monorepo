import type { Route } from "./+types/index";
import { redirect } from "react-router";
import { auth } from "../lib/auth";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (session) {
    throw redirect("/home");
  }

  throw redirect("/signin");
}

