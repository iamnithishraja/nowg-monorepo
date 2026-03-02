import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nowgai.app",
  appName: "Nowgai",
  webDir: "capacitor-web",
  server: {
    androidScheme: "https",
    // Set to your deployed web app URL so the native app loads it in the WebView.
    // Example: url: "https://app.nowgai.com"
    url: "https://app.nowg.ai",
  },
};

export default config;
