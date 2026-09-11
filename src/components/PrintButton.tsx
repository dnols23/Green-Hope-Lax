'use client'

/** Prints the page. Hidden on the paper, obviously. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary print:hidden mb-6">
      Print
    </button>
  )
}
