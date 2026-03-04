import { Link } from "react-router";

export function ProfileLegalSection() {
  return (
    <div className="pt-4 border-t border-subtle">
      <p className="text-xs text-tertiary mb-3 font-medium">
        Legal & Policies
      </p>
      <div className="flex flex-col gap-2">
        <Link
          to="/privacy-policy"
          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        <Link
          to="/terms-and-conditions"
          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
        >
          Terms and Conditions
        </Link>
        <Link
          to="/refund-policy"
          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
        >
          Refund Policy
        </Link>
        <Link
          to="/EULA"
          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
        >
          End User License Agreement (EULA)
        </Link>
        <Link
          to="/support"
          className="text-sm text-tertiary hover:text-primary transition-colors underline underline-offset-2"
        >
          Support & Contact
        </Link>
      </div>
      <div className="mt-4 pt-3 border-t border-subtle">
        <p className="text-xs text-tertiary mb-2">Compliance</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We comply with India's DPDP Act, IT Act, and applicable global
          standards including GDPR for EU users. For privacy queries or to
          exercise your rights, contact{" "}
          <a
            href="mailto:support@nowg.ai"
            className="text-tertiary hover:text-primary underline underline-offset-2"
          >
            support@nowg.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}
