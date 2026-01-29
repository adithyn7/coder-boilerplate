import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          This is a starter template with React, TypeScript, Tailwind CSS, and Supabase.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://react.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            React Docs
          </a>
          <a
            href="https://supabase.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Supabase Docs
          </a>
        </div>
        <p className="mt-8 text-sm text-gray-500">
          Try visiting a <Link to="/nonexistent" className="text-blue-600 hover:underline">non-existent page</Link> to see the 404 page.
        </p>
      </div>
    </div>
  )
}
