import { currentParent, parentHubReady } from '@/lib/parentAccess'
import { getSheet, listSheets, spotsLeft } from '@/lib/signupSheets'
import { SheetCard } from '@/components/parents/SheetCard'
import { NewSheetForm } from '@/components/parents/NewSheetForm'

export const metadata = { title: 'Parent Hub' }
export const dynamic = 'force-dynamic'

export default async function ParentHubPage() {
  if (!(await parentHubReady())) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-black mb-2">Parent Hub</h1>
        <p className="text-gray-600">
          The Parent Hub is not switched on yet. A coach needs to run the parent hub SQL in
          Supabase.
        </p>
      </div>
    )
  }

  const parent = await currentParent()
  const sheets = await listSheets()
  const withCounts = await Promise.all(
    sheets.map(async (s) => {
      const full = await getSheet(s.id)
      return { sheet: s, left: full ? spotsLeft(full) : 0 }
    })
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black mb-1">
          {parent ? `Hi, ${parent.name.split(' ')[0]}` : 'Parent Hub'}
        </h1>
        <p className="text-gray-600">
          Sign-up sheets for the things the team needs hands for. Take a spot and you will get
          an email with what you said you would bring.
        </p>
      </div>

      <section>
        <h2 className="font-bold text-gray-700 mb-3">Open sign-ups</h2>
        {withCounts.length === 0 ? (
          <p className="card p-6 text-gray-500">
            Nothing needs volunteers right now. This is where it will appear.
          </p>
        ) : (
          <div className="space-y-3">
            {withCounts.map(({ sheet, left }) => (
              <SheetCard key={sheet.id} sheet={sheet} spotsLeft={left} />
            ))}
          </div>
        )}
      </section>

      {parent?.is_team_parent && (
        <details className="card p-5">
          <summary className="cursor-pointer font-bold text-gray-700 list-none">
            ✚ New sign-up sheet
            <span className="ml-2 text-xs font-normal text-gray-400">team parent</span>
          </summary>
          <div className="mt-4">
            <NewSheetForm from="hub" />
          </div>
        </details>
      )}
    </div>
  )
}
