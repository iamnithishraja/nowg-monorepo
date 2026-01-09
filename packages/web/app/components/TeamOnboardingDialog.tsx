import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Users,
  Wallet,
  CheckCircle2,
  Loader2,
  Mail,
  UserPlus,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface TeamOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (team: any) => void;
}

export function TeamOnboardingDialog({
  open,
  onOpenChange,
  onSuccess,
}: TeamOnboardingDialogProps) {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdTeam, setCreatedTeam] = React.useState<any>(null);
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
  });
  const [inviteData, setInviteData] = React.useState({
    email: "",
    role: "developer" as "developer" | "admin",
  });
  const [walletAmount, setWalletAmount] = React.useState("");

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create team");
      }

      if (data.success && data.team) {
        setCreatedTeam(data.team);
        setStep(2);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdTeam) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/teams/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          teamId: createdTeam.id,
          email: inviteData.email,
          role: inviteData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      // Clear invite form and allow adding more or proceed
      setInviteData({ email: "", role: "developer" });
    } catch (err: any) {
      setError(err.message || "Failed to invite member");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    if (!createdTeam || !walletAmount) return;

    const amount = parseFloat(walletAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than $0");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/teams/wallet/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          teamId: createdTeam.id,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || "Failed to process payment");
      setLoading(false);
    }
  };

  const handleSkipWallet = () => {
    if (onSuccess && createdTeam) {
      onSuccess(createdTeam);
    }
    handleClose();
  };

  const handleClose = () => {
    if (!loading) {
      setStep(1);
      setFormData({ name: "", description: "" });
      setInviteData({ email: "", role: "developer" });
      setWalletAmount("");
      setCreatedTeam(null);
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
            Create Your Team
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === 1 && "Set up your team workspace and start collaborating"}
            {step === 2 && "Invite team members to join your team"}
            {step === 3 && "Add funds to your team wallet"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className="flex items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      step >= s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={cn(
                        "w-12 h-0.5 mx-2 transition-colors",
                        step > s ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Team Details */}
          {step === 1 && (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Team Name *
                </label>
                <Input
                  type="text"
                  placeholder="Enter team name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={loading}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="What's your team about?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  disabled={loading}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 bg-background"
                />
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !formData.name.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Invite Members */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    Team "{formData.name}" created successfully!
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Now invite team members to collaborate
                </p>
              </div>

              <form onSubmit={handleInviteMember} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteData.email}
                      onChange={(e) =>
                        setInviteData({ ...inviteData, email: e.target.value })
                      }
                      disabled={loading}
                      className="pl-10 bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Role
                  </label>
                  <select
                    value={inviteData.role}
                    onChange={(e) =>
                      setInviteData({
                        ...inviteData,
                        role: e.target.value as "developer" | "admin",
                      })
                    }
                    disabled={loading}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 bg-background"
                  >
                    <option value="developer">Developer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={loading || !inviteData.email.trim()}
                    size="sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={loading}>
                  Continue to Wallet
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Wallet Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Team Wallet Setup
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add funds to your team wallet to start creating projects
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Enter amount"
                      value={walletAmount}
                      onChange={(e) => setWalletAmount(e.target.value)}
                      disabled={loading}
                      className="pl-10 bg-background border-border"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddFunds}
                    disabled={
                      loading || !walletAmount || parseFloat(walletAmount) <= 0
                    }
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Add Funds
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSkipWallet}
                    disabled={loading}
                  >
                    Skip for Now
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
