import { useEditorProps } from '../context/EditorPropsContext'

export function useUploadImage() {
  return useEditorProps().uploadImage
}
