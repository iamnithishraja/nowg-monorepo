import { Button } from "@/components/ui/button";
import { Zap, Shield, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-xl font-semibold" data-testid="text-logo">AI Code Platform</span>
          </div>
          <a href="/login">
            <Button data-testid="button-login">Log In</Button>
          </a>
        </div>
      </header>
      
      <main className="flex-1">
        <section className="px-6 py-20 text-center max-w-5xl mx-auto">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Build Faster with AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The most powerful AI code platform for developers. Create, deploy, and scale applications effortlessly with AI-powered tools.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/login">
              <Button size="lg" data-testid="button-get-started">
                Get Started Free
              </Button>
            </a>
          </div>
        </section>

        <section className="px-6 py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Why Developers Choose Us</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-6 rounded-lg border">
                <Zap className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
                <p className="text-muted-foreground">
                  Build and deploy in seconds with our AI-powered code generation and optimization.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border">
                <Shield className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Secure by Default</h3>
                <p className="text-muted-foreground">
                  Enterprise-grade security with role-based access control and encrypted storage.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border">
                <Users className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
                <p className="text-muted-foreground">
                  Work together seamlessly with real-time collaboration and project management.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/30 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2025 AI Code Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
