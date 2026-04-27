import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";

type Props = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
};

export function EmptyLibraryState({
  title = "Your library is empty",
  description = "Nothing's been published yet. Upload a video in the Studio to seed the library with your first resource.",
  ctaLabel = "Open Studio",
  ctaTo = "/studio/contribute",
}: Props) {
  return (
    <div className="neon-border neon-subtle flex flex-col items-center gap-5 rounded-3xl p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-violet">
        <PlusCircle className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <Link
        to={ctaTo}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90"
      >
        <PlusCircle className="h-4 w-4" />
        {ctaLabel}
      </Link>
    </div>
  );
}
