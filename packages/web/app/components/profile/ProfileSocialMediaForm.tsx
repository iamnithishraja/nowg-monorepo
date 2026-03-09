import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Loader2, X } from "lucide-react";

interface ProfileSocialMediaFormProps {
  initialData: {
    linkedin: string;
    instagram: string;
    x: string;
    discord: string;
    portfolio: string;
    bio: string;
    address: string;
    customUrls: string[];
  };
}

export function ProfileSocialMediaForm({
  initialData,
}: ProfileSocialMediaFormProps) {
  const [linkedin, setLinkedin] = useState(initialData.linkedin || "");
  const [instagram, setInstagram] = useState(initialData.instagram || "");
  const [x, setX] = useState(initialData.x || "");
  const [discord, setDiscord] = useState(initialData.discord || "");
  const [portfolio, setPortfolio] = useState(initialData.portfolio || "");
  const [bio, setBio] = useState(initialData.bio || "");
  const [address, setAddress] = useState(initialData.address || "");
  const [customUrls, setCustomUrls] = useState<string[]>(
    initialData.customUrls || []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync state when initialData changes
  useEffect(() => {
    setLinkedin(initialData.linkedin || "");
    setInstagram(initialData.instagram || "");
    setX(initialData.x || "");
    setDiscord(initialData.discord || "");
    setPortfolio(initialData.portfolio || "");
    setBio(initialData.bio || "");
    setAddress(initialData.address || "");
    setCustomUrls(initialData.customUrls || []);
  }, [initialData]);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Create FormData for API submission
      const formData = new FormData();
      formData.append("linkedin", linkedin.trim());
      formData.append("instagram", instagram.trim());
      formData.append("x", x.trim());
      formData.append("discord", discord.trim());
      formData.append("portfolio", portfolio.trim());
      formData.append("bio", bio.trim());
      formData.append("address", address.trim());
      
      // Add custom URLs
      customUrls
        .filter((url) => url.trim())
        .forEach((url) => {
          formData.append("customUrls", url.trim());
        });

      // Call API endpoint
      const response = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save profile");
      }

      setSuccess(true);
      // Reload page after 1 second to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomUrl = () => {
    setCustomUrls([...customUrls, ""]);
  };

  const handleRemoveCustomUrl = (index: number) => {
    setCustomUrls(customUrls.filter((_, i) => i !== index));
  };

  const handleCustomUrlChange = (index: number, value: string) => {
    const updated = [...customUrls];
    updated[index] = value;
    setCustomUrls(updated);
  };

  return (
    <div className="pt-4 border-t border-subtle">
      <p className="text-sm font-medium text-primary mb-4">
        Social Media & Links
      </p>

      {/* Bio */}
      <div className="mb-4">
        <Label className="text-sm text-tertiary mb-2 block">Bio</Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="bg-surface-2/50 border-subtle text-secondary min-h-[100px]"
          placeholder="Tell us about yourself..."
          disabled={isLoading}
        />
      </div>

      {/* Address */}
      <div className="mb-4">
        <Label className="text-sm text-tertiary mb-2 block">Billing Address</Label>
        <Textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="bg-surface-2/50 border-subtle text-secondary min-h-[100px]"
          placeholder="Enter your billing address for invoices..."
          disabled={isLoading}
        />
      </div>

      {/* Social Media URLs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-sm text-tertiary mb-2 block">
            LinkedIn URL
          </Label>
          <Input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className="bg-surface-2/50 border-subtle text-secondary"
            placeholder="https://linkedin.com/in/yourprofile"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label className="text-sm text-tertiary mb-2 block">
            Instagram URL
          </Label>
          <Input
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="bg-surface-2/50 border-subtle text-secondary"
            placeholder="https://instagram.com/yourprofile"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label className="text-sm text-tertiary mb-2 block">
            X (Twitter) URL
          </Label>
          <Input
            type="url"
            value={x}
            onChange={(e) => setX(e.target.value)}
            className="bg-surface-2/50 border-subtle text-secondary"
            placeholder="https://x.com/yourprofile"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label className="text-sm text-tertiary mb-2 block">
            Discord Username
          </Label>
          <Input
            type="text"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            className="bg-surface-2/50 border-subtle text-secondary"
            placeholder="username#1234"
            disabled={isLoading}
          />
        </div>

        <div className="md:col-span-2">
          <Label className="text-sm text-tertiary mb-2 block">
            Portfolio Website
          </Label>
          <Input
            type="url"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            className="bg-surface-2/50 border-subtle text-secondary"
            placeholder="https://yourportfolio.com"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Custom URLs */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm text-tertiary">Custom URLs</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddCustomUrl}
            disabled={isLoading}
            className="h-8 text-xs bg-surface-2/50 hover:bg-surface-2 border-subtle text-secondary hover:text-primary"
          >
            + Add URL
          </Button>
        </div>
        <div className="space-y-2">
          {customUrls.length === 0 ? (
            <p className="text-xs text-tertiary italic">No custom URLs added</p>
          ) : (
            customUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => handleCustomUrlChange(index, e.target.value)}
                  className="flex-1 bg-surface-2/50 border-subtle text-secondary"
                  placeholder="https://example.com"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveCustomUrl(index)}
                  disabled={isLoading}
                  className="h-9 w-9 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/90 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Profile"
          )}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {success && (
          <p className="text-xs text-green-500">Profile saved successfully!</p>
        )}
      </div>
    </div>
  );
}
