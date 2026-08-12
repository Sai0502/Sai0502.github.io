# 程序功能：从Forex Factory抓取指定周的宏观经济事件数据（只看重要和中等重要）
# 执行方式：(py3.10)  python /Users/jiangsai/Documents/Auto_Trade/nq_weekly_news.py  --week 2026-06-8 
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

from playwright.sync_api import sync_playwright

# 输入要查询的周内任意一天，程序会自动识别所在周并抓取该周的重要事件
fetch_week = "2026-06-10"

WEEKDAY_CN = {
    0: "周一",
    1: "周二",
    2: "周三",
    3: "周四",
    4: "周五",
    5: "周六",
    6: "周日",
}

@dataclass(slots=True)
class Event:
    name: str
    dt_bj: datetime
    source: str = ""
    note: str = ""
    tags: list[str] = field(default_factory=list)
    impact: str = ""
    currency: str = ""


@dataclass(slots=True)
class Holiday:
    name: str
    day: date
    market: str


DEFAULT_KEYWORDS = {
    "CPI": ["cpi"],
    "PPI": ["ppi"],
    "PCE": ["pce", "personal income and outlays"],
    "GDP": ["gdp", "gross domestic product"],
    "NFP": ["employment situation", "nonfarm payroll", "non-farm payroll"],
    "ADP": ["adp"],
    "Manufacturing PMI": [
        "ism manufacturing pmi",
        "manufacturing pmi",
        "manufacturing purchasing managers",
    ],
    "Services PMI": [
        "ism services pmi",
        "services pmi",
        "services purchasing managers",
        "non-manufacturing pmi",
    ],
    "Retail Sales": ["retail sales"],
    "Unemployment Claims": [
        "initial jobless claims",
        "unemployment claims",
        "jobless claims",
        "weekly unemployment insurance claims",
    ],
    "FOMC Meeting Minutes": ["fomc minutes", "minutes of the federal open market committee"],
    "ECB": ["ecb main refinancing rate", "ecb monetary policy", "ecb interest rate decision", "monetary policy statement"],
    "ECB Press Conference": ["ecb press conference"],
    "UoM Consumer Sentiment": ["consumer sentiment", "university of michigan consumer sentiment"],
    "Retail Sales": ["retail sales", "retail sales m/m", "retail sales y/y"],
    "Empire State Manufacturing": ["empire state manufacturing"],
    "Building Permits": ["building permits"],
    "Housing Starts": ["housing starts"],
    "Import Prices": ["import prices"],
    "Industrial Production": ["industrial production"],
    "NAHB Housing Market Index": ["nahb housing market index"],
    "Flash Manufacturing PMI": ["flash manufacturing pmi"],
    "Flash Services PMI": ["flash services pmi"],
    "Core PCE Price Index": ["core pce price index"],
    "Final GDP": ["final gdp q/q", "final gdp"],
    "GDP Price Index": ["gdp price index"],
    "New Home Sales": ["new home sales"],
    "Consumer Confidence": ["cb consumer confidence", "consumer confidence"],
    "JOLTS Job Openings": ["jolts job openings"],
    "Average Hourly Earnings": ["average hourly earnings"],
    "Unemployment Rate": ["unemployment rate"],
    "Federal Funds Rate": ["federal funds rate"],
    "FOMC Economic Projections": ["fomc economic projections"],
    "FOMC Statement": ["fomc statement"],
    "FOMC Press Conference": ["fomc press conference"],
    "Philly Fed Manufacturing Index": ["philly fed manufacturing index"],
    "Pending Home Sales": ["pending home sales"],
}

NAME_PRIORITY = {
    "CPI": 10,
    "Unemployment Claims": 15,
    "PPI": 20,
    "PCE": 30,
    "GDP": 40,
    "NFP": 50,
    "ADP": 60,
    "Manufacturing PMI": 70,
    "Services PMI": 80,
    "Retail Sales": 90,
    "FOMC Meeting Minutes": 100,
    "ECB": 110,
    "ECB Press Conference": 120,
    "UoM Consumer Sentiment": 130,
    "Empire State Manufacturing": 140,
    "Building Permits": 150,
    "Housing Starts": 160,
    "Import Prices": 170,
    "Industrial Production": 180,
    "NAHB Housing Market Index": 190,
    "Flash Manufacturing PMI": 200,
    "Flash Services PMI": 210,
    "Core PCE Price Index": 220,
    "Final GDP": 230,
    "GDP Price Index": 240,
    "New Home Sales": 250,
    "Consumer Confidence": 260,
    "JOLTS Job Openings": 270,
    "Average Hourly Earnings": 280,
    "Unemployment Rate": 290,
    "Federal Funds Rate": 300,
    "FOMC Economic Projections": 310,
    "FOMC Statement": 320,
    "FOMC Press Conference": 330,
    "Philly Fed Manufacturing Index": 340,
    "Pending Home Sales": 350,
}

HOLIDAY_MARKET_PRIORITY = {
    "纽约休市": 10,
    "伦敦休市": 20,
}

FF_COUNTRY_TO_MARKET = {
    "USD": "纽约",
    "GBP": "伦敦",
    "EUR": "欧元区",
    "AUD": "澳洲",
}

DEFAULT_CURRENCIES = {"USD"}
DEFAULT_IMPACTS = {"High", "Medium"}

DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEFAULT_FF_PROFILE_DIR = str(Path(__file__).with_name(".pw-ff-profile"))


def monday_of_week(anchor: date) -> date:
    return anchor - timedelta(days=anchor.weekday())


def sunday_of_week(anchor: date) -> date:
    return monday_of_week(anchor) + timedelta(days=6)


def ff_week_slug(anchor: date) -> str:
    month = anchor.strftime("%b").lower()
    return f"{month}{anchor.day}.{anchor.year}"


def parse_dt_bj(value: str) -> datetime:
    text = value.strip()
    if len(text) == 16:
        return datetime.strptime(text, "%Y-%m-%d %H:%M")
    if len(text) == 19:
        return datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
    raise ValueError(f"Unsupported datetime format: {value}")


def load_json_events(path: Path) -> tuple[list[Event], list[Holiday]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    events = [
        Event(
            name=item["name"],
            dt_bj=parse_dt_bj(item["datetime_bj"]),
            source=item.get("source", ""),
            note=item.get("note", ""),
            tags=item.get("tags", []),
            impact=item.get("impact", ""),
            currency=item.get("currency", ""),
        )
        for item in payload.get("events", [])
    ]
    holidays = [
        Holiday(
            name=item["name"],
            day=datetime.strptime(item["date"], "%Y-%m-%d").date(),
            market=item["market"],
        )
        for item in payload.get("holidays", [])
    ]
    return events, holidays


def fetch_ff_week_events(
    anchor: date,
    chrome_path: str = DEFAULT_CHROME_PATH,
    profile_dir: str = DEFAULT_FF_PROFILE_DIR,
    currencies: set[str] | None = None,
    impacts: set[str] | None = None,
) -> tuple[list[Event], list[Holiday]]:
    currencies = currencies or set(DEFAULT_CURRENCIES)
    impacts = impacts or set(DEFAULT_IMPACTS)
    slug = ff_week_slug(monday_of_week(anchor))
    url = f"https://www.forexfactory.com/calendar?week={slug}"

    rows: list[dict[str, str]] = []
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=False,
            executable_path=chrome_path,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)
        rows = page.evaluate(
            r"""async () => {
              const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
              const collected = new Map();

              const snapshot = () => {
                const trs = Array.from(document.querySelectorAll('tr.calendar__row'));
                trs.forEach((tr, idx) => {
                  const txt = (tr.innerText || '').split("\n").map(s => s.trim()).filter(Boolean).join(" | ");
                  const dateText = tr.querySelector('td.calendar__date .date')?.innerText?.replace(/\s+/g, ' ').trim() || '';
                  const timeText = tr.querySelector('td.calendar__time span')?.innerText?.trim() || '';
                  const currency = tr.querySelector('td.calendar__currency span')?.innerText?.trim() || '';
                  const impactTitle = tr.querySelector('td.calendar__impact span[title]')?.getAttribute('title') || '';
                  const eventTitle = tr.querySelector('.calendar__event-title')?.innerText?.trim() || '';

                  if (!txt) return;

                  const prev = collected.get(idx);
                  const currentScore =
                    (dateText ? 1 : 0) +
                    (timeText ? 1 : 0) +
                    (currency ? 1 : 0) +
                    (impactTitle ? 1 : 0) +
                    (eventTitle ? 1 : 0) +
                    txt.length / 1000;
                  const prevScore = prev
                    ? ((prev.dateText ? 1 : 0) +
                      (prev.timeText ? 1 : 0) +
                      (prev.currency ? 1 : 0) +
                      (prev.impactTitle ? 1 : 0) +
                      (prev.eventTitle ? 1 : 0) +
                      prev.txt.length / 1000)
                    : -1;

                  if (!prev || currentScore >= prevScore) {
                    collected.set(idx, { idx, txt, dateText, timeText, currency, impactTitle, eventTitle });
                  }
                });
              };

              let lastScrollY = -1;
              let stableCount = 0;
              for (let i = 0; i < 40; i++) {
                snapshot();
                window.scrollBy(0, Math.max(window.innerHeight * 0.8, 600));
                await sleep(450);
                snapshot();
                if (window.scrollY === lastScrollY) {
                  stableCount += 1;
                  if (stableCount >= 3) break;
                } else {
                  stableCount = 0;
                  lastScrollY = window.scrollY;
                }
              }

              window.scrollTo(0, 0);
              await sleep(250);
              snapshot();

              return Array.from(collected.values()).sort((a, b) => a.idx - b.idx);
            }"""
        )
        body_text = page.locator("body").inner_text(timeout=10000)
        row_count = page.locator("tr.calendar__row").count()
        blocked_markers = ("安全验证", "Cloudflare", "验证您不是自动程序", "Please Wait")
        if row_count == 0 or any(marker in body_text for marker in blocked_markers):
            context.close()
            raise RuntimeError(
                "Forex Factory 返回了安全验证页，不是真正的周历数据。"
                f" 当前周参数: {slug}。"
                " 请在弹出的浏览器窗口里先完成一次验证，然后重新运行。"
                f" 验证会保存在 {profile_dir}。"
            )
        context.close()

    events: list[Event] = []
    holidays: list[Holiday] = []
    current_day: date | None = None
    current_time = ""
    current_currency = ""

    for row in rows:
        if row.get("dateText"):
            current_day = datetime.strptime(row["dateText"], "%a %b %d").replace(year=anchor.year).date()

        if current_day is None or current_day.weekday() > 4:
            continue

        if row.get("timeText"):
            current_time = row["timeText"]
        if row.get("currency"):
            current_currency = row["currency"]
        raw_title = row.get("eventTitle", "")
        impact = ff_impact_title_to_level(row.get("impactTitle", ""))

        if not raw_title:
            continue

        if raw_title == "Bank Holiday":
            if current_currency not in {"USD", "GBP"}:
                continue
            market = FF_COUNTRY_TO_MARKET.get(current_currency, current_currency or "未知市场")
            holidays.append(Holiday(name="休市", day=current_day, market=f"{market}休市"))
            continue

        if current_currency not in currencies:
            continue

        if impact not in impacts:
            continue

        if current_time in {"Tentative", "All Day"} or not current_time:
            continue

        dt_bj = combine_ff_time(current_day, current_time)
        name = clean_ff_event_name(raw_title)
        note = infer_note(raw_title, impact)
        events.append(
            Event(
                name=name,
                dt_bj=dt_bj,
                source="forexfactory",
                note=note,
                tags=[current_currency, impact],
                impact=impact,
                currency=current_currency,
            )
        )

    return events, holidays


def is_time_token(value: str) -> bool:
    lower = value.lower()
    return lower in {"tentative", "all day"} or lower.endswith("am") or lower.endswith("pm")


def is_country_token(value: str) -> bool:
    return len(value) == 3 and value.isalpha() and value.upper() == value


def ff_impact_title_to_level(value: str) -> str:
    mapping = {
        "High Impact Expected": "High",
        "Med Impact Expected": "Medium",
        "Medium Impact Expected": "Medium",
        "Low Impact Expected": "Low",
        "Non-Economic": "Holiday",
    }
    return mapping.get(value.strip(), value.strip())


def combine_ff_time(day: date, ff_time: str) -> datetime:
    return datetime.strptime(f"{day:%Y-%m-%d} {ff_time.lower()}", "%Y-%m-%d %I:%M%p")


def clean_ff_event_name(name: str) -> str:
    cleaned = " ".join(name.split()).strip()
    replacements = {
        "Flash Manufacturing PMI": "Manufacturing PMI",
        "Flash Services PMI": "Services PMI",
        "Revised UoM Consumer Sentiment": "UoM Consumer Sentiment",
        "Core PCE Price Index m/m": "Core PCE Price Index m/m",
        "Final GDP q/q": "Final GDP q/q",
        "Final GDP Price Index q/q": "Final GDP Price Index q/q",
        "ADP Non-Farm Employment Change": "ADP Non-Farm Employment Change",
        "Average Hourly Earnings m/m": "Average Hourly Earnings m/m",
        "Non-Farm Employment Change": "Non-Farm Employment Change",
        "Unemployment Rate": "Unemployment Rate",
        "CB Consumer Confidence": "CB Consumer Confidence",
        "JOLTS Job Openings": "JOLTS Job Openings",
        "Core Retail Sales m/m": "Core Retail Sales m/m",
        "Retail Sales m/m": "Retail Sales m/m",
        "Pending Home Sales m/m": "Pending Home Sales m/m",
        "Philly Fed Manufacturing Index": "Philly Fed Manufacturing Index",
        "Federal Funds Rate": "Federal Funds Rate",
        "FOMC Economic Projections": "FOMC Economic Projections",
        "FOMC Statement": "FOMC Statement",
        "FOMC Press Conference": "FOMC Press Conference",
        "New Home Sales": "New Home Sales",
        "ISM Manufacturing PMI": "ISM Manufacturing PMI",
        "ISM Manufacturing Prices": "ISM Manufacturing Prices",
    }
    return replacements.get(cleaned, cleaned)


def normalize_name(name: str) -> str | None:
    lower = name.lower().strip()
    for label, keywords in DEFAULT_KEYWORDS.items():
        if any(keyword in lower for keyword in keywords):
            return label

    interesting_fragments = [
        "federal funds rate",
        "press conference",
        "inflation",
        "employment",
        "payroll",
        "claims",
        "retail sales",
        "consumer sentiment",
        "manufacturing pmi",
        "services pmi",
        "gdp",
        "pce",
        "cpi",
        "ppi",
        "adp",
        "ecb",
        "fomc minutes",
    ]
    if any(fragment in lower for fragment in interesting_fragments):
        return name.strip()

    return None


def infer_note(raw_title: str, impact: str) -> str:
    lower = raw_title.lower()
    if "unemployment claims" in lower or "jobless claims" in lower:
        return "fx orange folder"
    if any(keyword in lower for keyword in ["cpi", "ppi", "services pmi", "ecb press conference"]):
        return "金十三星" if impact in {"High", "Medium"} else ""
    return ""


def display_width(text: str) -> int:
    width = 0
    for char in text:
        width += 2 if unicodedata.east_asian_width(char) in {"W", "F"} else 1
    return width


def event_priority(name: str) -> int:
    return NAME_PRIORITY.get(name, 999)


def filter_events(events: Iterable[Event], start: date, end: date) -> list[Event]:
    keep = [event for event in events if start <= event.dt_bj.date() <= end]
    keep.sort(key=lambda item: (item.dt_bj, event_priority(item.name), item.name))
    return keep


def filter_holidays(holidays: Iterable[Holiday], start: date, end: date) -> list[Holiday]:
    keep = [holiday for holiday in holidays if start <= holiday.day <= end]
    keep.sort(key=lambda item: (item.day, HOLIDAY_MARKET_PRIORITY.get(item.market, 999), item.market, item.name))
    return keep


def group_by_day(events: Iterable[Event]) -> dict[date, list[Event]]:
    grouped: dict[date, list[Event]] = {}
    for event in events:
        grouped.setdefault(event.dt_bj.date(), []).append(event)
    return grouped


def group_holidays_by_day(holidays: Iterable[Holiday]) -> dict[date, list[Holiday]]:
    grouped: dict[date, list[Holiday]] = {}
    for holiday in holidays:
        grouped.setdefault(holiday.day, []).append(holiday)
    return grouped


def compress_day_events(events: list[Event]) -> list[str]:
    by_time: dict[str, list[Event]] = {}
    for event in events:
        by_time.setdefault(event.dt_bj.strftime("%H:%M"), []).append(event)

    lines: list[str] = []
    for hhmm, bucket in sorted(by_time.items()):
        bucket = sorted(bucket, key=lambda item: (event_priority(item.name), item.name))
        notes = []
        for item in bucket:
            if item.note and item.note not in notes:
                notes.append(item.note)

        indent = " " * (display_width(hhmm) + 1)
        for idx, item in enumerate(bucket):
            label = item.name
            if idx == len(bucket) - 1 and notes:
                label = f"{label} ({'; '.join(notes)})"
            if idx == 0:
                lines.append(f"{hhmm} {label}")
            else:
                lines.append(f"{indent}{label}")
    return lines


def holiday_note(holidays: list[Holiday]) -> str:
    if not holidays:
        return "本周无假期"
    parts = [f"{holiday.market}{holiday.name}" for holiday in holidays]
    return "、".join(parts)


def format_week(anchor: date, events: list[Event], holidays: list[Holiday], week_label: str | None = None) -> str:
    start = monday_of_week(anchor)
    end = sunday_of_week(anchor)
    grouped = group_by_day(events)
    holiday_grouped = group_holidays_by_day(holidays)

    if week_label is None:
        week_label = f"Week {start.isocalendar().week}"

    lines = [f"{start:%Y.%m.%d}-{end:%Y.%m.%d} {week_label}", ""]

    for offset in range(5):
        day = start + timedelta(days=offset)
        prefix = f"{day:%m.%d} {WEEKDAY_CN[day.weekday()]}"
        day_events = grouped.get(day, [])
        day_holidays = holiday_grouped.get(day, [])
        holiday_suffix = ""
        if day_holidays:
            holiday_suffix = "+" + "+".join(f"{item.market}{item.name}" for item in day_holidays)

        if not day_events:
            lines.append(f"{prefix} 无数据{holiday_suffix}")
            lines.append("")
            continue

        rendered = compress_day_events(day_events)
        first, *rest = rendered
        lines.append(f"{prefix} {first}{holiday_suffix}")
        continuation_indent = " " * (display_width(prefix) + 1)
        for extra in rest:
            lines.append(f"{continuation_indent}{extra}")
        lines.append("")

    week_holidays = filter_holidays(holidays, start, end)
    lines.append(f"备注： {holiday_note(week_holidays)}")
    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate weekly NQ-focused macro news summary.")
    parser.add_argument(
        "--week",
        default=fetch_week,
        help=f"Any date in the target week, format YYYY-MM-DD. Default: {fetch_week}",
    )
    parser.add_argument(
        "--input-json",
        default=None,
        help="Optional local JSON dataset with events and holidays. If omitted, fetch from Forex Factory.",
    )
    parser.add_argument(
        "--source",
        choices=["json", "forexfactory"],
        default=None,
        help="Force a source. Default: input-json means json, otherwise forexfactory.",
    )
    parser.add_argument("--week-label", default=None, help="Optional custom week label like 'Week 24'")
    parser.add_argument(
        "--chrome-path",
        default=DEFAULT_CHROME_PATH,
        help="Chrome executable path for Forex Factory browser scraping mode.",
    )
    parser.add_argument(
        "--ff-profile-dir",
        default=DEFAULT_FF_PROFILE_DIR,
        help="Persistent browser profile dir for Forex Factory mode. Used to keep Cloudflare clearance.",
    )
    parser.add_argument(
        "--currencies",
        default="USD",
        help="Comma-separated currencies to keep in Forex Factory mode, e.g. USD or USD,EUR",
    )
    parser.add_argument(
        "--impacts",
        default="High,Medium",
        help="Comma-separated impact levels to keep in Forex Factory mode, e.g. High,Medium",
    )
    parser.add_argument(
        "--include-eur",
        action="store_true",
        help="Also include EUR medium/high events in Forex Factory mode.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    anchor = datetime.strptime(args.week, "%Y-%m-%d").date()
    source = args.source or ("json" if args.input_json else "forexfactory")

    if source == "json":
        if not args.input_json:
            raise SystemExit("--input-json is required when --source json")
        events, holidays = load_json_events(Path(args.input_json))
    else:
        currencies = {part.strip().upper() for part in args.currencies.split(",") if part.strip()}
        if args.include_eur:
            currencies.add("EUR")
        impacts = {part.strip().title() for part in args.impacts.split(",") if part.strip()}
        events, holidays = fetch_ff_week_events(
            anchor,
            chrome_path=args.chrome_path,
            profile_dir=args.ff_profile_dir,
            currencies=currencies,
            impacts=impacts,
        )

    start = monday_of_week(anchor)
    end = sunday_of_week(anchor)
    filtered_events = filter_events(events, start, end)
    filtered_holidays = filter_holidays(holidays, start, end)
    print(format_week(anchor, filtered_events, filtered_holidays, args.week_label))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
