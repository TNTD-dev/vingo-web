import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { getSearchEventsQueryKey, searchEvents } from '@/api/generated/endpoints/search/search'
import { SearchEventsSort } from '@/api/generated/model'
import { Mascot } from '@/design/Mascot'
import { icons } from '@/design/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/design/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/design/ui/sheet'
import { cn } from '@/lib/cn'

import { EventCard, EventCardSkeleton } from './EventCard'
import { CITY_FULL_NAME, hasActiveFilters, readFilters, SORT_LABEL, toSearchParams, writeFilters } from './eventFilters'
import type { EventFilters } from './eventFilters'
import { EventFiltersPanel } from './EventFiltersPanel'

// B1 · Khám phá sự kiện (Figma 03 · Buyer). Bộ lọc nằm trên URL; danh sách tải thêm theo cursor.
export default function EventsPage() {
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const [now] = useState(() => new Date())
  const apiParams = toSearchParams(filters, now)

  const query = useInfiniteQuery({
    queryKey: [...getSearchEventsQueryKey(apiParams), 'infinite'],
    queryFn: ({ pageParam, signal }) => searchEvents({ ...apiParams, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  })

  const setFilters = (next: EventFilters) => setParams(writeFilters(next), { replace: true })
  const events = (query.data?.pages.flatMap((p) => p.data ?? []) ?? []).filter(
    (e) => !filters.available || e.on_sale !== false,
  )

  const count = query.isSuccess ? `${events.length}${query.hasNextPage ? '+' : ''} sự kiện · ` : ''
  const where = filters.city ? CITY_FULL_NAME[filters.city] : 'Toàn quốc'
  const panel = (className?: string) => (
    <EventFiltersPanel filters={filters} onChange={setFilters} now={now} className={className} />
  )

  return (
    <section className="flex flex-col gap-8 pt-1">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-6">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="type-mono-label text-ink-secondary">
            {'// '}
            {count}
            {filters.q && `“${filters.q}” · `}
            {where}
          </p>
          <h1 className="type-display-l text-foreground">Khám phá sự kiện</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Sheet>
            <SheetTrigger className="flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2.5 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
              <img src={icons.filter} alt="" className="size-4" />
              Bộ lọc
              {hasActiveFilters(filters) && <span className="size-1.5 rounded-pill bg-ink" />}
            </SheetTrigger>
            <SheetContent side="left" className="w-full overflow-y-auto bg-canvas p-4 sm:max-w-[340px]">
              <SheetTitle className="sr-only">Bộ lọc</SheetTitle>
              {panel('mt-8')}
            </SheetContent>
          </Sheet>

          <span className="hidden type-body-m text-ink-secondary sm:inline">Sắp xếp</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2.5 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {SORT_LABEL[filters.sort]}
              <img src={icons.chevronDown} alt="" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-44 rounded-md">
              <DropdownMenuRadioGroup
                value={filters.sort}
                onValueChange={(v) => setFilters({ ...filters, sort: v as SearchEventsSort })}
              >
                {Object.values(SearchEventsSort).map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {SORT_LABEL[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex items-start gap-6">
        <aside className="hidden w-[300px] shrink-0 lg:block">{panel()}</aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {query.isPending ? (
            <Grid>
              {Array.from({ length: 6 }, (_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </Grid>
          ) : query.isError ? (
            <Empty
              title="Không tải được danh sách sự kiện"
              hint="Kiểm tra kết nối rồi thử lại."
              action={{ label: 'Thử lại', onClick: () => void query.refetch() }}
            />
          ) : events.length === 0 ? (
            <Empty
              title="Chưa có sự kiện phù hợp"
              hint="Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm."
              action={
                hasActiveFilters(filters) || filters.q
                  ? { label: 'Xoá lọc', onClick: () => setFilters({ sort: filters.sort, available: false }) }
                  : undefined
              }
            />
          ) : (
            <Grid className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')}>
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </Grid>
          )}

          {query.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="flex items-center gap-5 rounded-md border border-line bg-surface py-[5px] pr-6 pl-[5px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="flex h-11 w-12 items-center justify-center rounded-sm bg-ink">
                  <img src={icons.chevronsRight} alt="" className="size-5" />
                </span>
                <span className="type-body-m-strong text-foreground">
                  {query.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm sự kiện'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** Lưới thẻ: 3 cột 332px như Figma khi đủ chỗ, hẹp hơn thì co giãn 2 → 1 cột. */
function Grid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        // Toàn bộ dùng min-[…] để Tailwind sắp theo giá trị; trộn với sm:/xl: thì breakpoint có tên đè lên.
        'grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1280px]:grid-cols-3 min-[1416px]:grid-cols-[repeat(3,332px)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-14 text-center">
      <Mascot state="sorry" className="h-28 w-auto" />
      <h2 className="type-h4 text-foreground">{title}</h2>
      <p className="type-body-m text-ink-secondary">{hint}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
