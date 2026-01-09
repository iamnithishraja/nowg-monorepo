/**
 * Payment utility functions for Nowgai-Admin
 */

import { convertUSDToINR } from "./currencyConverter";

/**
 * Get country code from browser geolocation
 * This will trigger a browser permission popup
 */
export async function getCountryCodeForPayment(): Promise<string | null> {
  try {
    console.log("🌍 Requesting location permission for payment...");
    const countryCode = await getCountryCode();
    console.log("✅ Country code received:", countryCode);
    return countryCode;
  } catch (error) {
    console.error("❌ Error getting country code:", error);
    return null;
  }
}

/**
 * Get country code from browser geolocation
 */
async function getCountryCode(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("⚠️ Geolocation is not supported by this browser, using IP fallback");
      // Fallback to IP-based geolocation
      getCountryFromIP().then(resolve);
      return;
    }

    console.log("📍 Requesting geolocation permission...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          console.log("✅ Location permission granted, getting coordinates...");
          const { latitude, longitude } = position.coords;
          console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
          // Use reverse geocoding to get country code
          const countryCode = await reverseGeocode(latitude, longitude);
          console.log("🌍 Country code from geolocation:", countryCode);
          resolve(countryCode);
        } catch (error) {
          console.error("❌ Error getting country from geolocation:", error);
          // Fallback to IP-based geolocation
          const ipCountry = await getCountryFromIP();
          resolve(ipCountry);
        }
      },
      (error) => {
        console.warn("⚠️ Geolocation permission denied or error:", error.message);
        console.log("🔄 Falling back to IP-based geolocation...");
        // Fallback to IP-based geolocation
        getCountryFromIP().then(resolve);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0, // Don't use cached location - always ask fresh
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get country code
 */
async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Nowgai Payment System",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }

    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase();

    return countryCode || null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return await getCountryFromIP();
  }
}

/**
 * Fallback: Get country code from IP address
 */
async function getCountryFromIP(): Promise<string | null> {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) {
      throw new Error("IP geolocation failed");
    }
    const data = await response.json();
    return data.country_code || null;
  } catch (error) {
    console.error("IP geolocation error:", error);
    return null;
  }
}

/**
 * Load Razorpay SDK dynamically
 */
export function loadRazorpaySDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    // Note: Not using crossorigin to avoid CORP issues with Razorpay's CDN
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.head.appendChild(script);
  });
}

/**
 * Handle payment checkout response based on provider
 */
export async function handlePaymentResponse(
  data: {
    provider: string;
    url?: string;
    sessionId: string;
    keyId?: string;
    formData?: Record<string, string>;
    formAction?: string;
  },
  amount: number,
  onSuccess?: () => void
) {
  if (data.provider === "stripe" && data.url) {
    // Redirect to Stripe checkout
    window.location.href = data.url;
  } else if (data.provider === "razorpay") {
    // Load Razorpay SDK if not already loaded
    await loadRazorpaySDK();

    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
      throw new Error("Razorpay SDK not loaded. Please refresh the page.");
    }

    // Convert USD to INR paise using real-time exchange rate
    const amountInINR = await convertUSDToINR(amount);
    const amountInPaise = Math.ceil(amountInINR * 100);

    // Get user email from the page if available (for prefill)
    const userEmail = (data as any).userEmail || undefined;
    
    const options: any = {
      key: data.keyId,
      amount: amountInPaise,
      currency: "INR",
      order_id: data.sessionId,
      name: "Nowgai",
      description: `$${amount.toFixed(2)} payment`,
      // Enable all payment methods (UPI, cards, netbanking, wallets)
      // By default, Razorpay enables all methods, but we can explicitly enable them
      method: ['upi', 'card', 'netbanking', 'wallet'],
      // Prefill user information (helps with payment methods and UPI)
      prefill: userEmail ? {
        email: userEmail,
      } : undefined,
      handler: function (response: any) {
        // Build success URL with payment details
        const params = new URLSearchParams({
          session_id: data.sessionId,
          provider: "razorpay",
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
        // Redirect to current page with success params
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("payment", "success");
        currentUrl.searchParams.set("session_id", data.sessionId);
        currentUrl.searchParams.set("provider", "razorpay");
        currentUrl.searchParams.set("razorpay_payment_id", response.razorpay_payment_id);
        currentUrl.searchParams.set("razorpay_order_id", response.razorpay_order_id);
        currentUrl.searchParams.set("razorpay_signature", response.razorpay_signature);
        window.location.href = currentUrl.toString();
      },
      theme: {
        color: "#7367F0",
      },
      // Enable retry for failed payments
      retry: {
        enabled: true,
        max_count: 3,
      },
      // Modal configuration for better UX
      modal: {
        ondismiss: function() {
          // Handle modal dismissal if needed
          console.log("Payment modal dismissed");
        },
        escape: true,
        animation: true,
      },
    };

    const razorpay = new Razorpay(options);
    razorpay.open();
    onSuccess?.(); // Call success callback
  } else if (data.provider === "payu" && data.formData && data.formAction) {
    // Submit form to PayU
    const form = document.createElement("form");
    form.method = "POST";
    form.action = data.formAction;
    form.style.display = "none";

    Object.entries(data.formData).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  } else {
    throw new Error(`Invalid payment provider response: ${data.provider}`);
  }
}

