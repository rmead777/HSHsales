import { useEffect, useRef, useState } from 'react'
import { Button, type ButtonProps } from './Button'

type Props = Omit<ButtonProps, 'onClick'> & {
  onConfirm: () => void
  confirmLabel?: string
}

/** Destructive action that arms on first tap and fires on the second — no native dialog. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Tap again to confirm',
  variant = 'danger',
  ...props
}: Props) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <Button
      {...props}
      variant={armed ? 'danger' : variant}
      onClick={() => {
        if (armed) {
          window.clearTimeout(timer.current)
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
          timer.current = window.setTimeout(() => setArmed(false), 3000)
        }
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}
