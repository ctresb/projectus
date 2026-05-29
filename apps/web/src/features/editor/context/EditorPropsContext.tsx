import { createContext, useContext, type ReactNode } from 'react'
import type { MarkdownEditorProps } from '../types'

type EditorPropsContextValue = Pick<
  MarkdownEditorProps,
  'uploadImage' | 'searchEntries' | 'searchMentions' | 'onWikilinkClick'
>

const EditorPropsContext = createContext<EditorPropsContextValue>({})

export function EditorPropsProvider({ children, value }: { children: ReactNode; value: EditorPropsContextValue }) {
  return <EditorPropsContext.Provider value={value}>{children}</EditorPropsContext.Provider>
}

export function useEditorProps() {
  return useContext(EditorPropsContext)
}
