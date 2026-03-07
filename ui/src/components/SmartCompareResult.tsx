import { SmartCompareResult as SmartResult, SmartCompareGroup } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Images,
    Search,
    Shield,
    AlertTriangle,
} from "lucide-react";

interface SmartCompareResultProps {
    result: SmartResult;
}

function toThumbUrl(imageId: number, size = 300): string {
    return `${API_BASE_URL.replace(/\/$/, "")}/thumbnail/${imageId}?size=${size}`;
}

function confidenceColor(c: number): string {
    if (c >= 0.95) return "text-red-400";
    if (c >= 0.90) return "text-orange-400";
    if (c >= 0.85) return "text-yellow-400";
    return "text-muted-foreground";
}

function confidenceBg(c: number): string {
    if (c >= 0.95) return "bg-red-500/10 border-red-500/30";
    if (c >= 0.90) return "bg-orange-500/10 border-orange-500/30";
    if (c >= 0.85) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-muted/20 border-border";
}

function DuplicateGroup({
    group,
    index,
}: {
    group: SmartCompareGroup;
    index: number;
}) {
    return (
        <div
            className={`rounded-xl border-2 p-4 space-y-3 ${confidenceBg(
                group.confidence
            )}`}
        >
            {/* Group header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertTriangle
                        className={`h-4 w-4 ${confidenceColor(group.confidence)}`}
                    />
                    <span className="text-sm font-semibold">
                        第 {index + 1} 组 · {group.images.length} 张图片
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={`text-xs ${confidenceColor(group.confidence)}`}
                    >
                        相似度 {(group.confidence * 100).toFixed(1)}%
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        {group.matched_count}/{11} 算法确认
                    </Badge>
                </div>
            </div>

            {/* Image thumbnails */}
            <div className="flex flex-wrap gap-3">
                {group.images.map((img) => (
                    <div
                        key={img.id}
                        className="relative group rounded-lg overflow-hidden border bg-background"
                    >
                        <img
                            src={toThumbUrl(img.id)}
                            alt={img.filename}
                            className="h-32 w-32 object-cover"
                            loading="lazy"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1">
                            <p className="text-[10px] text-white truncate">{img.filename}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Algorithm chips */}
            <div className="flex flex-wrap gap-1">
                {group.matched_algorithms.map((algo) => (
                    <Badge key={algo} variant="outline" className="text-[10px] px-1.5 py-0">
                        {algo.toUpperCase()}
                    </Badge>
                ))}
            </div>
        </div>
    );
}

export function SmartCompareResultView({ result }: SmartCompareResultProps) {
    const { found_duplicates, duplicate_groups, summary, total_images, algorithms_used, scan_seconds, unique_count } = result;

    // Features still computing
    if (result.features_pending) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Clock className="h-10 w-10 text-yellow-400 animate-pulse" />
                        <p className="text-sm text-muted-foreground">{summary}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        {found_duplicates ? (
                            <AlertTriangle className="h-5 w-5 text-orange-400" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                        )}
                        查重结果
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Summary text */}
                    <p className="text-sm mb-4">{summary}</p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Images className="h-3.5 w-3.5" />
                            {total_images} 张图片
                        </span>
                        <span className="flex items-center gap-1">
                            <Search className="h-3.5 w-3.5" />
                            {algorithms_used} 种算法
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {scan_seconds}s
                        </span>
                        {!found_duplicates && (
                            <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                全部唯一
                            </span>
                        )}
                        {found_duplicates && (
                            <span className="flex items-center gap-1 text-orange-400">
                                <XCircle className="h-3.5 w-3.5" />
                                {duplicate_groups.length} 组疑似重复 · {unique_count} 张唯一
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Duplicate Groups */}
            {found_duplicates && (
                <div className="space-y-3">
                    {duplicate_groups.map((group, i) => (
                        <DuplicateGroup key={i} group={group} index={i} />
                    ))}
                </div>
            )}

            {/* No duplicates */}
            {!found_duplicates && total_images >= 2 && (
                <Card>
                    <CardContent className="py-10">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-400" />
                            <p className="font-medium">所有图片均为唯一</p>
                            <p className="text-sm text-muted-foreground">
                                在 {algorithms_used} 种算法（含 8 方向旋转检测）下，均未发现相似图片对
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
