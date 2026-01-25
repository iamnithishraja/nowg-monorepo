/**
 * Re-export currency conversion utilities from the shared package
 * This file provides backward compatibility - existing imports will continue to work
 */
export {
  convertINRToUSD, convertUSDToINR, getUSDToINRRate
} from "@nowgai/shared/utils";

