export default function MessageBubble({ message, isSent }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
      <div className={`message-bubble ${isSent ? 'bubble-sent' : 'bubble-received'} ${message.decryptionFailed ? 'bubble-error' : ''}`}>
        {message.type === 'audio' ? (
          <div className="bubble-audio">
            <audio controls src={message.content} preload="metadata" />
          </div>
        ) : (
          <div className="bubble-text">{message.content || message.text}</div>
        )}
        <div className="bubble-meta">
          <span className="bubble-time">{formatTime(message.createdAt)}</span>
          {!message.decryptionFailed && (
            <i className="fa-solid fa-lock bubble-lock"></i>
          )}
          {isSent && !message.decryptionFailed && (
            <span className="bubble-check-wrapper">
              {message.delivered ? (
                <i className="fa-solid fa-check-double bubble-check"></i>
              ) : (
                <i className="fa-solid fa-check bubble-check"></i>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
