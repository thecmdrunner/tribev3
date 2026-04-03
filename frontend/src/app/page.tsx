import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <span className="text-2xl">🧠</span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-100">
              TRIBE v2
            </h1>
            <p className="text-xs text-neutral-500">
              Multimodal Brain Encoding
            </p>
          </div>
        </div>
      </header>

      {/* Hero + Dashboard */}
      <div className="flex-1 px-6 py-10">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-100">
            Predict brain activity from video
          </h2>
          <p className="mt-2 text-neutral-500">
            Upload a video and TRIBE v2 will predict fMRI brain responses across
            the cortical surface using vision, audio, and language models.
          </p>
        </div>
        <Dashboard />
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-800/60 py-4 text-center text-xs text-neutral-600">
        TRIBE v2 &mdash; Meta FAIR &middot; LLaMA 3.2 + V-JEPA2 + Wav2Vec-BERT
      </footer>
    </main>
  );
}
