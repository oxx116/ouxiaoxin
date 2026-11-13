import json
import socket
import sys

HOST = "127.0.0.1"
PORT = 11111


def cell(row, key):
    if key not in row:
        return ""
    value = row[key]
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return text


def main():
    ticker = sys.argv[1].strip().upper()
    if not ticker:
        raise SystemExit(json.dumps({"ok": False, "error": "缺少代码"}))
    code = ticker if "." in ticker else f"US.{ticker}"
    try:
        probe = socket.create_connection((HOST, PORT), 2)
        probe.close()
    except OSError as error:
        print(json.dumps({"ok": False, "error": f"连不上 OpenD {HOST}:{PORT}：{error}"}))
        return

    from futu import OpenQuoteContext, RET_OK

    ctx = OpenQuoteContext(host=HOST, port=PORT)
    try:
        ret, data = ctx.get_market_snapshot([code])
    finally:
        ctx.close()
    if ret != RET_OK:
        print(json.dumps({"ok": False, "error": str(data)}))
        return
    row = data.iloc[0]
    print(
        json.dumps(
            {
                "ok": True,
                "code": cell(row, "code"),
                "name": cell(row, "name"),
                "lastPrice": cell(row, "last_price"),
                "prevClose": cell(row, "prev_close_price"),
                "updateTime": cell(row, "update_time"),
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}))
