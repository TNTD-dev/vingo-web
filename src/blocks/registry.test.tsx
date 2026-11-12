import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChatBlockType } from '@/api/generated/model'

import { BlockView } from './registry'

describe('BlockView', () => {
  it.each(Object.values(ChatBlockType))('render được block %s', (type) => {
    render(<BlockView block={{ id: '1', type, payload: {} }} />)
    expect(screen.getByText(type)).toBeInTheDocument()
  })
})
