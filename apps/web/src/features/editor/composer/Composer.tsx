import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { forwardRef, useMemo, useRef } from 'react'
import { useT } from '../../../i18n'
import { EditorPropsProvider } from '../context/EditorPropsContext'
import { createEditorConfig } from '../editorConfig'
import { useEditorBreakpoint } from '../hooks/useEditorBreakpoint'
import { AutoFocusPlugin } from '../plugins/AutoFocusPlugin'
import { ClickBelowContentPlugin } from '../plugins/ClickBelowContentPlugin'
import { DocumentSwitchPlugin } from '../plugins/DocumentSwitchPlugin'
import { DragHandlePlugin } from '../plugins/DragHandlePlugin'
import { EmptyStatePlugin } from '../plugins/EmptyStatePlugin'
import { FloatingToolbarPlugin } from '../plugins/FloatingToolbarPlugin'
import { HistoryPlugin } from '../plugins/HistoryPlugin'
import { HorizontalRulePlugin } from '../plugins/HorizontalRulePlugin'
import { ImageUploadPlugin } from '../plugins/ImageUploadPlugin'
import { LinkPlugin } from '../plugins/LinkPlugin'
import { ListPlugin } from '../plugins/ListPlugin'
import { MarkdownInitPlugin } from '../plugins/MarkdownInitPlugin'
import { MarkdownShortcutPlugin } from '../plugins/MarkdownShortcutPlugin'
import { MentionPlugin } from '../plugins/MentionPlugin'
import { OnChangeMarkdownPlugin } from '../plugins/OnChangeMarkdownPlugin'
import { PastePlugin } from '../plugins/PastePlugin'
import { ResponsivePlugin } from '../plugins/ResponsivePlugin'
import { SlashMenuPlugin } from '../plugins/SlashMenuPlugin'
import { TablePlugin } from '../plugins/TablePlugin'
import { WikilinkPlugin } from '../plugins/WikilinkPlugin'
import { editorStyles } from '../theme'
import { Toolbar } from '../toolbar/Toolbar'
import type { MarkdownEditorHandle, MarkdownEditorProps } from '../types'
import { ImperativeHandleBridge } from './ImperativeHandleBridge'
import '../styles/editor.global.css'

export const Composer = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function Composer(
  { documentKey, markdown, onChange, onWikilinkClick, searchEntries, searchMentions, uploadImage },
  ref,
) {
  const t = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const lastEmittedMarkdown = useRef(markdown)
  const config = useMemo(() => createEditorConfig(), [])
  const breakpoint = useEditorBreakpoint(rootRef)

  return (
    <EditorPropsProvider value={{ onWikilinkClick, searchEntries, searchMentions, uploadImage }}>
      <div ref={rootRef} className={`projectus-editor ${editorStyles.root}`} data-breakpoint={breakpoint}>
        <LexicalComposer initialConfig={config}>
          <ImperativeHandleBridge ref={ref} />
          <Toolbar breakpoint={breakpoint} />
          <div ref={scrollerRef} className={editorStyles.scroller}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={editorStyles.contentEditable}
                  aria-placeholder={t('markdown.placeholder')}
                  placeholder={<div className={editorStyles.placeholder}>{t('markdown.placeholder')}</div>}
                  spellCheck
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TablePlugin />
          <HorizontalRulePlugin />
          <MarkdownInitPlugin markdown={markdown} />
          <DocumentSwitchPlugin
            documentKey={documentKey}
            markdown={markdown}
            lastEmittedMarkdown={lastEmittedMarkdown}
            scrollerRef={scrollerRef}
          />
          <OnChangeMarkdownPlugin lastEmittedMarkdown={lastEmittedMarkdown} onChange={onChange} />
          <AutoFocusPlugin />
          <MarkdownShortcutPlugin />
          <PastePlugin />
          <ImageUploadPlugin />
          <ClickBelowContentPlugin wrapperRef={rootRef} />
          <FloatingToolbarPlugin />
          <SlashMenuPlugin />
          <DragHandlePlugin anchorRef={scrollerRef} breakpoint={breakpoint} />
          <WikilinkPlugin />
          <MentionPlugin />
          <ResponsivePlugin rootRef={rootRef} />
          <EmptyStatePlugin />
        </LexicalComposer>
      </div>
    </EditorPropsProvider>
  )
})
