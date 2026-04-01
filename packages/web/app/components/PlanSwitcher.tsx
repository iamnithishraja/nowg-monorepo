import { Check, Info, Building2, Sparkles, ArrowRight, Zap } from "lucide-react";

interface PlanSwitcherProps {
  onPlanSelect: (plan: "core" | "enterprise") => void;
  selectedPlan?: "core" | "enterprise";
}

const BASE_FEATURES = [
  { label: "All core features", included: true },
  { label: "Built-in integrations", included: true },
  { label: "Authentication system", included: true },
  { label: "Database functionality", included: true },
  { label: "Usage-based credits", included: true, info: true },
];

const ENTERPRISE_EXTRAS = [
  { label: "Usage-based Cloud + AI" },
  { label: "Multi-Cloud Deployments" },
  { label: "Dedicated Support" },
  { label: "On-demand Credit top-ups" },
  { label: "Custom SLA & compliance" },
];

export function PlanSwitcher({ onPlanSelect }: PlanSwitcherProps) {
  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary mb-2">
          Scale with confidence
        </h2>
        <p className="text-secondary text-sm max-w-sm mx-auto leading-relaxed">
          You're on the <span className="text-primary font-medium">Core</span> plan.
          Upgrade to Enterprise and unlock everything NowG has to offer.
        </p>
      </div>

      {/* Card */}
      <div className="relative rounded-2xl overflow-hidden border border-[#7b4cff]/60 shadow-[0_0_40px_rgba(123,76,255,0.18)]">
        {/* Top accent bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#7b4cff] to-transparent" />

        <div className="p-6 bg-gradient-to-br from-[#13102a] via-[#0e0c1e] to-[#110e22]">
          {/* Plan label */}
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-[#7b4cff]/15 border border-[#7b4cff]/25">
              <Building2 className="h-4 w-4 text-[#a78bfa]" />
            </div>
            <span className="text-xs font-semibold text-[#a78bfa] uppercase tracking-widest">
              Enterprise
            </span>
          </div>

          {/* Pricing */}
          <div className="mb-5">
            <h3 className="text-2xl font-bold text-primary">Custom pricing</h3>
            <p className="text-secondary text-sm mt-1">
              Tailored for large organizations &amp; teams.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { label: "Uptime SLA", value: "99.99%" },
              { label: "Support", value: "24 / 7" },
              { label: "Team seats", value: "Unlimited" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl bg-[#7b4cff]/10 border border-[#7b4cff]/20 px-2 py-2.5 text-center"
              >
                <p className="text-sm font-semibold text-[#c4b5fd]">{value}</p>
                <p className="text-[10px] text-tertiary mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 mb-5" />

          {/* Features */}
          <div className="mb-6 space-y-4">
            {/* Base features */}
            <div>
              <p className="text-[10px] font-semibold text-tertiary uppercase tracking-widest mb-2.5">
                Everything in Core
              </p>
              <ul className="space-y-2">
                {BASE_FEATURES.map(({ label, info }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm text-secondary">
                    <Check className="h-3.5 w-3.5 text-[#7b4cff]/60 flex-shrink-0" />
                    <span>{label}</span>
                    {info && <Info className="h-3 w-3 text-tertiary flex-shrink-0" />}
                  </li>
                ))}
              </ul>
            </div>

            {/* Enterprise extras */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <p className="text-[10px] font-semibold text-[#a78bfa] uppercase tracking-widest">
                  Plus Enterprise extras
                </p>
                <Zap className="h-3 w-3 text-[#a78bfa]" />
              </div>
              <ul className="space-y-2">
                {ENTERPRISE_EXTRAS.map(({ label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm">
                    <Check className="h-3.5 w-3.5 text-[#7b4cff] flex-shrink-0" />
                    <span className="text-primary font-medium">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
