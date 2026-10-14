// The panel that slides up from the bottom of a phone, rounded at the top.
// Shared by the bottom sheet and the dialogs, which take this shape on a phone.
export const bottomSheetClass =
  'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-300 data-[state=open]:duration-500 fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 rounded-t-3xl shadow-lg transition ease-in-out pb-[calc(1rem+env(safe-area-inset-bottom))]'

// Its close button: a round grey button in the top right corner
export const bottomSheetCloseClass =
  'bg-muted text-foreground focus-visible:ring-ring/50 absolute top-4 right-4 flex size-9 items-center justify-center rounded-full outline-none transition-colors hover:bg-muted/80 focus-visible:ring-3 disabled:pointer-events-none [&_svg]:size-4'
