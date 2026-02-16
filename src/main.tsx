import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import './index.css'

// Clave pública de Clerk (debería venir de variable de entorno .env.local)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 60 * 24, // 24 horas (antes cacheTime)
    },
  },
})

if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY === "pk_test_placeholder" || PUBLISHABLE_KEY === "pk_test_tu_clave_aqui") {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Falta Configuración</h1>
          <p className="text-slate-600 mb-6">
            No se encontró la clave pública de Clerk o es inválida.
          </p>
          <div className="bg-slate-100 p-4 rounded text-left text-sm font-mono mb-6 overflow-x-auto">
            <p className="text-slate-500 mb-2">// Crea un archivo .env en la raíz con:</p>
            <p>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</p>
          </div>
          <p className="text-sm text-slate-500">
            Obtén tu clave en <a href="https://dashboard.clerk.com" target="_blank" className="text-blue-600 hover:underline">dashboard.clerk.com</a>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-800 transition-colors"
          >
            Recargar Página
          </button>
        </div>
      </div>
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkProvider>
    </StrictMode>,
  )
}
