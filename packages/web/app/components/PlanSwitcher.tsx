import { useState } from "react";
import { Check, Info, Sparkles, Building2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface PlanSwitcherProps {
  onPlanSelect: (plan: "core" | "enterprise") => void;
  selectedPlan?: "core" | "enterprise";
}

const CORE_FEATURES = [
  "All core features",
  "Built-in integrations",
  "Authentication system",
  "Database functionality",
  "Credits",
  "Usage-based Cloud + AI",
  "Multi-Cloud Deployments",
  "Dedicated Support",
  "On-demand Credit top-ups",
];

const ENTERPRISE_FEATURES = [
  "All core features",
  "Built-in integrations",
  "Authentication system",
  "Database functionality",
  "Credits",
  "Usage-based Cloud + AI",
  "Multi-Cloud Deployments",
  "Dedicated Support",
];

export function PlanSwitcher({ onPlanSelect, selectedPlan = "enterprise" }: PlanSwitcherProps) {
  const [hoveredPlan, setHoveredPlan] = useState<"core" | "enterprise" | null>(null);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-3">
          Scale with confidence
        </h2>
        <p className="text-secondary text-base md:text-lg max-w-xl mx-auto">
          From solo developers to enterprise teams, choose the plan that
          accelerates your development journey.
        </p>
      </div>

        {/* Enterprise Plan */}
        <div
          className={cn(
            "relative rounded-2xl p-6 cursor-pointer transition-all duration-300",
            "border-2",
            selectedPlan === "enterprise"
              ? "border-[#7b4cff] bg-gradient-to-br from-[#7b4cff]/20 via-[#a855f7]/15 to-[#7b4cff]/10"
              : "border-subtle bg-surface-1 hover:border-[#7b4cff]/50",
            hoveredPlan === "enterprise" && selectedPlan !== "enterprise" && "border-[#7b4cff]/50"
          )}
          onClick={() => onPlanSelect("enterprise")}
          onMouseEnter={() => setHoveredPlan("enterprise")}
          onMouseLeave={() => setHoveredPlan(null)}
        >
          {/* Gradient overlay for selected state */}
          {selectedPlan === "enterprise" && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7b4cff]/10 via-transparent to-[#a855f7]/10 pointer-events-none" />
          )}

          <div className="relative z-10">
            {/* Plan Header */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-[#a78bfa]" />
                <span className="text-sm font-semibold text-secondary uppercase tracking-wide">
                  Enterprise
                </span>
              </div>
              <h3 className="text-2xl font-bold text-primary">Custom pricing</h3>
              <p className="text-secondary text-sm mt-2">
                Tailored solutions for large organizations and teams.
              </p>
            </div>

            {/* CTA Button */}
            <button
              className={cn(
                "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 mb-6",
                selectedPlan === "enterprise"
                  ? "bg-gradient-to-r from-[#7b4cff] to-[#a855f7] text-white shadow-lg shadow-[#7b4cff]/25"
                  : "bg-gradient-to-r from-[#7b4cff] to-[#a855f7] text-white hover:from-[#8c63f2] hover:to-[#b566f8] shadow-lg shadow-[#7b4cff]/25"
              )}
            >
              {selectedPlan === "enterprise" ? "Currently Selected" : "Switch to Enterprise"}
            </button>

            {/* Features */}
            <div>
              <p className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">
                What's Included
              </p>
              <ul className="space-y-2.5">
                {ENTERPRISE_FEATURES.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-sm text-secondary">
                    <Check className="h-4 w-4 text-[#7b4cff] flex-shrink-0" />
                    <span>{feature}</span>
                    {feature === "Credits" && (
                      <Info className="h-3.5 w-3.5 text-tertiary" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
  );
}
