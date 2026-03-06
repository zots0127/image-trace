import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Zap, Cpu, Layers, Play, Eye, BarChart3, Blend, type LucideIcon } from "lucide-react";
import { HashType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AnalysisPanelProps {
  projectId: string;
  hasImages: boolean;
  loading?: boolean;
  onAnalyze: (hashType: HashType, rotationInvariant: boolean) => void;
}

interface AlgoItem {
  value: HashType;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const tiers: { title: string; subtitle: string; algos: AlgoItem[] }[] = [
  {
    title: "Tier 1 — Hash",
    subtitle: "Millisecond-level perceptual hashing",
    algos: [
      { value: "phash", label: "pHash", desc: "Perceptual hash, robust to scaling", icon: Zap },
      { value: "dhash", label: "dHash", desc: "Difference hash, fast gradient comparison", icon: Zap },
      { value: "ahash", label: "aHash", desc: "Average hash, simplest and fastest", icon: Zap },
      { value: "whash", label: "wHash", desc: "Wavelet hash, multi-frequency analysis", icon: Zap },
      { value: "colorhash", label: "ColorHash", desc: "Color distribution hash", icon: Zap },
    ],
  },
  {
    title: "Tier 2 — Pixel / Structure",
    subtitle: "Pixel-level comparison, 100ms range",
    algos: [
      { value: "ssim", label: "SSIM", desc: "Structural similarity, human-perceived quality", icon: Eye },
      { value: "histogram", label: "Histogram", desc: "Color histogram correlation (HSV)", icon: BarChart3 },
      { value: "template", label: "Template", desc: "Normalized cross-correlation (NCC)", icon: Eye },
    ],
  },
  {
    title: "Tier 3 — Feature Descriptor",
    subtitle: "Keypoint matching, most accurate, 1s+ range",
    algos: [
      { value: "orb", label: "ORB", desc: "Oriented FAST + Rotated BRIEF, balanced", icon: Cpu },
      { value: "brisk", label: "BRISK", desc: "Binary robust invariant scalable keypoints", icon: Cpu },
      { value: "sift", label: "SIFT", desc: "Scale-invariant feature transform, gold standard", icon: Layers },
      { value: "akaze", label: "AKAZE", desc: "Accelerated KAZE, non-linear diffusion", icon: Layers },
      { value: "kaze", label: "KAZE", desc: "Non-linear scale space, most precise", icon: Layers },
    ],
  },
  {
    title: "Fusion",
    subtitle: "Multi-algorithm weighted ensemble",
    algos: [
      { value: "auto", label: "Auto (Hybrid)", desc: "pHash(30%) + SSIM(30%) + ORB(40%)", icon: Blend },
    ],
  },
];

export function AnalysisPanel({ projectId, hasImages, onAnalyze, loading }: AnalysisPanelProps) {
  const [algorithm, setAlgorithm] = useState<HashType>("sift");
  const [rotationInvariant, setRotationInvariant] = useState(false);

  const handleAnalyze = () => {
    onAnalyze(algorithm, rotationInvariant);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Analysis</CardTitle>
        <CardDescription>Select algorithm and configure comparison settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Algorithm Selection */}
        {tiers.map((tier) => (
          <div key={tier.title}>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {tier.title} <span className="font-normal">— {tier.subtitle}</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tier.algos.map((algo) => {
                const Icon = algo.icon;
                const selected = algorithm === algo.value;
                return (
                  <button
                    key={algo.value}
                    onClick={() => setAlgorithm(algo.value)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all text-sm",
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{algo.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{algo.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Rotation Invariance Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div>
            <Label htmlFor="rotation-invariant" className="font-medium cursor-pointer">
              Rotation Invariant
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Test 8 orientations (4 rotations × 2 flips), take highest score
            </p>
          </div>
          <Switch
            id="rotation-invariant"
            checked={rotationInvariant}
            onCheckedChange={setRotationInvariant}
          />
        </div>

        {/* Analyze Button */}
        <Button
          onClick={handleAnalyze}
          disabled={!hasImages || loading}
          className="w-full gap-2"
          size="lg"
        >
          <Play className="h-4 w-4" />
          {loading ? "Analyzing..." : "Start Analysis"}
        </Button>

        {!hasImages && (
          <p className="text-sm text-center text-muted-foreground">
            Please upload at least one image first
          </p>
        )}
      </CardContent>
    </Card>
  );
}
