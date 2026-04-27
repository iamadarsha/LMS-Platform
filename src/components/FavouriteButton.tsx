import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFavourites, toggleFavourite } from "@/data/favouritesStore";

type Props = {
  contributionId?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "overlay" | "pill";
  showLabel?: boolean;
};

const sizeMap = {
  sm: { btn: "h-8 w-8", icon: "h-4 w-4" },
  md: { btn: "h-10 w-10", icon: "h-5 w-5" },
  lg: { btn: "h-11 w-11", icon: "h-5 w-5" },
};

export function FavouriteButton({
  contributionId,
  className,
  size = "md",
  variant = "overlay",
  showLabel = false,
}: Props) {
  const favourites = useFavourites();
  const isFavourited = contributionId ? favourites.has(contributionId) : false;

  if (!contributionId) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nowFavourited = await toggleFavourite(contributionId);
    toast.success(nowFavourited ? "Added to My Favourites" : "Removed from My Favourites");
  };

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isFavourited}
        aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
          isFavourited
            ? "border-primary bg-primary/15 text-primary hover:bg-primary/20"
            : "border-border bg-card/60 text-foreground hover:border-foreground/30",
          className,
        )}
      >
        <Heart
          className={cn("h-4 w-4", isFavourited && "fill-current")}
        />
        {showLabel ? (isFavourited ? "Liked" : "Like") : null}
      </button>
    );
  }

  const sz = sizeMap[size];
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFavourited}
      aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border backdrop-blur-md transition",
        sz.btn,
        isFavourited
          ? "border-primary bg-primary/20 text-primary hover:bg-primary/30"
          : "border-foreground/20 bg-background/70 text-foreground hover:border-foreground/40 hover:bg-background/90",
        className,
      )}
    >
      <Heart className={cn(sz.icon, isFavourited && "fill-current")} />
    </button>
  );
}
