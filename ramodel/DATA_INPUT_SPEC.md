# RaModel input data contract

The prompt builder in `ramodel_prompt.py` expects one `data` object with these keys:

```json
{
  "ticker": "AAPL",
  "name": "Apple",
  "price": 100.0,
  "change_pct": 1.25,
  "recent_high": 120.0,
  "recent_low": 80.0,
  "ma": {"ma20": 95.0, "ma60": 90.0},
  "ma200w": 70.0,
  "rsi": 55.0,
  "macd": {"signal": "bullish"},
  "volume_avg_20d": 1000000,
  "weekly_candles": [
    {"date": "2026-01-02", "open": 98, "high": 102, "low": 97, "close": 101, "volume": 5000000}
  ],
  "daily_candles_ra": [
    {"date": "2026-01-02", "open": 98, "high": 102, "low": 97, "close": 101, "volume": 1000000}
  ],
  "daily_rsi_ra": [
    {"date": "2026-01-02", "rsi6": 55.1, "rsi24": 50.4}
  ],
  "daily_macd_ra": [
    {"date": "2026-01-02", "dif": 1.2, "dea": 0.8, "macd_bar": 0.8}
  ]
}
```

## History requirements

- `weekly_candles`: chronological oldest-to-newest; ideally the latest 104 complete weekly candles.
- `daily_candles_ra`: chronological oldest-to-newest; the latest 120 daily candles. OHLC values must use one consistent price-adjustment basis. Include volume and exact dates.
- `daily_rsi_ra`: RSI(6), RSI(24), date-aligned one-to-one with daily candles. RSI(6) is the fast line; RSI(24) is the only slow line. Do not use RSI(12). Use the course's daily RSI basis; the original app computes rolling arithmetic mean gains/losses.
- `daily_macd_ra`: EMA MACD(12,26,9), date-aligned one-to-one with daily candles; `DIF=EMA12-EMA26`, `DEA=EMA9(DIF)`, `MACD柱=2*(DIF-DEA)`.
- If a field, date, candle or indicator value is unavailable, pass it as absent/null and require the model to state data insufficiency. Do not synthesize historical prices or indicator values.
- Candle red/green display colors are not needed; infer bullish/bearish direction from `close` versus `open`.

The model's rules often need more history than a short recent snapshot. Keep the supplied series chronological, date-aligned and within the same timeframe for every comparison.
