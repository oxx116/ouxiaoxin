export function TickerLogo({ ticker }: { ticker: string }) {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return null;
  return (
    <img
      src={`https://assets.parqet.com/logos/symbol/${symbol}`}
      alt=""
      width={32}
      height={32}
      className="ticker-mark h-8 w-8 shrink-0 rounded-lg object-contain"
      onError={(event) => event.currentTarget.remove()}
    />
  );
}
