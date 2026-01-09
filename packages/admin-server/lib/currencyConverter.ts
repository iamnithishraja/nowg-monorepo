/**
 * Currency conversion utility with real-time exchange rates
 * Uses exchangerate.host (free, no API key required)
 * Fetches fresh rate on every call - no caching
 */

interface ExchangeRateResponse {
  motd?: {
    msg: string;
    url: string;
  };
  success: boolean;
  base: string;
  date: string;
  rates: {
    [key: string]: number;
  };
}

/**
 * Get USD to INR exchange rate from API
 * Always fetches fresh rate - no caching
 * Falls back to 83 if API fails
 */
export async function getUSDToINRRate(): Promise<number> {
  try {
    // Try exchangerate-api.com v4 (free, no key required)
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();

    // exchangerate-api.com v4 format: { rates: { INR: 83.25 } }
    if (data.rates && typeof data.rates.INR === "number") {
      return data.rates.INR;
    } else {
      console.error("Invalid API response format:", JSON.stringify(data));
      throw new Error("Invalid response from exchange rate API");
    }
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    // Fallback to approximate rate
    console.warn("Using fallback exchange rate (83)");
    return 83;
  }
}

/**
 * Convert USD to INR using real-time exchange rate
 */
export async function convertUSDToINR(usdAmount: number): Promise<number> {
  const rate = await getUSDToINRRate();
  return usdAmount * rate;
}

/**
 * Convert INR to USD using real-time exchange rate
 */
export async function convertINRToUSD(inrAmount: number): Promise<number> {
  const rate = await getUSDToINRRate();
  return inrAmount / rate;
}
