import { Link } from "react-router-dom";
import { Heart, Compass } from "lucide-react";
import { PageShell } from "@/components/dashboard/PageShell";
import { ResourceCard, type ResourceItem } from "@/components/dashboard/MediaCard";
import { contentLibrary, slugify } from "@/data/content";
import { useContributions } from "@/data/contributionsStore";
import { useFavourites } from "@/data/favouritesStore";

const MyFavourites = () => {
  const { items: contributions } = useContributions();
  const favouriteIds = useFavourites();
  const library = [...contributions, ...contentLibrary];
  const favourites = library.filter((c) => c.id && favouriteIds.has(c.id));

  if (favourites.length === 0) {
    return (
      <PageShell eyebrow="YOU // FAVOURITES" title="My favourites">
        <div className="neon-border neon-subtle flex flex-col items-center gap-5 rounded-3xl p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Heart className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">No favourites yet</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Tap the heart icon on any resource card or the like button while watching to save it
              here for later.
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-violet transition hover:opacity-90"
          >
            <Compass className="h-4 w-4" />
            Explore Resources
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="YOU // FAVOURITES"
      title="My favourites"
      description="Everything you've heart-saved across the library."
    >
      <section className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
        {favourites.map((c) => {
          const resource: ResourceItem = {
            id: c.id,
            category: c.type,
            title: c.title,
            author: c.author,
            duration: c.duration,
            description: c.description ?? c.summary,
            glow: c.glow,
            views: c.views,
            likes: c.likes,
            thumbnail: c.thumbnail,
          };
          return (
            <Link key={c.id ?? c.title} to={`/content/${slugify(c.title)}`} className="block h-full">
              <ResourceCard item={resource} />
            </Link>
          );
        })}
      </section>
    </PageShell>
  );
};

export default MyFavourites;
