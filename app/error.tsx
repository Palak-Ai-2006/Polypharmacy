"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[PolyPGx] Unhandled error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex items-center justify-center p-6">
      <div className="bg-white rounded-lg border border-[#E8E4DC] p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#12354E] mb-2">Something went wrong</h2>
        <p className="text-sm text-[#5A6B7A] mb-6">
          An unexpected error occurred. This has been logged for investigation.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-[#064F6E] text-white text-sm font-medium rounded-md hover:bg-[#053d56] transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
