import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { SourcePicker } from "@/components/SourcePicker";
import { MappingStep } from "@/components/MappingStep";
import { ResultsStep } from "@/components/ResultsStep";
import type { ParsedTable } from "@/lib/parse";
import type { ColumnMap } from "@/lib/qr";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Kichi — QR codes from your attendee list" },
      {
        name: "description",
        content:
          "Drop an XLSX, CSV or Google Sheet and instantly generate one QR code per attendee. Minimalist, engineer-built, no signup.",
      },
      {
        property: "og:title",
        content: "Kichi — QR codes from your attendee list",
      },
      {
        property: "og:description",
        content: "Turn any spreadsheet into per-attendee QR codes for events.",
      },
    ],
  }),
});

type Step =
  | { kind: "source" }
  | { kind: "map"; table: ParsedTable }
  | { kind: "results"; table: ParsedTable; map: ColumnMap; baseUrl: string };

function Index() {
  const [step, setStep] = useState<Step>({ kind: "source" });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo />
          <div className="text-mono hidden items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:flex">
            <span>v0.1</span>
            <span className="h-1 w-1 rounded-full bg-signal" />
            <span>local-first</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
        {step.kind === "source" && (
          <>
            <Hero />
            <div className="mt-10">
              <SourcePicker
                onLoaded={(table) => setStep({ kind: "map", table })}
              />
            </div>
            <Steps />
          </>
        )}

        {step.kind === "map" && (
          <SectionTitle
            tag="step_02"
            title="Map your columns"
            subtitle="Tell Kichi which column is the name, email and role. The rest is ignored."
          >
            <MappingStep
              table={step.table}
              onBack={() => setStep({ kind: "source" })}
              onConfirm={(map, baseUrl) =>
                setStep({ kind: "results", table: step.table, map, baseUrl })
              }
            />
          </SectionTitle>
        )}

        {step.kind === "results" && (
          <SectionTitle
            tag="step_03"
            title="Codes generated"
            subtitle="Click any tile to download a single PNG, or grab the whole batch as a ZIP."
          >
            <ResultsStep
              table={step.table}
              map={step.map}
              baseUrl={step.baseUrl}
              onReset={() => setStep({ kind: "source" })}
            />
          </SectionTitle>
        )}
      </main>

      <footer className="mt-20 border-t border-border bg-paper/60">
        <div className="text-mono mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 px-5 py-6 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:flex-row sm:items-center">
          <span>// kichi · qr toolkit for events</span>
          <span>built for organizers who like sharp tools</span>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="space-y-6">
      <p className="text-mono text-xs uppercase tracking-[0.3em] text-signal">
        // step_01 · upload
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
        Spreadsheet in.
        <br />
        <span className="text-mono text-signal">QR codes</span> out.
      </h1>
      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        Kichi turns your attendee list into a unique QR code per row — for
        check-ins, badges, ticketing. Drop a file, map a couple of columns, ship
        the batch. No accounts, no friction.
      </p>
    </section>
  );
}

function Steps() {
  const items = [
    { n: "01", t: "Upload", d: "XLSX, CSV or a public Google Sheet." },
    { n: "02", t: "Map", d: "Pick name, email and role columns." },
    { n: "03", t: "Generate", d: "One QR per row. Download as ZIP." },
  ];
  return (
    <section className="mt-20 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
      {items.map((s) => (
        <div key={s.n} className="bg-paper p-6">
          <p className="text-mono text-xs uppercase tracking-[0.25em] text-signal">
            {s.n}
          </p>
          <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
        </div>
      ))}
    </section>
  );
}

function SectionTitle({
  tag,
  title,
  subtitle,
  children,
}: {
  tag: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-mono text-xs uppercase tracking-[0.3em] text-signal">
          // {tag}
        </p>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
