import type { Route } from "./+types/support";
import { useState } from "react";
import { Header } from "../components";
import { SidebarProvider } from "../components/ui/sidebar";
import { AppSidebar } from "../components/AppSidebar";
import Background from "../components/Background";
import GlowEffects from "../components/GlowEffects";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Support - Nowgai" },
    { name: "description", content: "Contact support via Gmail with your subject and message" },
  ];
}

export default function Support() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const openGmailCompose = () => {
    const params = new URLSearchParams();
    params.set("to", "support@nowg.ai");
    if (subject.trim()) params.set("su", subject.trim());
    if (message.trim()) params.set("body", message.trim());
    params.set("view", "cm");
    params.set("fs", "1");
    const gmailUrl = `https://mail.google.com/mail/?${params.toString()}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };

  const handleSend = () => {
    openGmailCompose();
  };

  const isDisabled = !subject.trim() || !message.trim();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Background />
          <GlowEffects />
        </div>

        <AppSidebar className="flex-shrink-0" />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header showAuthButtons={false} showSidebarToggle={true} />

          <main className="relative z-20 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
              <div className="max-w-3xl mx-auto p-[1px] rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-transparent">
                <Card className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/30">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-foreground">
                      Contact Support
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Subject</label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Briefly describe your issue"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Message</label>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Provide more details so we can help faster"
                        rows={8}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Button onClick={handleSend} disabled={isDisabled} className="min-w-28">
                        Send
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We’ll open a pre-filled email in Gmail. Review and send it from your account.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


