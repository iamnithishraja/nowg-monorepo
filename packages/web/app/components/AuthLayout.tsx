import type { ReactNode } from "react";
import { Link } from "react-router";
import Background from "./Background";
import GlowEffects from "./GlowEffects";
import { Badge } from "./ui/badge";
import { Github, Rocket, Sparkles, TerminalSquare, Zap } from "lucide-react";
import AnimatedHeadline from "./AnimatedHeadline";
import logo from "../assets/logo.png";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen relative text-foreground">
      {/* Ambient background */}
      <Background />
      <GlowEffects />

      <div className="relative z-10 flex min-h-screen">
        {/* Brand / Showcase Panel */}
        <aside className="hidden lg:flex w-[54%] xl:w-[58%] border-r border-border/60 bg-gradient-to-b from-background/60 to-background/20 backdrop-blur-xl relative overflow-hidden">
          {/* decorative mesh gradient */}
          <div className="pointer-events-none absolute inset-0 mesh-gradient opacity-60" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/5" />
          <div className="mx-auto max-w-2xl px-12 xl:px-16 py-18 flex flex-col gap-12 justify-between w-full">
            <header className="flex items-center gap-3 text-white">
              <img
                src={logo}
                alt="Nowgai"
                className="h-45 w-65 rounded-sm shadow-md shadow-black/30"
              />
            </header>

            <div className="space-y-7">
              <AnimatedHeadline className="[&>span:first-child]:text-5xl [&>span:first-child]:md:text-6xl" />
              <p className="text-muted-foreground/90 text-xl leading-relaxed max-w-xl">
                Describe what you want and watch it come to life with clean
                code, live preview, and instant deploys.
              </p>

              {/* feature badges with icons and hover micro-interactions */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Badge className="rounded-full px-3 py-1.5 hover:scale-[1.02] transition will-change-transform bg-white/10 text-white/90">
                  <Zap className="h-3.5 w-3.5 mr-1.5" /> Live preview
                </Badge>
                <Badge
                  className="rounded-full px-3 py-1.5 hover:scale-[1.02] transition will-change-transform"
                  variant="secondary"
                >
                  <Github className="h-3.5 w-3.5 mr-1.5" /> GitHub import
                </Badge>
                <Badge
                  className="rounded-full px-3 py-1.5 hover:scale-[1.02] transition will-change-transform"
                  variant="outline"
                >
                  <Rocket className="h-3.5 w-3.5 mr-1.5" /> 1‑click deploy
                </Badge>
                <Badge
                  className="rounded-full px-3 py-1.5 hover:scale-[1.02] transition will-change-transform"
                  variant="secondary"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Collab ready
                </Badge>
              </div>
            </div>

            {/* feature cards with hover glassmorphism */}
            <div className="grid grid-cols-2 gap-4 pt-6">
              <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-5 hover:bg-card/60 transition group">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TerminalSquare className="h-4 w-4 opacity-80" />
                  <p className="text-sm">AI workspace</p>
                </div>
                <p className="mt-2 text-sm text-foreground/90">
                  Chat, edit, and preview—side by side.
                </p>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-70 group-hover:opacity-100" />
              </div>
              <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-5 hover:bg-card/60 transition group">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4 opacity-80" />
                  <p className="text-sm">Smart snippets</p>
                </div>
                <p className="mt-2 text-sm text-foreground/90">
                  Starter templates to move faster.
                </p>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-70 group-hover:opacity-100" />
              </div>
            </div>

            {/* social proof */}
            <footer className="text-sm text-muted-foreground flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                <span className="inline-block h-6 w-6 rounded-full bg-white/20 border border-white/20" />
                <span className="inline-block h-6 w-6 rounded-full bg-white/20 border border-white/20" />
                <span className="inline-block h-6 w-6 rounded-full bg-white/20 border border-white/20" />
              </div>
              <span>Trusted by 10k+ builders and teams.</span>
            </footer>
          </div>
        </aside>

        {/* Form Panel */}
        <main className="flex-1 flex items-center justify-center px-6 py-12 relative">
          {/* subtle connector to relate to the left panel */}
          <div className="hidden lg:block absolute left-0 top-24 bottom-24 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          {/* subtle background grid */}
          <div className="pointer-events-none absolute inset-0 auth-grid opacity-10" />
          <div className="w-full max-w-lg">
            <div className="mb-8">
              <h2 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-2 text-sm text-muted-foreground/90">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <div className="relative">
              <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-white/20 via-white/10 to-transparent blur-[1px]" />
              <div className="relative bg-background/70 backdrop-blur-2xl border border-border/60 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/40">
                <div className="pointer-events-none absolute -inset-2 rounded-[28px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(139,92,246,0.15)_0deg,transparent_120deg,transparent_240deg,rgba(139,92,246,0.15)_360deg)] blur-2xl" />
                {children}
              </div>
            </div>
            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
