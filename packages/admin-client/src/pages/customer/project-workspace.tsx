import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, Send, Sparkles, Loader2, Eye, Database as DatabaseIcon, Terminal, Globe, GitBranch, X,
  Box, ChevronDown, Camera, Paperclip, SlidersHorizontal, ArrowUp, Play, RotateCw, Table,
  FileCode, Activity, CheckCircle2, AlertCircle, Upload, Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@shared/schema";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
}

interface Tab {
  id: string;
  label: string;
  icon: any;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const ALL_TABS: Tab[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "database", label: "Database", icon: DatabaseIcon },
  { id: "console", label: "Console", icon: Terminal },
  { id: "publishing", label: "Publishing", icon: Globe },
  { id: "git", label: "Git", icon: GitBranch },
];

export default function ProjectWorkspace() {
  const { id } = useParams();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI development assistant. I can help you build your website or application. What would you like to create today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-3.5-sonnet");
  const [openTabs, setOpenTabs] = useState<string[]>(["preview", "database", "console", "publishing", "git"]);
  const [activeTab, setActiveTab] = useState("preview");
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: new Date().toISOString(), level: "info", message: "Application started successfully" },
    { timestamp: new Date().toISOString(), level: "info", message: "Database connection established" },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/projects', id],
  });

  const { data: modelsData } = useQuery<{ models: AIModel[]; hasActiveConfig: boolean }>({
    queryKey: ['/api/ai/models'],
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          projectId: id,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const closeTab = (tabId: string) => {
    if (openTabs.length === 1) return;
    
    const newOpenTabs = openTabs.filter(t => t !== tabId);
    setOpenTabs(newOpenTabs);
    
    if (activeTab === tabId) {
      setActiveTab(newOpenTabs[0]);
    }
  };

  const handleBuild = () => {
    toast({
      title: "Build Started",
      description: "Building your application...",
    });
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Build process initiated"
    }]);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "preview":
        return (
          <div className="h-full flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="default" size="sm" data-testid="button-run-preview">
                  <Play className="h-4 w-4 mr-2" />
                  Run
                </Button>
                <Button variant="outline" size="sm" data-testid="button-refresh-preview">
                  <RotateCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Activity className="h-3 w-3" />
                Live Preview
              </Badge>
            </div>
            <div className="flex-1 bg-muted/30 rounded-lg border-2 border-dashed flex items-center justify-center">
              <div className="text-center">
                <Eye className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Preview Window</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  Your application will appear here when the AI builds it.
                </p>
                <Button variant="outline" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Start Development Server
                </Button>
              </div>
            </div>
          </div>
        );
        
      case "database":
        return (
          <div className="h-full flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b">
              <h3 className="text-lg font-semibold">Database Schema</h3>
              <Button variant="outline" size="sm" data-testid="button-refresh-schema">
                <RotateCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Table className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">users</CardTitle>
                  </div>
                  <CardDescription>User accounts and authentication</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">id</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">email</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">role</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">created_at</span>
                      <Badge variant="secondary">timestamp</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Table className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">projects</CardTitle>
                  </div>
                  <CardDescription>User projects and workspaces</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">id</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">name</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">framework</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">user_id</span>
                      <Badge variant="secondary">varchar</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Query Console</CardTitle>
              </CardHeader>
              <CardContent>
                <Input 
                  placeholder="SELECT * FROM users LIMIT 10" 
                  className="font-mono text-sm"
                  data-testid="input-sql-query"
                />
                <Button className="mt-3" size="sm" variant="default" data-testid="button-execute-query">
                  <Play className="h-4 w-4 mr-2" />
                  Execute Query
                </Button>
              </CardContent>
            </Card>
          </div>
        );
        
      case "console":
        return (
          <div className="h-full flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b">
              <h3 className="text-lg font-semibold">Console Logs</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" data-testid="button-clear-logs">
                  Clear
                </Button>
                <Button variant="outline" size="sm" data-testid="button-refresh-logs">
                  <RotateCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 bg-black/90 rounded-lg p-4 font-mono text-sm">
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div key={index} className="flex flex-wrap items-start gap-3" data-testid={`log-entry-${index}`}>
                    <span className="text-muted-foreground text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge 
                      variant={
                        log.level === "error" ? "destructive" : 
                        log.level === "warn" ? "secondary" : 
                        "default"
                      }
                      className="text-xs"
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="text-green-400 flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
        
      case "publishing":
        return (
          <div className="h-full flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b">
              <h3 className="text-lg font-semibold">Publishing</h3>
              <Button variant="default" size="sm" data-testid="button-deploy">
                <Upload className="h-4 w-4 mr-2" />
                Deploy Now
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Deployment Status</CardTitle>
                <CardDescription>Current deployment information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready to Deploy
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Environment</span>
                  <span className="text-sm font-medium">Production</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Last Deployed</span>
                  <span className="text-sm font-medium">Never</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Domain</CardTitle>
                <CardDescription>Configure your custom domain</CardDescription>
              </CardHeader>
              <CardContent>
                <Input 
                  placeholder="yourdomain.com" 
                  data-testid="input-custom-domain"
                />
                <Button className="mt-3" size="sm" variant="outline" data-testid="button-save-domain">
                  Save Domain
                </Button>
              </CardContent>
            </Card>
          </div>
        );
        
      case "git":
        return (
          <div className="h-full flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b">
              <h3 className="text-lg font-semibold">Git</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">main</Badge>
                <Button variant="outline" size="sm" data-testid="button-sync-git">
                  <RotateCw className="h-4 w-4 mr-2" />
                  Sync
                </Button>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Version Control</CardTitle>
                <CardDescription>Commit history and changes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start gap-3 pb-3 border-b">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Initial commit</p>
                    <p className="text-xs text-muted-foreground">Created project structure</p>
                    <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <FileCode className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Setup configuration</p>
                    <p className="text-xs text-muted-foreground">Added base configuration files</p>
                    <p className="text-xs text-muted-foreground mt-1">5 minutes ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4">
              <Input 
                placeholder="Commit message" 
                className="mb-3"
                data-testid="input-commit-message"
              />
              <Button size="sm" variant="default" data-testid="button-commit">
                <GitBranch className="h-4 w-4 mr-2" />
                Commit Changes
              </Button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <h2 className="text-2xl font-semibold mb-4">Project not found</h2>
        <Link href="/projects">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Header */}
      <div className="border-b px-4 py-3 flex flex-wrap items-center gap-3 bg-card">
        <Link href="/projects">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold" data-testid="text-project-name">
            {project.name}
          </h1>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {project.framework} • AI-Powered Development
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat Sidebar */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <div className="flex flex-col h-full bg-card border-r">
            {/* Chat Header with Action Buttons */}
            <div className="border-b px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">AI Assistant</h2>
                    <p className="text-xs text-muted-foreground">Ready to help</p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" data-testid="button-build-menu">
                      <Box className="h-4 w-4" />
                      Build
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleBuild} data-testid="menu-item-build">
                      <Play className="h-4 w-4 mr-2" />
                      Build Project
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="menu-item-test">
                      <Activity className="h-4 w-4 mr-2" />
                      Run Tests
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button variant="ghost" size="icon" data-testid="button-screenshot">
                  <Camera className="h-4 w-4" />
                </Button>
                
                <Button variant="ghost" size="icon" data-testid="button-attach">
                  <Paperclip className="h-4 w-4" />
                </Button>
                
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="icon" data-testid="button-filters">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={scrollToBottom} data-testid="button-scroll-bottom">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                    data-testid={`message-${message.role}-${index}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      message.role === "assistant" 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted"
                    }`}>
                      {message.role === "assistant" ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-medium">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="rounded-lg px-3 py-2 bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="border-t p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Model:</span>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[240px] h-8 text-xs" data-testid="select-ai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelsData?.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{model.name}</span>
                            <Badge variant="outline" className="text-xs">{model.provider}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Make, test, iterate..."
                  className="flex-1 text-sm"
                  disabled={isLoading}
                  data-testid="input-ai-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  data-testid="button-send-message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Content Area with Custom Closable Tabs */}
        <ResizablePanel defaultSize={70}>
          <div className="flex flex-col h-full">
            {/* Custom Tabs Header */}
            <div className="border-b bg-card">
              <div className="flex items-center overflow-x-auto">
                {ALL_TABS.filter(tab => openTabs.includes(tab.id)).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isOnlyTab = openTabs.length === 1;
                  
                  return (
                    <div
                      key={tab.id}
                      className={`group flex items-center gap-2 px-4 py-3 border-r cursor-pointer transition-colors ${
                        isActive 
                          ? "bg-background text-foreground" 
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                      data-testid={`tab-${tab.id}`}
                    >
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className="flex items-center gap-2 text-sm"
                        data-testid={`button-activate-${tab.id}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                      {!isOnlyTab && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                          className="ml-2 p-0.5 rounded hover:bg-muted-foreground/20 transition-colors opacity-0 group-hover:opacity-100"
                          data-testid={`button-close-${tab.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-6 overflow-auto">
              {renderTabContent()}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
