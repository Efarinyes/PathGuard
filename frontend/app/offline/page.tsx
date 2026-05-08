import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline | PathGuard",
  description: "No tens connexió a internet",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg
            className="w-24 h-24 mx-auto text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Estàs fora de línia
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          No tens connexió a internet en aquest moment. Comprova la teva
          connexió i torna-ho a intentar.
        </p>

        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tornar a l&apos;inici
        </a>

        <p className="mt-8 text-sm text-gray-400">
          Les dades de localització que no s&apos;hagin sincronitzat es
          pendran automàticament quan tornis a tenir connexió.
        </p>
      </div>
    </div>
  );
}