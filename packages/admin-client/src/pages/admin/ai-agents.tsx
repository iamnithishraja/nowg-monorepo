import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bot,
  Plus,
  Edit,
  Trash2,
  Brain,
  RefreshCw,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { format } from "date-fns";

type AiAgent = {
  id: string;
  name: string;
  description: string | null;
  model: string;
  systemPrompt: string | null;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const AI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo (OpenAI)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (OpenAI)" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Anthropic)" },
  { value: "claude-3-opus-20240229", label: "Claude 3 Opus (Anthropic)" },
  { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet (Anthropic)" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (Anthropic)" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Google)" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Google)" },
];

const aiAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  systemPrompt: z.string().optional(),
  temperature: z.coerce.number().min(0, "Temperature must be at least 0").max(1, "Temperature must be at most 1"),
  maxTokens: z.coerce.number().int().min(1, "Max tokens must be at least 1").max(100000, "Max tokens must be at most 100,000"),
  isActive: z.boolean().default(true),
});

type AiAgentInput = z.infer<typeof aiAgentSchema>;

export default function AIAgents() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  const { data: agents = [], isLoading } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
    select: (data: any[]) => data.map(agent => ({
      ...agent,
      // Normalize temperature from backend (Drizzle decimal returns string)
      temperature: (() => {
        if (typeof agent.temperature === 'number') return agent.temperature;
        const parsed = parseFloat(agent.temperature);
        return Number.isFinite(parsed) ? parsed : 0.7;
      })(),
    })),
  });

  const form = useForm<AiAgentInput>({
    resolver: zodResolver(aiAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      model: "",
      systemPrompt: "",
      temperature: 0.7,
      maxTokens: 2000,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AiAgentInput) => {
      return await apiRequest("/api/ai-agents", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "AI Agent Created",
        description: "The AI agent has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AiAgentInput> }) => {
      return await apiRequest(`/api/ai-agents/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setDialogOpen(false);
      setEditingAgent(null);
      form.reset();
      toast({
        title: "AI Agent Updated",
        description: "The AI agent has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/ai-agents/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
      toast({
        title: "AI Agent Deleted",
        description: "The AI agent has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleOpenDialog = (agent?: AiAgent) => {
    if (agent) {
      setEditingAgent(agent);
      form.reset({
        name: agent.name,
        description: agent.description || "",
        model: agent.model,
        systemPrompt: agent.systemPrompt || "",
        temperature: agent.temperature, // Already normalized by query select
        maxTokens: agent.maxTokens,
        isActive: agent.isActive,
      });
    } else {
      setEditingAgent(null);
      form.reset({
        name: "",
        description: "",
        model: "",
        systemPrompt: "",
        temperature: 0.7,
        maxTokens: 2000,
        isActive: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = (data: AiAgentInput) => {
    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getModelLabel = (modelValue: string) => {
    return AI_MODELS.find(m => m.value === modelValue)?.label || modelValue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">AI Agents</h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage AI agents
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            data-testid="button-create-agent"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Agents Table */}
      <Card className="shadow-sm hover-elevate">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">AI Agents</h2>
                <p className="text-sm text-muted-foreground">
                  {agents.length} agent{agents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading AI agents...
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No AI agents found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-agents">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Model</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Temperature</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Max Tokens</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Updated</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    return (
                      <tr
                        key={agent.id}
                        className="border-b hover-elevate"
                        data-testid={`row-agent-${agent.id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-primary" />
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              {agent.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {agent.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Badge variant="outline">{getModelLabel(agent.model)}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {agent.temperature.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {agent.maxTokens.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={agent.isActive ? "default" : "secondary"}
                            data-testid={`badge-status-${agent.id}`}
                          >
                            {agent.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(agent.updatedAt), "MMM dd, yyyy")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(agent)}
                              data-testid={`button-edit-${agent.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAgentToDelete(agent.id);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-${agent.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-agent-form">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Edit AI Agent" : "Create AI Agent"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Code Assistant"
                        data-testid="input-name"
                      />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this AI agent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this agent does..."
                        className="min-h-[80px]"
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-model">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AI_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The LLM model to use for this agent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="You are a helpful assistant that..."
                        className="font-mono text-sm min-h-[120px]"
                        data-testid="input-system-prompt"
                      />
                    </FormControl>
                    <FormDescription>
                      The system prompt that defines the agent's behavior and personality
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature: {field.value.toFixed(1)}</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            min={0}
                            max={1}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            data-testid="slider-temperature"
                          />
                          <Input
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            className="text-sm"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        0 = focused, 1 = creative
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxTokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Tokens</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          type="number"
                          step="100"
                          min="1"
                          max="100000"
                          placeholder="2000"
                          data-testid="input-max-tokens"
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum response length
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable this AI agent
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingAgent ? "Update" : "Create"} Agent
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this AI agent? This action cannot be undone
              and any applications using this agent will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => agentToDelete && deleteMutation.mutate(agentToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
