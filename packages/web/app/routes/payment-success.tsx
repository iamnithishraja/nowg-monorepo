import { ArrowRight, CheckCircle2, DollarSign, Home, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, redirect, useNavigate } from "react-router";
import { Header } from "../components";
import { AppSidebar } from "../components/AppSidebar";
import Background from "../components/Background";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { SidebarProvider } from "../components/ui/sidebar";
import { auth } from "../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/signin");
  }

  return {};
}

export const meta: MetaFunction = () => {
  return [
    { title: "Payment Successful - Nowgai" },
    { name: "description", content: "Your payment was successful" },
  ];
};

export default function PaymentSuccess() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "success" | "error"
  >("pending");
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get session ID and payment type from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get("session_id");
        const paymentType = urlParams.get("type");
        const teamId = urlParams.get("teamId");
        const organizationId = urlParams.get("organizationId");

        if (!sessionId) {
          console.error("No session ID found in URL");
          setVerificationStatus("error");
          setLoading(false);
          return;
        }

        // Determine which verify endpoint to use
        let verifyEndpoint = "/api/stripe/verify";
        if (paymentType === "team" && teamId) {
          verifyEndpoint = "/api/teams/wallet/verify";
        } else if (paymentType === "organization" && organizationId) {
          verifyEndpoint = "/api/organizations/wallet/verify";
        }

        // Verify payment with Stripe
        const response = await fetch(verifyEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        if (response.ok) {
          const data = await response.json();
          setBalance(data.balance);
          setVerificationStatus("success");
        } else {
          const errorData = await response.json();
          console.error("Payment verification failed:", errorData);
          setVerificationStatus("error");
        }
      } catch (error) {
        console.error("Failed to verify payment:", error);
        setVerificationStatus("error");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, []);

  useEffect(() => {
    if (!loading && verificationStatus === "success") {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentType = urlParams.get("type");
      const teamId = urlParams.get("teamId");
      const organizationId = urlParams.get("organizationId");
      const sessionId = urlParams.get("session_id");

      // Redirect based on payment type
      if (paymentType === "team" && teamId) {
        navigate(`/teams/${teamId}?payment_success=true`, { replace: true });
      } else if (paymentType === "organization" && organizationId) {
        navigate(`/manage-org/convo?payment_success=true&session_id=${sessionId}&type=organization&organizationId=${organizationId}`, { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    }
  }, [loading, verificationStatus, navigate]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Background />
        </div>

        <AppSidebar className="flex-shrink-0" />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header showAuthButtons={false} showSidebarToggle={true} />

          <main className="relative z-20 flex flex-col h-full overflow-auto">
            <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8 pb-16 max-w-2xl mx-auto w-full flex items-center justify-center">
              <Card className="bg-background/70 backdrop-blur-xl border border-border/50 w-full">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </div>
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                    Payment Successful!
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      Your payment has been processed successfully and your
                      credits have been added to your account.
                    </p>

                    {/* Balance Display */}
                    {!loading &&
                      balance !== null &&
                      verificationStatus === "success" && (
                        <div className="p-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-6">
                          <div className="flex items-center justify-center gap-3">
                            <div className="p-3 rounded-full bg-emerald-500/20">
                              <DollarSign className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Your New Balance
                              </p>
                              <p className="text-3xl font-bold text-emerald-500">
                                ${balance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                    {loading && (
                      <div className="p-6 rounded-lg bg-muted/20 border border-border/30 mb-6">
                        <p className="text-sm text-muted-foreground">
                          Verifying your payment...
                        </p>
                      </div>
                    )}

                    {!loading && verificationStatus === "error" && (
                      <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 mb-6">
                        <div className="flex items-center justify-center gap-3">
                          <div className="p-3 rounded-full bg-red-500/20">
                            <DollarSign className="w-6 h-6 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Payment Verification Failed
                            </p>
                            <p className="text-lg font-bold text-red-500">
                              Please contact support
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* What's Next */}
                    <div className="text-left p-4 rounded-lg bg-muted/20 border border-border/30 mb-6">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        What's Next?
                      </h3>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span>
                            Your credits are ready to use for AI conversations
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span>
                            Build amazing projects with Claude, GPT, and Gemini
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span>
                            Track your usage in real-time from your profile
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/home" className="flex-1">
                      <Button className="w-full" size="lg">
                        <Zap className="w-5 h-5 mr-2" />
                        Go to Home
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                    <Link to="/home" className="flex-1">
                      <Button variant="outline" className="w-full" size="lg">
                        <Home className="w-5 h-5 mr-2" />
                        Go Home
                      </Button>
                    </Link>
                  </div>

                  {/* Receipt Info */}
                  <div className="text-center pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      A receipt has been sent to your email address.
                      <br />
                      Need help? Contact support@nowgai.com
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
