import {
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration
} from "react-router";
import CrashGame from "../src/components/CrashGame";
import "./app.css";

// Fonction qui définit les liens à inclure dans le <head> du document
export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect", 
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous"
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
  }
];

// Composant de mise en page globale
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>🚀 Crash Game - Casino DApp</title>
        <meta name="description" content="Jeu de casino décentralisé sur blockchain Ethereum - Retirez avant le crash!" />
        <Meta />
        <Links />
      </head>
      <body className="bg-gray-900">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Composant principal de l'application
export default function App() {
  return (
    <div className="App min-h-screen">
      <CrashGame />
    </div>
  );
}

// Gestion des erreurs globales dans l'application
export function ErrorBoundary({ error }: { error: any }) {
  let message = "Oops!";
  let details = "Une erreur inattendue est survenue.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Erreur";
    details = error.status === 404
      ? "La page demandée est introuvable."
      : error.statusText || details;
  }
  else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white flex items-center justify-center">
      <main className="p-8 max-w-2xl mx-auto text-center">
        <div className="bg-red-900 border border-red-600 rounded-lg p-8">
          <h1 className="text-4xl font-bold text-red-300 mb-4">❌ {message}</h1>
          <p className="text-red-100 text-lg mb-6">{details}</p>
          
          {stack && (
            <details className="mt-4">
              <summary className="cursor-pointer text-red-300 font-semibold mb-2">
                Détails techniques
              </summary>
              <pre className="w-full p-4 overflow-x-auto bg-gray-800 rounded text-left text-sm">
                <code className="text-red-200">{stack}</code>
              </pre>
            </details>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            🔄 Recharger la page
          </button>
        </div>
      </main>
    </div>
  );
}