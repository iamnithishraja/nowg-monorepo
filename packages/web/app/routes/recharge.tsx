import type { Route } from "./+types/recharge";
import { redirect } from "react-router";
import { auth } from "../lib/auth";
import { getEnvWithDefault } from "~/lib/env";
import { useState, useEffect } from "react";
import { Header } from "../components";
import Background from "../components/Background";
import GlowEffects from "../components/GlowEffects";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { SidebarProvider } from "../components/ui/sidebar";
import { AppSidebar } from "../components/AppSidebar";
import {
  CreditCard,
  Loader2,
  Zap,
  TrendingUp,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

export async function loader({ request }: Route.LoaderArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/signin");
  }

  return { publishableKey: getEnvWithDefault("STRIPE_PUBLISHABLE_KEY", "") };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Recharge - Nowgai" },
    { name: "description", content: "Recharge your Nowgai account" },
  ];
}

export default function Recharge({ loaderData }: Route.ComponentProps) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Fetch current balance
  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch("/api/profile/balance");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
        setIsWhitelisted(data.isWhitelisted);
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const handleRecharge = async () => {
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount greater than $0");
      return;
    }

    setIsLoading(true);

    try {
      // Get user's country code from browser location (will show permission popup)
      const { getCountryCodeForPayment, handlePaymentResponse } = await import("~/utils/payment");
      const countryCode = await getCountryCodeForPayment();
      console.log("🌍 Detected country code:", countryCode);

      // Create checkout session
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: amountNum,
          countryCode: countryCode, // Include country code
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const data = await response.json();

      // Handle different payment providers
      await handlePaymentResponse(data, amountNum, () => {
        setIsLoading(false); // Stop loading for Razorpay (handles its own UI)
      });
    } catch (error) {
      console.error("Recharge error:", error);
      alert(
        error instanceof Error ? error.message : "Failed to process recharge"
      );
      setIsLoading(false);
    }
  };

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

          <main className="relative z-20 flex flex-col h-full overflow-auto">
            <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8 pb-16 max-w-6xl mx-auto w-full">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                      Recharge Credits
                    </h1>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Add credits to your account to continue using Nowgai AI
                </p>
              </div>

              {/* Whitelist Badge */}
              {isWhitelisted && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-500" />
                    <p className="text-emerald-500 font-medium">
                      Developer Account - Unlimited Access
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have unlimited access and don't need to recharge.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Recharge Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Current Balance */}
                  <Card className="bg-background/70 backdrop-blur-xl border border-border/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Current Balance
                          </p>
                          <p className="text-4xl font-bold text-primary">
                            ${balance !== null ? balance.toFixed(2) : "-.--"}
                          </p>
                        </div>
                        <div className="p-3 rounded-full bg-primary/10">
                          <DollarSign className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recharge Form */}
                  <Card className="bg-background/70 backdrop-blur-xl border border-border/50">
                    <CardHeader>
                      <CardTitle>Recharge Amount</CardTitle>
                      <CardDescription>
                        Enter any amount greater than $0
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Amount (USD)
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="pl-10 text-lg"
                            placeholder="Enter amount"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleRecharge}
                        disabled={isLoading || isWhitelisted}
                        className="w-full"
                        size="lg"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-5 h-5 mr-2" />
                            Recharge Account
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        Secure payment - method selected based on your location
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Transaction History */}
                <div className="lg:col-span-1">
                  <Card className="bg-background/70 backdrop-blur-xl border border-border/50 h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Recent Transactions
                      </CardTitle>
                      <CardDescription>
                        Your last 10 transactions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                      {transactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No transactions yet
                        </p>
                      ) : (
                        transactions
                          .slice(0, 10)
                          .map((tx: any, index: number) => (
                            <div
                              key={index}
                              className="p-3 rounded-lg bg-muted/20 border border-border/30"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span
                                  className={`text-sm font-medium ${
                                    tx.type === "recharge"
                                      ? "text-emerald-500"
                                      : "text-orange-500"
                                  }`}
                                >
                                  {tx.type === "recharge" ? "+" : "-"}$
                                  {tx.amount.toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(tx.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {tx.description}
                              </p>
                            </div>
                          ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
