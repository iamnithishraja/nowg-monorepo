/**
 * Payment utility functions
 */

import { convertUSDToINR } from "~/lib/currencyConverterClient";

/**
 * Get country code from browser geolocation
 * This will trigger a browser permission popup
 */
export async function getCountryCodeForPayment(): Promise<string | null> {
  try {
    const { getCountryCode } = await import("~/utils/geolocation");
    return await getCountryCode();
  } catch (error) {
    console.error("Error getting country code:", error);
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

    const options = {
      key: data.keyId,
      amount: amountInPaise,
      currency: "INR",
      order_id: data.sessionId,
      name: "Nowgai",
      description: `$${amount.toFixed(2)} payment`,
      handler: function (response: any) {
        // Build success URL with payment details
        const params = new URLSearchParams({
          session_id: data.sessionId,
          provider: "razorpay",
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
        window.location.href = `/payment-success?${params.toString()}`;
      },
      theme: {
        color: "#7367F0",
      },
    };

    const razorpay = new Razorpay(options);
    razorpay.open();
    onSuccess?.(); // Call success callback (e.g., to stop loading state)
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
