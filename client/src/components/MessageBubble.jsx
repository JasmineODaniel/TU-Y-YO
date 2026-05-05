export default function MessageBubble({ message, isSent }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
      <div className={`message-bubble ${isSent ? 'bubble-sent' : 'bubble-received'} ${message.decryptionFailed ? 'bubble-error' : ''}`}>
        <div className="bubble-text">{message.text}</div>
        <div className="bubble-meta">
          <span className="bubble-time">{formatTime(message.createdAt)}</span>
          {!message.decryptionFailed && (
            <svg className="bubble-lock" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
          {isSent && !message.decryptionFailed && (
            <svg className="bubble-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {message.delivered ? (
                <>
                  <polyline points="1 12 5 16 9 12" />
                  <polyline points="8 12 12 16 20 6" />
                </>
              ) : (
                <polyline points="5 12 10 17 20 6" />
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
