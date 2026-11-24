'use client'

import { Button } from '@repo/ui/components/button'
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@repo/ui/components/drawer'
import { MessageSquare } from 'lucide-react'
import { useParams, usePathname } from 'next/navigation'
import {
  type DocumentRef,
  pageContext,
  pageScopeLabel,
} from '#lib/page-context'
import { ChatDrawerHeader } from './chat-drawer/chat-drawer-header.tsx'
import { Conversation } from './chat-drawer/conversation.tsx'

/** Ephemeral, page-scoped clinical assistant mounted beside the theme toggle. */
export function ChatDrawer({ documents }: { documents: DocumentRef[] }) {
  const pathname = usePathname()
  const { id } = useParams<{ id?: string }>()
  const context = pageContext(pathname, id)

  return (
    <Drawer swipeDirection="right" modal={false} disablePointerDismissal>
      <DrawerTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open clinical assistant"
          />
        }
      >
        <MessageSquare className="size-4" />
      </DrawerTrigger>
      <DrawerContent
        keepMounted
        className="rounded-none border-s shadow-xl [--drawer-inset:0px] data-[swipe-axis=x]:w-full data-[swipe-axis=x]:sm:w-md"
      >
        <ChatDrawerHeader scopeLabel={pageScopeLabel(context, documents)} />
        <Conversation key={pathname} context={context} documents={documents} />
      </DrawerContent>
    </Drawer>
  )
}
