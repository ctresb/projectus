import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { ListPlugin as LexicalListPlugin } from '@lexical/react/LexicalListPlugin'

export function ListPlugin() {
  return (
    <>
      <LexicalListPlugin />
      <CheckListPlugin />
    </>
  )
}
