import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Code2 } from "lucide-react";
import { SiGoogle, SiGithub } from "react-icons/si";
import { signIn, signUp, signOut } from "@/lib/auth-client";
import { client } from "@/lib/client";

export default function Login() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");

  // Helper function to check if user has access (admin or organization/project membership)
  // This queries the database models directly (OrganizationMember, ProjectMember)
  const checkUserAccess = async (): Promise<{ hasAccess: boolean; message?: string }> => {
    try {
      // Use the dedicated check-access endpoint that queries database models directly
      const accessCheck = await client.get<{
        hasAccess: boolean;
        reason?: string;
        message?: string;
      }>("/api/admin/me/check-access");

      return {
        hasAccess: accessCheck.hasAccess === true,
        message: accessCheck.message,
      };
    } catch (error: any) {
      return {
        hasAccess: false,
        message: error.message || "Failed to verify access",
      };
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: loginEmail,
        password: loginPassword,
      });

      if (result.error) {
        throw new Error(result.error.message || "Invalid email or password");
      }

      // Check if user has access after successful login
      const accessResult = await checkUserAccess();

      if (!accessResult.hasAccess) {
        // Sign out the user since they don't have access
        await signOut();
        toast({
          title: "Access Denied",
          description:
            accessResult.message ||
            "You must be an admin or a member of an organization to access this platform.",
          variant: "destructive",
        });
        // Redirect to forbidden page
        setTimeout(() => {
          window.location.href = "/forbidden";
        }, 500);
        return;
      }

      toast({
        title: "Login successful",
        description: "Welcome back!",
      });

      // Redirect to admin dashboard
      window.location.href = "/admin";
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signUp.email({
        email: registerEmail,
        password: registerPassword,
        name:
          `${registerFirstName} ${registerLastName}`.trim() || registerEmail,
      });

      if (result.error) {
        throw new Error(result.error.message || "Could not create account");
      }

      // Check if user has access after successful registration
      const accessResult = await checkUserAccess();

      if (!accessResult.hasAccess) {
        // Sign out the user since they don't have access
        await signOut();
        toast({
          title: "Access Denied",
          description:
            accessResult.message ||
            "Registration successful, but access denied. You must be an admin or a member of an organization to access this platform. Please contact your administrator.",
          variant: "destructive",
        });
        // Redirect to forbidden page
        setTimeout(() => {
          window.location.href = "/forbidden";
        }, 500);
        return;
      }

      toast({
        title: "Registration successful",
        description: "Your account has been created!",
      });

      // Redirect to admin dashboard
      window.location.href = "/admin";
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    try {
      // For social login, we'll check access after redirect
      // The OAuth callback will redirect to /admin, where ProtectedAdminRoute will check access
      const callbackURL = `${window.location.origin}/admin`;

      await signIn.social({
        provider,
        callbackURL,
      });
    } catch (error: any) {
      toast({
        title: "Social login failed",
        description: error.message || "Could not sign in with " + provider,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-end bg-background p-4 lg:p-12">
      <Card className="w-full max-w-md lg:mr-12">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Code2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">AI Code Platform</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Social Login Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => handleSocialLogin("google")}
              data-testid="button-google-login"
            >
              <SiGoogle className="h-4 w-4" />
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => handleSocialLogin("github")}
              data-testid="button-github-login"
            >
              <SiGithub className="h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Login/Register Tabs */}
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">
                Login
              </TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    data-testid="input-login-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    data-testid="input-login-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login-submit"
                >
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-firstname">First Name</Label>
                    <Input
                      id="register-firstname"
                      type="text"
                      placeholder="John"
                      value={registerFirstName}
                      onChange={(e) => setRegisterFirstName(e.target.value)}
                      data-testid="input-register-firstname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-lastname">Last Name</Label>
                    <Input
                      id="register-lastname"
                      type="text"
                      placeholder="Doe"
                      value={registerLastName}
                      onChange={(e) => setRegisterLastName(e.target.value)}
                      data-testid="input-register-lastname"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    data-testid="input-register-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    data-testid="input-register-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-register-submit"
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
