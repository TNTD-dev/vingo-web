import { useMemo, type PointerEvent } from 'react'
import { Link } from 'react-router'

import { useSearchEvents } from '@/api/generated/endpoints/search/search'
import type { EventSummary } from '@/api/generated/model'

import concertImg from './assets/tile-concert.jpg'
import footballImg from './assets/tile-football.jpg'
import heroImg from './assets/hero.jpg'
import sparkle from './assets/sparkle.svg'
import theaterImg from './assets/tile-theater.jpg'

type Tile = { key: string; label: string; title: string; image: string; to: string }

const CATEGORY_LABEL: Record<string, string> = {
  FOOTBALL: 'Bóng đá',
  CONCERT: 'Concert',
  THEATER: 'Sân khấu',
  OTHER: 'Sự kiện',
}
const CATEGORY_IMAGE: Record<string, string> = {
  FOOTBALL: footballImg,
  CONCERT: concertImg,
  THEATER: theaterImg,
  OTHER: heroImg,
}

/** Dữ liệu dự phòng (đúng Figma) khi API chưa có sự kiện, đang tải hoặc lỗi. */
const FALLBACK: Tile[] = [
  { key: 'f1', label: 'Bóng đá', title: 'HAGL vs Hà Nội', image: footballImg, to: '/events?category=FOOTBALL' },
  { key: 'f2', label: 'Concert', title: 'Mùa Hè Xanh', image: concertImg, to: '/events?category=CONCERT' },
  { key: 'f3', label: 'Sân khấu', title: 'Lôi Vũ', image: theaterImg, to: '/events?category=THEATER' },
  { key: 'f4', label: 'Bóng đá', title: 'Cúp Quốc gia', image: heroImg, to: '/events?category=FOOTBALL' },
  { key: 'f5', label: 'Concert', title: 'Acoustic Night', image: concertImg, to: '/events?category=CONCERT' },
  { key: 'f6', label: 'Bóng đá', title: 'V.League V13', image: footballImg, to: '/events?category=FOOTBALL' },
]

function toTile(e: EventSummary): Tile | null {
  if (!e.id || !e.title) return null
  const cat = e.category ?? 'OTHER'
  return {
    key: e.id,
    label: CATEGORY_LABEL[cat] ?? 'Sự kiện',
    title: e.title,
    image: e.poster_url ?? CATEGORY_IMAGE[cat] ?? heroImg,
    to: `/events/${e.id}`,
  }
}

/** Thẻ nghiêng 3D tối đa 6° theo chuột, ảnh zoom 1.05 khi hover (Figma motion spec #6). */
function tilt(e: PointerEvent<HTMLElement>) {
  if (e.pointerType === 'touch') return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`)
  el.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 12}deg`)
}
function untilt(e: PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

function TileCard({ tile, hidden }: { tile: Tile; hidden?: boolean }) {
  return (
    <Link
      to={tile.to}
      onPointerMove={tilt}
      onPointerLeave={untilt}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
      className="lp-tile relative block h-[290px] w-[240px] shrink-0 overflow-hidden rounded-[24px] sm:h-[360px] sm:w-[300px]"
    >
      <img src={tile.image} alt="" loading="lazy" className="lp-tile-img absolute inset-0 size-full object-cover" />
      <span className="absolute inset-0 bg-linear-to-b from-transparent from-40% to-black/75" />
      <span className="absolute bottom-[72px] left-5 type-mono-label text-agent sm:bottom-[68px]">{tile.label}</span>
      <span className="absolute bottom-5 left-5 text-[26px] leading-none font-medium tracking-[-0.03em] whitespace-nowrap text-on-ink sm:text-[32px]">
        {tile.title}
      </span>
    </Link>
  )
}

export function FeaturedEvents() {
  const { data } = useSearchEvents({ sort: 'popularity', limit: 6 })
  const tiles = useMemo(() => {
    const real = (data?.data ?? []).map(toTile).filter((t): t is Tile => t !== null)
    return real.length >= 3 ? real : FALLBACK
  }, [data])

  // Hai bản sao liền nhau để vòng lặp -50% không giật; bản sao thứ hai ẩn khỏi trình đọc màn hình.
  const strip = (hidden: boolean) =>
    tiles.map((t, i) => (
      <div key={`${hidden ? 'b' : 'a'}${t.key}${i}`} className="flex items-center gap-5">
        <TileCard tile={t} hidden={hidden} />
        <img src={sparkle} alt="" className="size-9 shrink-0" />
      </div>
    ))

  return (
    <section
      aria-labelledby="featured-title"
      className="lp-events relative h-[560px] overflow-hidden bg-canvas sm:h-[634px]"
    >
      <div aria-hidden className="absolute top-[400px] left-0 w-max sm:top-[500px]">
        <div className="lp-marquee-back flex w-max whitespace-nowrap">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="text-[88px] leading-none font-medium tracking-[-0.06em] text-ink opacity-[0.08] sm:text-[140px]"
            >
              {'Bóng đá · Concert · Sân khấu · '}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-[-10%] top-[110px] rotate-[4deg] sm:top-[130px]">
        <div className="lp-marquee-track flex w-max items-center gap-5">
          {strip(false)}
          {strip(true)}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-16">
        <h2 id="featured-title" className="text-[36px] leading-none font-medium tracking-[-0.04em] sm:text-[56px]">
          Sự kiện nổi bật
        </h2>
        <Link
          to="/events"
          className="rounded-pill bg-ink px-5 py-3 type-body-m-strong text-on-ink transition-transform duration-150 hover:scale-105"
        >
          Xem tất cả sự kiện →
        </Link>
      </div>
    </section>
  )
}
