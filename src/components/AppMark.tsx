type AppMarkProps = {
  size?: 'small' | 'large';
  showName?: boolean;
};

export function AppMark({ size = 'small', showName = true }: AppMarkProps) {
  return (
    <span className={`app-mark app-mark-${size}`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <path d="M25 43C22 30 25 17 37 6c4 11 0 24-12 37Z" />
        <path className="mark-soft" d="M24 43C11 39 5 29 7 16c10 3 17 12 17 27Z" />
        <circle className="mark-cherry" cx="39" cy="10" r="4" />
      </svg>
      {showName ? <strong>Calorie</strong> : null}
    </span>
  );
}
