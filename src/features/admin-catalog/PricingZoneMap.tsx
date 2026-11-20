import { VenueMapView } from './VenueMapView'

type Props = {
  svg: string
  zones: readonly { code: string; fill: string; title: string }[]
  selectedZones: ReadonlySet<string>
  onZoneClick: (code: string) => void
}

export function PricingZoneMap({ svg, zones, selectedZones, onZoneClick }: Props) {
  return (
    <VenueMapView
      svg={svg}
      zonesOnly
      minimap
      zoneColors={Object.fromEntries(zones.map(({ code, fill }) => [code, { fill }]))}
      zoneTitles={Object.fromEntries(zones.map(({ code, title }) => [code, title]))}
      selectedZones={selectedZones}
      onZoneClick={onZoneClick}
    />
  )
}
