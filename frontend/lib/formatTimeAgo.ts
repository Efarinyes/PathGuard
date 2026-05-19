interface TimeAgoOptions {
  justNowThreshold?: number;
  secondsThreshold?: number;
}

export function formatTimeAgo(dateString: string, options: TimeAgoOptions = {}): string {
  const { justNowThreshold = 15, secondsThreshold = 60 } = options;
  const now = Date.now();
  const diff = now - new Date(dateString).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < justNowThreshold) return 'Ara mateix';
  if (seconds < secondsThreshold) return `fa ${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `fa ${minutes}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `fa ${hours}h`;

  const days = Math.floor(hours / 24);
  return `fa ${days}d`;
}

export function formatDate(date: Date | string, locale: string = 'ca-ES'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(date: Date | string | null | undefined, locale: string = 'ca-ES'): string {
  if (!date) return '--:--';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}min ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}