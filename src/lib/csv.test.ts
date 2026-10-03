import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('starts with a BOM, separates with semicolons and ends every row in CRLF', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('﻿a;b\r\n1;2\r\n')
  })

  it('quotes what would break a cell and doubles the quotes inside', () => {
    expect(toCsv([['x;y', 'say "hi"', 'two\nlines', null, undefined, 0]])).toBe('﻿"x;y";"say ""hi""";"two\nlines";;;0\r\n')
  })

  it('takes another separator', () => {
    expect(toCsv([['a,b', 'c']], ',')).toBe('﻿"a,b",c\r\n')
  })
})
