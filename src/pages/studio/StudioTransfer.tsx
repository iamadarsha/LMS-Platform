import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Upload, Package, AlertTriangle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { StudioShell } from "@/components/studio/StudioShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadBlob,
  exportContributionsZip,
  importContributionsZip,
} from "@/data/contributionsTransfer";

type Status = { current: number; total: number; label: string } | null;

export default function StudioTransfer() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<Status>(null);
  const [importStatus, setImportStatus] = useState<Status>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSignedInEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSignedInEmail(data.session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleExport() {
    try {
      setExporting(true);
      setExportStatus({ current: 0, total: 1, label: "Preparing…" });
      const blob = await exportContributionsZip((info) => setExportStatus(info));
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `hyvemind-contributions-${stamp}.zip`);
      toast.success("Export ready", {
        description: "Your archive has been downloaded.",
      });
    } catch (err) {
      console.error(err);
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setExporting(false);
      setExportStatus(null);
    }
  }

  async function handleImport(file: File) {
    try {
      setImporting(true);
      setImportStatus({ current: 0, total: 1, label: "Reading archive…" });
      const result = await importContributionsZip(file, (info) => setImportStatus(info));
      toast.success("Import complete", {
        description: `${result.imported} of ${result.total} resources imported${
          result.skipped ? ` (${result.skipped} skipped)` : ""
        }.`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setImporting(false);
      setImportStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <StudioShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Transfer Resources</h1>
          <p className="text-sm text-muted-foreground">
            Export your contributions as a single archive, or import an archive into this project to
            replicate every resource — including videos, thumbnails, transcripts, and XP — exactly as
            it was.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Export */}
          <section className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Export everything</h2>
                <p className="text-xs text-muted-foreground">
                  Bundles all contributions and their cloud assets into one .zip you can download.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="mt-6 w-full bg-gradient-primary text-primary-foreground"
            >
              <Package className="mr-2 h-4 w-4" />
              {exporting ? "Exporting…" : "Download archive"}
            </Button>

            {exportStatus && (
              <div className="mt-4 space-y-2">
                <Progress value={(exportStatus.current / Math.max(exportStatus.total, 1)) * 100} />
                <p className="truncate text-xs text-muted-foreground">{exportStatus.label}</p>
              </div>
            )}
          </section>

          {/* Import */}
          <section className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Import an archive</h2>
                <p className="text-xs text-muted-foreground">
                  Re-uploads every asset to this project's cloud bucket and inserts the rows.
                </p>
              </div>
            </div>

            {!signedInEmail ? (
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                <p className="text-foreground font-medium">Sign in required</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Imports are written under your account. Sign in (or create an account) on the
                  hidden auth page, then return here.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="mt-3 bg-gradient-primary text-primary-foreground"
                >
                  <Link to="/signin?redirect=/studio/transfer">
                    <LogIn className="mr-2 h-3.5 w-3.5" />
                    Open sign-in
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Signed in as <span className="text-foreground">{signedInEmail}</span>
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing || !signedInEmail}
              className="mt-3 w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? "Importing…" : "Choose .zip file"}
            </Button>

            {importStatus && (
              <div className="mt-4 space-y-2">
                <Progress value={(importStatus.current / Math.max(importStatus.total, 1)) * 100} />
                <p className="truncate text-xs text-muted-foreground">{importStatus.label}</p>
              </div>
            )}
          </section>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Import inserts a fresh copy of every contribution under your current account, so you must
            be signed in before importing. Run it once on a fresh project to replicate this version —
            to avoid duplicates, only import into an empty project.
          </p>
        </div>
      </div>
    </StudioShell>
  );
}
