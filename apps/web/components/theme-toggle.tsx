'use client'

import { Button } from '@repo/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

/** Switches between light and dark from the resolved system or saved theme. */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground"
            onClick={() =>
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
            }
          />
        }
      >
        <Sun className="size-4 rotate-90 scale-0 transition-transform duration-500 ease-in-out dark:rotate-0 dark:scale-100" />
        <Moon className="absolute size-4 rotate-0 scale-100 transition-transform duration-500 ease-in-out dark:-rotate-90 dark:scale-0" />
        <span className="sr-only">Toggle theme</span>
      </TooltipTrigger>
      <TooltipContent side="left">Switch theme</TooltipContent>
    </Tooltip>
  )
}
