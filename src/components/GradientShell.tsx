export function GradientShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`afterparty-gradient min-h-full ${className}`}>
      {children}
    </div>
  )
}
