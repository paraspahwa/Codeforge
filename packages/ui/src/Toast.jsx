export function Toast({ message, type = "error", onDismiss }) {
  return (
    <button type="button" className={`cf-toast cf-toast-${type}`} onClick={onDismiss}>
      {message}
    </button>
  );
}

export function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="cf-toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}
