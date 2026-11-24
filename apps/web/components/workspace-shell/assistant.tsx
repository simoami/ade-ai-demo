import { ChatDrawer } from '#components/chat/chat-drawer'
import { getDocuments } from '#lib/server/records'

/** Clinical assistant given only document IDs and file names for citations. */
export async function Assistant() {
  return (
    <ChatDrawer
      documents={(await getDocuments()).map(({ id, fileName }) => ({
        id,
        fileName,
      }))}
    />
  )
}
