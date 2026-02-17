import {
  GithubLogo,
  Play,
  Rocket,
  Sparkle,
  Terminal,
  Users
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import logo from "../assets/logo.png";
import GradientGlow from "./GradientGlow";

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
    <div className="min-h-screen h-screen bg-[#0c0c0c] text-white flex overflow-hidden">
      {/* Gradient Background - covers entire screen */}
      <GradientGlow />

      {/* Left Panel - Brand Showcase */}
      <aside className="hidden lg:flex w-[52%] xl:w-[55%] relative z-10 overflow-hidden">
        {/* Subtle grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="mx-auto max-w-xl px-12 xl:px-16 py-12 flex flex-col justify-between w-full relative z-10">
          {/* Logo */}
          <header className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <img
                src={logo}
                alt="Nowgai"
                className="h-36 w-auto rounded-lg shadow-lg shadow-black/20"
              />
            </Link>
          </header>

          {/* Main Content */}
          <div className="space-y-8 -mt-8">
            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                Ship ideas
                <span className="block mt-2 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  at the speed of thought
                </span>
              </h1>
              <p className="text-lg text-white/50 leading-relaxed max-w-md">
                Describe what you want and watch it come to life with clean
                code, live preview, and instant deploys.
              </p>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Play, label: "Live preview" },
                { icon: GithubLogo, label: "GitHub import" },
                { icon: Rocket, label: "1-click deploy" },
                { icon: Users, label: "Collab ready" },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-medium hover:bg-white/[0.06] hover:border-white/[0.12] transition-all cursor-default"
                >
                  <feature.icon className="w-3.5 h-3.5" weight="bold" />
                  {feature.label}
                </div>
              ))}
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="group p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Terminal className="w-4 h-4" weight="bold" />
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    AI Workspace
                  </span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">
                  Chat, edit, and preview—all side by side.
                </p>
                <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="group p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                    <Sparkle className="w-4 h-4" weight="bold" />
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    Smart Templates
                  </span>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">
                  Starter templates to move even faster.
                </p>
                <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-pink-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <footer className="flex items-center gap-4 text-sm text-white/40">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-[#0c0c0c] flex items-center justify-center"
                >
                  {/* <span className="text-[10px] font-medium text-white/60">
                    {String.fromCharCode(64 + i)}
                  </span> */}
                </div>
              ))}
            </div>
            <span>Trusted by 10k+ builders and teams</span>
          </footer>
        </div>

        {/* Right edge gradient fade */}
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-r from-transparent to-[#0c0c0c]/50 pointer-events-none" />
      </aside>

      {/* Right Panel - Auth Form */}
      <main className="flex-1 flex items-start justify-center px-6 py-8 relative bg-[#111111]/60 backdrop-blur-sm overflow-y-auto">
        {/* Simple divider */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-white/10" />

        <div className="w-full max-w-md relative flex flex-col min-h-[calc(100vh-4rem)] justify-center">
          {/* Simple Header */}
          <div className="mb-10 text-center">
            {/* Mobile logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <Link to="/" className="block">
                <img
                  src={logo}
                  alt="Nowgai"
                  className="h-16 w-auto"
                />
              </Link>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold text-white tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-white/60">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Enhanced Form Card */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-xl">
            <div className="space-y-6">
              {children}
            </div>
          </div>

          {/* Simple Footer */}
          {footer && (
            <div className="mt-8 text-center">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
