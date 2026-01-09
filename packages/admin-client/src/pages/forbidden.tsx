import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Access Denied
            </h1>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
              You must be an admin or a member of an organization to access this platform.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              Redirecting to login in {countdown} second{countdown !== 1 ? "s" : ""}...
            </p>
            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="w-full"
            >
              Go to Login Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



