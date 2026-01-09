/**
 * Utilities for working with WebContainer and handling timing issues
 */

/**
 * Check if a command/package is available in WebContainer
 */
export async function checkCommandAvailable(
  runShell: (command: string) => Promise<any>,
  command: string,
  maxRetries = 10,
  delayMs = 500
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Use 'which' to check if command exists
      await runShell(`which ${command}`);
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        return false;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

/**
 * Wait for node_modules to be properly mounted after npm install
 */
export async function waitForNodeModules(
  runShell: (command: string) => Promise<any>,
  packageName?: string,
  maxWaitMs = 10000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check if node_modules directory exists
      await runShell('ls node_modules');
      
      // If a specific package is provided, check for it
      if (packageName) {
        await runShell(`ls node_modules/${packageName}`);
      }
      
      return true;
    } catch (error) {
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return false;
}

/**
 * Execute a command with automatic retry for WebContainer timing issues
 */
export async function executeWithRetry(
  runShell: (command: string, onOutput?: (line: string) => void) => Promise<any>,
  command: string,
  onOutput?: (line: string) => void,
  maxRetries = 3
): Promise<void> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await runShell(command, (line: string) => {
        // Check for common WebContainer errors
        if (line.includes('command not found')) {
          onOutput?.(`⚠️  Command not found (attempt ${attempt}/${maxRetries})`);
          if (attempt < maxRetries) {
            onOutput?.(`🔄 Waiting for WebContainer to mount packages...`);
          }
          throw new Error(`Command not found: ${command}`);
        }
        
        onOutput?.(line);
      });
      
      // Success - exit retry loop
      return;
      
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Wait before retrying, with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        onOutput?.(`🔄 Retrying command in ${delay/1000}s... (attempt ${attempt + 1}/${maxRetries})`);
      }
    }
  }
  
  // All retries failed
  throw lastError;
}

/**
 * Get the binary name from a dev command (e.g., "vite" from "npm run dev")
 */
export function extractBinaryFromDevCommand(command: string): string | null {
  // Handle common dev commands
  if (command.includes('vite')) return 'vite';
  if (command.includes('next')) return 'next';
  if (command.includes('webpack')) return 'webpack';
  if (command.includes('parcel')) return 'parcel';
  if (command.includes('rollup')) return 'rollup';
  if (command.includes('snowpack')) return 'snowpack';
  
  return null;
}