'use client'

/* Only ever on a tap: Safari on a phone blocks a page that tries to print on
   its own ("This website has been blocked from automatically printing"). */
export function PrintNow() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary !py-2 !px-5">
      Print
    </button>
  )
}
