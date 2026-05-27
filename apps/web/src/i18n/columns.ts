// Mirrors PROJECTUS-SERVER/core/src/domain.rs:default_columns() titulo values.
// Keep in sync manually — list is short and stable.
export const DEFAULT_COLUMN_TITLES = Object.freeze([
  'PLANEJADO',
  'FAZENDO',
  'FINALIZANDO',
  'PRONTO',
  'CONCLUÍDO',
] as const)

export type DefaultColumnTitle = (typeof DEFAULT_COLUMN_TITLES)[number]

export function isDefaultColumnTitle(value: string): value is DefaultColumnTitle {
  return (DEFAULT_COLUMN_TITLES as readonly string[]).includes(value)
}
