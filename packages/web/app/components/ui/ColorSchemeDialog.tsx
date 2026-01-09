import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import type { DesignScheme } from '../../types/design-scheme';
import { defaultDesignScheme, designFeatures, designFonts, paletteRoles } from '../../types/design-scheme';
import { Palette, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ColorSchemeDialogProps {
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  showButton?: boolean;
}

export const ColorSchemeDialog: React.FC<ColorSchemeDialogProps> = ({ setDesignScheme, designScheme, showButton = true }) => {
  const [palette, setPalette] = useState<{ [key: string]: string }>(() => {
    if (designScheme?.palette) {
      return { ...defaultDesignScheme.palette, ...designScheme.palette };
    }

    return defaultDesignScheme.palette;
  });

  const [features, setFeatures] = useState<string[]>(designScheme?.features || defaultDesignScheme.features);
  const [font, setFont] = useState<string[]>(designScheme?.font || defaultDesignScheme.font);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'colors' | 'typography' | 'features'>('colors');

  useEffect(() => {
    if (designScheme) {
      setPalette(() => ({ ...defaultDesignScheme.palette, ...designScheme.palette }));
      setFeatures(designScheme.features || defaultDesignScheme.features);
      setFont(designScheme.font || defaultDesignScheme.font);
    } else {
      setPalette(defaultDesignScheme.palette);
      setFeatures(defaultDesignScheme.features);
      setFont(defaultDesignScheme.font);
    }
  }, [designScheme]);

  useEffect(() => {
    const handleOpenDialog = () => {
      setIsDialogOpen(true);
    };

    window.addEventListener('openColorSchemeDialog', handleOpenDialog);
    return () => window.removeEventListener('openColorSchemeDialog', handleOpenDialog);
  }, []);

  const handleColorChange = (role: string, value: string) => {
    setPalette((prev) => ({ ...prev, [role]: value }));
  };

  const handleFeatureToggle = (key: string) => {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const handleFontToggle = (key: string) => {
    setFont((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const handleSave = () => {
    setDesignScheme?.({ palette, features, font });

    setIsDialogOpen(false);
  };

  const handleReset = () => {
    setPalette(defaultDesignScheme.palette);
    setFeatures(defaultDesignScheme.features);
    setFont(defaultDesignScheme.font);
  };

  const renderColorSection = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          Color Palette
        </h3>
        <button
          onClick={handleReset}
          className="text-xs bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 flex items-center gap-2 transition-all duration-200 border border-transparent hover:border-border/40"
        >
          <span className="text-sm">↺</span>
          Reset All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3">
          {paletteRoles.map((role) => (
            <div
              key={role.key}
              className="group flex items-start gap-3 p-3 rounded-lg bg-muted/10 hover:bg-muted/20 border border-border/20 hover:border-border/30 transition-all duration-200"
            >
              <div className="relative flex-shrink-0">
                <div
                  className="w-12 h-12 rounded-lg shadow-sm cursor-pointer transition-all duration-200 hover:scale-105 border border-border/20"
                  style={{ backgroundColor: palette[role.key] }}
                  onClick={() => document.getElementById(`color-input-${role.key}`)?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label={`Change ${role.label} color`}
                />
                <input
                  id={`color-input-${role.key}`}
                  type="color"
                  value={palette[role.key]}
                  onChange={(e) => handleColorChange(role.key, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center shadow-sm border border-border/40">
                  <span className="text-[10px]">✏️</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-medium text-foreground transition-colors text-sm">{role.label}</div>
                  <div className="text-xs text-muted-foreground font-mono px-2 py-0.5 bg-muted/30 rounded-md whitespace-nowrap">
                    {palette[role.key]}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed break-words">
                  {role.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTypographySection = () => (
    <div className="flex flex-col h-full">
      <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-primary"></div>
        Typography
      </h3>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {designFonts.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFontToggle(f.key)}
              className={`group p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 h-28 flex flex-col justify-center relative ${
                font.includes(f.key)
                  ? 'bg-primary/10 border-primary/50 shadow-lg'
                  : 'bg-muted/10 border-border/20 hover:border-primary/30 hover:bg-muted/20'
              }`}
            >
              <div className="text-center space-y-2">
                <div
                  className={`text-lg font-medium transition-colors ${
                    font.includes(f.key) ? 'text-primary' : 'text-foreground'
                  }`}
                  style={{ fontFamily: f.key }}
                >
                  {f.preview}
                </div>
                <div
                  className={`text-xs font-medium transition-colors ${
                    font.includes(f.key) ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {f.label}
                </div>
              </div>
              {font.includes(f.key) && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFeaturesSection = () => (
    <div className="flex flex-col h-full">
      <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-primary"></div>
        Design Features
      </h3>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {designFeatures.map((f) => {
            const isSelected = features.includes(f.key);

            return (
              <div key={f.key} className="feature-card-container">
                <button
                  type="button"
                  onClick={() => handleFeatureToggle(f.key)}
                  className={`group relative w-full p-4 text-sm font-medium transition-all duration-200 bg-muted/10 text-muted-foreground hover:bg-muted/20 rounded-lg border-2 ${
                    f.key === 'border'
                      ? isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/20 hover:border-primary/30 text-muted-foreground'
                      : isSelected
                        ? 'bg-primary/10 text-primary border-primary/50'
                        : 'border-border/20 hover:border-primary/30'
                  }`}
                  style={{
                    ...(f.key === 'gradient' && {
                      background: isSelected
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'var(--muted)',
                      color: isSelected ? 'white' : 'var(--muted-foreground)',
                      borderColor: isSelected ? 'transparent' : undefined,
                    }),
                  }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background/20">
                      {f.key === 'rounded' && (
                        <div
                          className={`w-5 h-5 bg-current transition-all duration-200 ${
                            isSelected ? 'rounded-full' : 'rounded'
                          } opacity-80`}
                        />
                      )}
                      {f.key === 'border' && (
                        <div
                          className={`w-5 h-5 rounded transition-all duration-200 ${
                            isSelected ? 'border-2 border-current opacity-90' : 'border-2 border-current opacity-70'
                          }`}
                        />
                      )}
                      {f.key === 'gradient' && (
                        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-400 via-pink-400 to-indigo-400 opacity-90" />
                      )}
                      {f.key === 'shadow' && (
                        <div className="relative">
                          <div
                            className={`w-5 h-5 bg-current rounded transition-all duration-200 ${
                              isSelected ? 'opacity-90' : 'opacity-70'
                            }`}
                          />
                          <div
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-current rounded transition-all duration-200 ${
                              isSelected ? 'opacity-40' : 'opacity-30'
                            }`}
                          />
                        </div>
                      )}
                      {f.key === 'frosted-glass' && (
                        <div className="relative">
                          <div
                            className={`w-5 h-5 rounded transition-all duration-200 backdrop-blur-sm bg-white/20 border border-white/30 ${
                              isSelected ? 'opacity-90' : 'opacity-70'
                            }`}
                          />
                          <div
                            className={`absolute inset-0 w-5 h-5 rounded transition-all duration-200 backdrop-blur-md bg-gradient-to-br from-white/10 to-transparent ${
                              isSelected ? 'opacity-60' : 'opacity-40'
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="font-semibold text-xs">{f.label}</div>
                      {isSelected && <div className="mt-1 w-6 h-0.5 bg-current rounded-full mx-auto opacity-60" />}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Action Button */}
      {showButton && (
        <div className="fixed bottom-4 left-4 z-40">
          <Button
            onClick={() => setIsDialogOpen(true)}
            variant="ghost"
            size="sm"
            className={cn(
              "group relative h-6 w-6 rounded-lg",
              "hover:bg-transparent"
            )}
            title="Design Palette & Features"
          >
            <Palette
              className="w-3.5 h-3.5 transition-transform group-hover:rotate-12"
            />

            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm border border-border/60 rounded-md px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-lg">
              <div className="font-medium">Design Palette</div>
              <div className="text-muted-foreground">Colors, fonts & features</div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border/60"></div>
            </div>
          </Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="py-6 px-6 min-w-[560px] max-w-[90vw] h-[600px] flex flex-col gap-3 overflow-hidden border-0 shadow-2xl bg-background/95 backdrop-blur-xl">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                Design Palette & Features
              </DialogTitle>
              <DialogDescription className="text-muted-foreground leading-relaxed mt-1">
                Customize your color palette, typography, and design features to guide the AI in creating designs that match your style.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Navigation Tabs */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border/20">
          {[
            { key: 'colors', label: 'Colors', icon: '🎨' },
            { key: 'typography', label: 'Typography', icon: '📝' },
            { key: 'features', label: 'Features', icon: '✨' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeSection === tab.key
                  ? 'bg-background text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeSection === 'colors' && renderColorSection()}
          {activeSection === 'typography' && renderTypographySection()}
          {activeSection === 'features' && renderFeaturesSection()}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-border/20">
          <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/30">
            <span className="font-medium">{Object.keys(palette).length}</span> colors •
            <span className="font-medium ml-1">{font.length}</span> fonts •
            <span className="font-medium ml-1">{features.length}</span> features
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-border/60 hover:bg-muted/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};