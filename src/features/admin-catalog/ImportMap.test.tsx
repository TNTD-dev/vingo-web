import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ImportMap } from './ImportMap'
import { sanitizeSvg } from '@/seatmap/svg'

afterEach(cleanup)
describe('preview SVG v2', () => {
  it('giữ use nội bộ, loại href bên ngoài và event handler', () => {
    const svg = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><circle id="shape" r="2"/></defs><use href="#shape"/><use href="https://example.com/x.svg#s" onclick="alert(1)"/></svg>',
    )!
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    expect(doc.querySelectorAll('use')[0].getAttribute('href')).toBe('#shape')
    expect(doc.querySelectorAll('use')[1].hasAttribute('href')).toBe(false)
    expect(doc.querySelector('[onclick]')).toBeNull()
  })
  it('ghép cùng viewBox và bật tắt ghế/cổng độc lập', async () => {
    render(
      <ImportMap
        overview='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="GATE__G1__IN" width="5" height="5"/></svg>'
        detail='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle id="SEAT__A1__A__01" cx="20" cy="20" r="2"/></svg>'
      />,
    )
    await userEvent.click(screen.getByLabelText('Ghế'))
    const image = screen.getByRole('img', { name: 'Xem trước sơ đồ nhiều lớp' })
    expect(image.querySelector('[id^="SEAT__"]')).toHaveAttribute('visibility', 'hidden')
    expect(image.querySelector('[id^="GATE__"]')).not.toHaveAttribute('visibility', 'hidden')
    expect(image.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 100')
  })
})
