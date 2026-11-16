import { describe, expect, it } from 'vitest'
import { parseMapsLink } from './mapsLink'

describe('parseMapsLink', () => {
  it('đọc toạ độ sau dấu @', () => {
    expect(parseMapsLink('https://www.google.com/maps/place/SVD/@21.0245,105.8412,17z')).toEqual({
      lat: 21.0245,
      lng: 105.8412,
    })
  })
  it('ưu tiên toạ độ địa điểm !3d!4d', () => {
    expect(parseMapsLink('https://www.google.com/maps/place/X/@21.1,105.1,17z/data=!3d21.0245!4d105.8412')).toEqual({
      lat: 21.0245,
      lng: 105.8412,
    })
  })
  it('đọc tham số q=lat,lng', () => {
    expect(parseMapsLink('https://maps.google.com/?q=10.7769,106.7009')).toEqual({ lat: 10.7769, lng: 106.7009 })
  })
  it('không đọc được link rút gọn hoặc toạ độ ngoài phạm vi', () => {
    expect(parseMapsLink('https://maps.app.goo.gl/abc123')).toBeNull()
    expect(parseMapsLink('https://x/@123.5,105.1,1z')).toBeNull()
  })
})
