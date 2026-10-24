import { FiStar } from 'react-icons/fi'
import { alertBody, alertTitle, type AlertMessage } from '../hooks/useAssistantAlerts'
import './home.css'

interface Props {
  message: AlertMessage | null
  onOpen: () => void
  onDismiss: () => void
}

/** A card that slides in from the top when the assistant says something while HQ is open. */
export default function AssistantBanner({ message, onOpen, onDismiss }: Props) {
  if (!message) return null
  const body = alertBody(message)
  return (
    <div className="ab-wrap" role="status" aria-live="polite">
      <button
        className="ab-card"
        onClick={() => {
          onDismiss()
          onOpen()
        }}
      >
        <span className="ab-icon" aria-hidden="true">
          <FiStar />
        </span>
        <span className="ab-text">
          <span className="ab-title">{alertTitle(message)}</span>
          {body && <span className="ab-body">{body}</span>}
        </span>
      </button>
      <button className="ab-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
