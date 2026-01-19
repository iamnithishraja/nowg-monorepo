import { useCallback, useRef, useState } from "react";
import { ToolRegistry } from "../tools/registry";
import type { Tool } from "../tools/tool";
import type { ToolCallEvent, ToolCallResult } from "./useStreamingHandler";

/**
 * Status of a tool execution
 */
export interface ToolExecutionStatus {
  id: string;
  name: string;
  status: "pending" | "executing" | "completed" | "error";
  startTime: number;
  endTime?: number;
  result?: Tool.Result;
  error?: string;
}

/**
 * Hook for executing tools via the ToolRegistry
 * 
 * This hook provides:
 * - Tool execution via ToolRegistry.execute()
 * - Execution status tracking for UI display
 * - Integration with streaming handler events
 * 
 * @example
 * ```tsx
 * const { executeToolCall, executionStatuses, isExecuting } = useToolExecution();
 * 
 * // In streaming handler options:
 * onToolCall: executeToolCall,
 * onToolCallStart: (toolCall) => console.log('Starting:', toolCall.name),
 * onToolCallComplete: (result) => console.log('Done:', result.name),
 * ```
 */
export function useToolExecution() {
  const [executionStatuses, setExecutionStatuses] = useState<Map<string, ToolExecutionStatus>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Track active executions count
  const activeCountRef = useRef(0);

  /**
   * Update the status of a tool execution
   */
  const updateStatus = useCallback((id: string, updates: Partial<ToolExecutionStatus>) => {
    setExecutionStatuses(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  /**
   * Execute a tool call and return the result
   * This is the main function to be passed to streaming handler's onToolCall
   */
  const executeToolCall = useCallback(async (toolCall: ToolCallEvent): Promise<ToolCallResult> => {
    const { id, name, args, sessionId, messageId } = toolCall;
    
    // Create initial status
    const initialStatus: ToolExecutionStatus = {
      id,
      name,
      status: "pending",
      startTime: Date.now(),
    };
    
    setExecutionStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(id, initialStatus);
      return newMap;
    });
    
    // Update executing state
    activeCountRef.current++;
    setIsExecuting(true);
    
    try {
      // Mark as executing
      updateStatus(id, { status: "executing" });
      
      // Check if tool exists
      const tool = ToolRegistry.get(name);
      if (!tool) {
        const errorMessage = `Tool "${name}" not found in registry`;
        const errorResult: ToolCallResult = {
          toolCallId: id,
          name,
          success: false,
          result: { error: errorMessage },
        };
        
        updateStatus(id, {
          status: "error",
          endTime: Date.now(),
          error: errorMessage,
        });
        
        return errorResult;
      }
      
      // Create execution context
      const ctx: Tool.Context = {
        sessionID: sessionId || `session-${Date.now()}`,
        messageID: messageId || `msg-${Date.now()}`,
        metadata: (input) => {
          // Update status with metadata from tool execution
          if (input.title) {
            updateStatus(id, { name: input.title });
          }
        },
      };
      
      // Execute the tool
      const result = await ToolRegistry.execute(name, args, ctx);
      
      // Mark as completed
      updateStatus(id, {
        status: "completed",
        endTime: Date.now(),
        result,
      });
      
      return {
        toolCallId: id,
        name,
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      updateStatus(id, {
        status: "error",
        endTime: Date.now(),
        error: errorMessage,
      });
      
      return {
        toolCallId: id,
        name,
        success: false,
        result: { error: errorMessage },
      };
    } finally {
      activeCountRef.current--;
      if (activeCountRef.current === 0) {
        setIsExecuting(false);
      }
    }
  }, [updateStatus]);

  /**
   * Clear all execution statuses
   */
  const clearStatuses = useCallback(() => {
    setExecutionStatuses(new Map());
  }, []);

  /**
   * Get execution status by ID
   */
  const getStatus = useCallback((id: string): ToolExecutionStatus | undefined => {
    return executionStatuses.get(id);
  }, [executionStatuses]);

  /**
   * Get all statuses as an array (for rendering)
   */
  const getAllStatuses = useCallback((): ToolExecutionStatus[] => {
    return Array.from(executionStatuses.values());
  }, [executionStatuses]);

  /**
   * Get statuses filtered by status type
   */
  const getStatusesByState = useCallback((status: ToolExecutionStatus["status"]): ToolExecutionStatus[] => {
    return Array.from(executionStatuses.values()).filter(s => s.status === status);
  }, [executionStatuses]);

  return {
    // Main execution function
    executeToolCall,
    
    // Status tracking
    executionStatuses,
    isExecuting,
    
    // Status helpers
    getStatus,
    getAllStatuses,
    getStatusesByState,
    clearStatuses,
    
    // Registry access for UI (e.g., showing available tools)
    getAvailableTools: () => ToolRegistry.getAll(),
    hasToolSupport: () => ToolRegistry.getAll().length > 0,
  };
}

export default useToolExecution;
