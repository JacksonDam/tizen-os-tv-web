// Samsung on-screen keyboard (com.samsung.tv.sboard-app) layout data for English (US).
//
// From the app's own resources (agent-extra/extpkg2/usr__apps__com.samsung.tv.sboard-app/res/):
//   config/skb_config.json   en_us_qwerty: singleline_layout 4x10_4_5, lang_keys en_us_qwerty,
//                            function_keys lang_function; en_us_symb: lang_keys en_us_symb, symb_function
//   skb/layout/4x10_4_5.json 5x11 cell grid; cells 0-39 = lang keys, 40-48 = function keys in list order
//   skb/lang_keys/en_us_qwerty.json, en_us_symb.json (2 pages), skb/function_keys/*.json
// Default focus index 10 ("q"); shift states off -> on -> lock.

export type FnKey =
  | 'settings' | 'space' | 'done' | 'left' | 'right' | 'backspace'
  | 'symb' | 'abc' | 'lang' | 'symb_lang' | 'shift' | 'symbpage'

export type Cell = {
  row: number
  col: number
  span: number               // col_span (the space bar is 6 wide, Done 2)
  char?: [string, string?]   // lang key: [page 1 / lower case, page 2 / upper case]
  upper?: boolean            // key_type "char": shift gives the upper-case label
  fn?: FnKey
}

const CHAR_ROWS = [
  '1234567890'.split(''),
  'qwertyuiop'.split(''),
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '’'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
]

// en_us_symb: labels[0] on page 1, labels[1] on page 2 (row 0 is the number bar on both pages)
const SYMB_ROWS: [string, string][][] = [
  '1234567890'.split('').map(d => [d, d]),
  [['+', '`'], ['×', '~'], ['÷', '\\'], ['=', '|'], ['/', '{'], ['_', '}'], ['<', '€'], ['>', '£'], ['[', '¥'], [']', '￦']],
  [['!', '°'], ['@', '•'], ['#', '○'], ['$', '●'], ['%', '□'], ['^', '■'], ['&', '♤'], ['*', '♡'], ['(', '◇'], [')', '♧']],
  [['-', '☆'], ["'", '▪'], ['"', '¤'], [':', '《'], [';', '》'], [',', '¡'], ['?', '¿'], ['.', '§'], ['،', '※'], ['؟', '¢']],
]

// 4x10_4_5 function cells in index order 40..48 with the function_keys list order:
// lang_function = settings, space, done, left, backspace, symb, lang, shift, right
// symb_function = settings, space, done, left, backspace, abc, symb_lang, symbpage, right
const FN_CELLS: Omit<Cell, 'fn'>[] = [
  { row: 4, col: 0, span: 1 },
  { row: 4, col: 1, span: 6 },
  { row: 4, col: 7, span: 2 },
  { row: 4, col: 9, span: 1 },
  { row: 0, col: 10, span: 1 },
  { row: 1, col: 10, span: 1 },
  { row: 2, col: 10, span: 1 },
  { row: 3, col: 10, span: 1 },
  { row: 4, col: 10, span: 1 },
]
const LANG_FN: FnKey[] = ['settings', 'space', 'done', 'left', 'backspace', 'symb', 'lang', 'shift', 'right']
const SYMB_FN: FnKey[] = ['settings', 'space', 'done', 'left', 'backspace', 'abc', 'symb_lang', 'symbpage', 'right']

export type Layout = { name: 'qwerty' | 'symb'; cells: Cell[] }

export const QWERTY: Layout = {
  name: 'qwerty',
  cells: [
    ...CHAR_ROWS.flatMap((r, row) =>
      r.map((c, col): Cell => ({ row, col, span: 1, char: [c, c.toUpperCase()], upper: row > 0 && /[a-z]/.test(c) })),
    ),
    ...FN_CELLS.map((c, i) => ({ ...c, fn: LANG_FN[i] })),
  ],
}

export const SYMB: Layout = {
  name: 'symb',
  cells: [
    ...SYMB_ROWS.flatMap((r, row) => r.map(([a, b], col): Cell => ({ row, col, span: 1, char: [a, b] }))),
    ...FN_CELLS.map((c, i) => ({ ...c, fn: SYMB_FN[i] })),
  ],
}

export const DEFAULT_FOCUS = 10 // "default_focus_index":10

// 4x10_4_5 next_index: plain grid moves, Left/Right wrap around the row, Up/Down stop at the edges;
// a wide key is entered from any column it covers (the cell under the previous column on the way back).
export function moveFocus(layout: Layout, from: number, dir: 'Up' | 'Down' | 'Left' | 'Right', column: number): number {
  const cells = layout.cells
  const cur = cells[from]
  const at = (row: number, col: number) => cells.findIndex(c => c.row === row && col >= c.col && col < c.col + c.span)
  if (dir === 'Left' || dir === 'Right') {
    const col = dir === 'Left' ? cur.col - 1 : cur.col + cur.span
    const wrapped = col < 0 ? 10 : col > 10 ? 0 : col
    return at(cur.row, wrapped)
  }
  const row = cur.row + (dir === 'Up' ? -1 : 1)
  if (row < 0 || row > 4) return from
  const i = at(row, column)
  return i < 0 ? from : i
}
