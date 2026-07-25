import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { DiscoveryView, type DiscoveryViewParams } from "@/features/discovery/components/discovery-view"
import { SearchBox } from "@/features/discovery/components/search-box"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<DiscoveryViewParams>
}) {
  const resolvedSearchParams = await searchParams
  const locale = await getLocale()

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {translate(locale, "search.title")}
        </h1>
        <SearchBox placeholder={translate(locale, "search.placeholder")} />
        {resolvedSearchParams.q && (
          <p className="text-sm text-neutral-500">
            {translate(locale, "search.resultsFor")} “{resolvedSearchParams.q}”
          </p>
        )}
      </div>
      <DiscoveryView params={resolvedSearchParams} locale={locale} />
    </main>
  )
}
