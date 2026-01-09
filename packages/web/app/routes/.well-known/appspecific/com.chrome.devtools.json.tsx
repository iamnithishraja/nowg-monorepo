import type { LoaderFunctionArgs } from "react-router";

// Resource route to satisfy Chrome DevTools request:
// /.well-known/appspecific/com.chrome.devtools.json
export async function loader(_args: LoaderFunctionArgs) {
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}


