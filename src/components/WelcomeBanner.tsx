interface Props {
  onDismiss: () => void
}

export default function WelcomeBanner({ onDismiss }: Props) {
  return (
    <div className="welcome-banner">
      <div className="welcome-text">
        👋 <b>Welcome to Joel HQ.</b> Everything you see is placeholder example data — rename or delete it as you
        add your own tasks, projects, debts, and goals. It's yours from here.
      </div>
      <button className="card-link" onClick={onDismiss}>
        Got it ✕
      </button>
    </div>
  )
}