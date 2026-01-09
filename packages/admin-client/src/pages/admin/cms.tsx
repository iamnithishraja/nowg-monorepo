import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Palette,
  Type,
  Image as ImageIcon,
  Save,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";

type CmsSetting = {
  id: string;
  key: string;
  value: string | null;
  type: string;
  category: string;
  updatedAt: string;
};

const settingSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string().optional(),
  type: z.enum(["text", "color", "image", "json"]),
  category: z.enum(["branding", "theme", "content"]),
});

type SettingInput = z.infer<typeof settingSchema>;

export default function CMSSettings() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string>("branding");

  const { data: settings = [], isLoading } = useQuery<CmsSetting[]>({
    queryKey: ["/api/cms-settings"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SettingInput) => {
      return await apiRequest("/api/cms-settings", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms-settings"] });
      toast({
        title: "Settings Saved",
        description: "CMS settings have been updated successfully.",
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

  // Organize settings by category
  const brandingSettings = settings.filter((s) => s.category === "branding");
  const themeSettings = settings.filter((s) => s.category === "theme");
  const contentSettings = settings.filter((s) => s.category === "content");

  // Predefined settings structure
  const defaultSettings: SettingInput[] = [
    { key: "logo_url", value: "", type: "image", category: "branding" },
    { key: "favicon_url", value: "", type: "image", category: "branding" },
    { key: "brand_name", value: "", type: "text", category: "branding" },
    { key: "header_title", value: "", type: "text", category: "branding" },
    { key: "primary_color", value: "#7367F0", type: "color", category: "theme" },
    { key: "secondary_color", value: "#A8AAAE", type: "color", category: "theme" },
    { key: "accent_color", value: "#28C76F", type: "color", category: "theme" },
    { key: "footer_text", value: "", type: "text", category: "content" },
    { key: "support_email", value: "", type: "text", category: "content" },
    { key: "terms_url", value: "", type: "text", category: "content" },
    { key: "privacy_url", value: "", type: "text", category: "content" },
  ];

  // Get current value for a setting key
  const getSettingValue = (key: string): string => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value || "";
  };

  // Setting editor component
  const SettingEditor = ({ settingDef }: { settingDef: SettingInput }) => {
    const [localValue, setLocalValue] = useState(getSettingValue(settingDef.key));

    // Sync local value when settings change
    useEffect(() => {
      setLocalValue(getSettingValue(settingDef.key) || settingDef.value || "");
    }, [settings, settingDef.key, settingDef.value]);

    const handleSave = () => {
      saveMutation.mutate({
        ...settingDef,
        value: localValue,
      });
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={settingDef.key} className="text-sm font-medium">
            {settingDef.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Label>
          <span className="text-xs text-muted-foreground">{settingDef.type}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {settingDef.type === "color" ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                id={settingDef.key}
                type="color"
                value={localValue || settingDef.value}
                onChange={(e) => setLocalValue(e.target.value)}
                className="h-10 w-20"
                data-testid={`input-${settingDef.key}`}
              />
              <Input
                type="text"
                value={localValue || settingDef.value}
                onChange={(e) => setLocalValue(e.target.value)}
                className="flex-1 font-mono text-sm"
                placeholder="#000000"
                data-testid={`input-${settingDef.key}-text`}
              />
            </div>
          ) : (
            <Input
              id={settingDef.key}
              type="text"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder={`Enter ${settingDef.key.replace(/_/g, " ")}`}
              className="flex-1"
              data-testid={`input-${settingDef.key}`}
            />
          )}
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            size="sm"
            data-testid={`button-save-${settingDef.key}`}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CMS Settings</h1>
          <p className="text-sm text-muted-foreground">
            Customize your platform's branding, theme, and content
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/cms-settings"] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="branding" data-testid="tab-branding">
            <ImageIcon className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="theme" data-testid="tab-theme">
            <Palette className="h-4 w-4 mr-2" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">
            <Type className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading settings...
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="branding" className="space-y-4">
              <Card className="shadow-sm" data-testid="card-branding">
                <CardHeader className="pb-4 border-b">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Branding Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Configure your platform's logo, name, and visual identity
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {defaultSettings
                    .filter((s) => s.category === "branding")
                    .map((setting) => (
                      <SettingEditor key={setting.key} settingDef={setting} />
                    ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="theme" className="space-y-4">
              <Card className="shadow-sm" data-testid="card-theme">
                <CardHeader className="pb-4 border-b">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Theme Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Customize your platform's color scheme and appearance
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Palette className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {defaultSettings
                    .filter((s) => s.category === "theme")
                    .map((setting) => (
                      <SettingEditor key={setting.key} settingDef={setting} />
                    ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              <Card className="shadow-sm" data-testid="card-content">
                <CardHeader className="pb-4 border-b">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Content Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage footer text, support contact, and legal links
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Type className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {defaultSettings
                    .filter((s) => s.category === "content")
                    .map((setting) => (
                      <SettingEditor key={setting.key} settingDef={setting} />
                    ))}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
