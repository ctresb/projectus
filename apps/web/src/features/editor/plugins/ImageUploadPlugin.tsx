import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $insertNodes, COMMAND_PRIORITY_HIGH, DROP_COMMAND, PASTE_COMMAND } from 'lexical'
import { useEffect } from 'react'
import { useEditorProps } from '../context/EditorPropsContext'
import { $createImageNode } from '../nodes/ImageNode'

function imageFiles(files: FileList | null | undefined): File[] {
  if (!files) return []
  return Array.from(files).filter((file) => file.type.startsWith('image/'))
}

export function ImageUploadPlugin() {
  const [editor] = useLexicalComposerContext()
  const { uploadImage } = useEditorProps()

  useEffect(() => {
    if (!uploadImage) return

    const insertFiles = (files: File[]) => {
      if (files.length === 0) return false
      void Promise.all(
        files.map(async (file) => {
          const src = await uploadImage(file)
          editor.update(() => {
            $insertNodes([$createImageNode({ altText: file.name, src })])
          })
        }),
      )
      return true
    }

    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false
        const files = imageFiles(event.clipboardData?.files)
        if (files.length === 0) return false
        event.preventDefault()
        return insertFiles(files)
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor, uploadImage])

  useEffect(() => {
    if (!uploadImage) return

    return editor.registerCommand(
      DROP_COMMAND,
      (event) => {
        const files = imageFiles(event.dataTransfer?.files)
        if (files.length === 0) return false
        event.preventDefault()
        void Promise.all(
          files.map(async (file) => {
            const src = await uploadImage(file)
            editor.update(() => {
              $insertNodes([$createImageNode({ altText: file.name, src })])
            })
          }),
        )
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [editor, uploadImage])

  return null
}
