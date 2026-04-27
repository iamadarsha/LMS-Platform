import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ContentDetail from "./pages/ContentDetail.tsx";
import Explore from "./pages/Explore.tsx";
import FindExperts from "./pages/FindExperts.tsx";
import FixTheItch from "./pages/FixTheItch.tsx";
import Contribute from "./pages/Contribute.tsx";
import StudioDashboard from "./pages/studio/StudioDashboard.tsx";
import StudioXPHistory from "./pages/studio/StudioXPHistory.tsx";
import StudioTransfer from "./pages/studio/StudioTransfer.tsx";
import MyProgress from "./pages/MyProgress.tsx";
import RecentlyViewed from "./pages/RecentlyViewed.tsx";
import MyFavourites from "./pages/MyFavourites.tsx";
import Settings from "./pages/Settings.tsx";
import MyProfile from "./pages/MyProfile.tsx";
import SignIn from "./pages/SignIn.tsx";
import { RequireAuth } from "./components/RequireAuth.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/content/:slug" element={<ContentDetail />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/find-experts" element={<FindExperts />} />
          <Route path="/fix-the-itch" element={<FixTheItch />} />
          <Route path="/contribute" element={<Navigate to="/studio/contribute" replace />} />
          <Route path="/studio" element={<RequireAuth><StudioDashboard /></RequireAuth>} />
          <Route path="/studio/contribute" element={<RequireAuth><Contribute /></RequireAuth>} />
          <Route path="/studio/xp-history" element={<RequireAuth><StudioXPHistory /></RequireAuth>} />
          <Route path="/studio/transfer" element={<RequireAuth><StudioTransfer /></RequireAuth>} />
          <Route path="/my-progress" element={<MyProgress />} />
          <Route path="/recently-viewed" element={<RecentlyViewed />} />
          <Route path="/my-favourites" element={<MyFavourites />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/signin" element={<SignIn />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
