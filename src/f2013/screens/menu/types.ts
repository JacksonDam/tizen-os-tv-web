// A Menu tree entry as CMenuTreeManager builds it (see tools/gen_ts.py / spec/menu.md).
export type MenuItem = {
  id: number               // menu item id (CMenuItem +4); AP menu items use their AP/app ids
  t: string                // title (CMenuTextIdFinder text id -> g_MenuWStringEng)
  h?: string               // help text (CMenuTextIdFinder help id)
  r?: number               // CMenuListRendererFinder renderer type
  ok?: string              // what OK does (CMenuMainWindow::t_MenuItemController, emulated per id)
  o?: [number, string][]   // sublist options [data, text] (SetSublistItems)
  v?: [number, number, number] // value item [min, max, step] (CMenuValueDataItem)
  k?: MenuItem[]           // children (GetSubItems)
  en?: boolean             // false = dimmed (EnableMenuItemFlag)
  dis?: string             // the item's own "not available" text
  src?: string             // where an AP item's text comes from
}
