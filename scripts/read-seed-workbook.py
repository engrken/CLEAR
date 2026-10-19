#!/usr/bin/env python3
"""Read only named sheets from a trusted legacy seed workbook.

Performs no database operations. Outputs row dictionaries with the subset
of SheetJS sheet_to_json semantics needed by seed-excel.js.
Install locally: py -m pip install "openpyxl>=3.1.5,<4"
"""
import json
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

try:
    from openpyxl import load_workbook
    from openpyxl.utils.datetime import to_excel
except ImportError:
    sys.stderr.write('Missing openpyxl: py -m pip install "openpyxl>=3.1.5,<4"\n')
    sys.exit(2)

ALLOWED_SHEETS = {
    'Students', 'Users', 'Funds', 'Collections', 'Penalties',
    'CashAdvances', 'Audits', 'Enrollments', 'ExpenseItems',
    'Collectibles', 'SystemLogs', 'OnlineRemittances',
}

def normalize(value, epoch):
    if isinstance(value, (datetime, date, time, timedelta)):
        return to_excel(value, epoch=epoch)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)

def main():
    if len(sys.argv) != 2:
        raise ValueError('Expected exactly one workbook path')
    workbook_path = Path(sys.argv[1])
    if not workbook_path.is_file():
        raise FileNotFoundError('Workbook not found: ' + str(workbook_path))
    if workbook_path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError('Legacy workbook exceeds the 20 MB safety limit')

    workbook = load_workbook(workbook_path, read_only=True, data_only=True)
    result = {}
    for name in workbook.sheetnames:
        if name not in ALLOWED_SHEETS:
            continue
        sheet = workbook[name]
        rows_iter = iter(sheet.values)
        headers = next(rows_iter, None)
        if not headers:
            result[name] = []
            continue
        rows = []
        for values in rows_iter:
            row = {}
            for key, val in zip(headers, values):
                if key is not None and val is not None:
                    row[str(key)] = normalize(val, workbook.epoch)
            if row:
                rows.append(row)
            if len(rows) > 100_000:
                raise ValueError(name + ': exceeds 100,000 rows')
        result[name] = rows
    workbook.close()
    json.dump(result, sys.stdout, ensure_ascii=False, allow_nan=False)

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        sys.stderr.write('Failed to read trusted legacy workbook: ' + str(exc) + '\n')
        sys.exit(1)
