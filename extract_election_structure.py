import openpyxl
import json
import sys

file_path = 'D:/APP/phuonganbanco.xlsx'

try:
    print(f"Attempting to load {file_path}...")
    wb = openpyxl.load_workbook(file_path, data_only=True)
    ws = wb.active
    print(f"Successfully loaded. Sheet name: {ws.title}")
    
    rows = list(ws.rows)
    if not rows:
        print("Sheet is empty")
        sys.exit(0)

    # Print first 20 rows to understand structure
    print("First 20 rows:")
    for i, row in enumerate(rows[:20]):
        # Convert to list and clean None
        vals = [str(cell.value).strip() if cell.value is not None else '' for cell in row]
        print(f"Row {i+1}: {vals}")
        
    # Attempt to extract all data for mapping
    # Assuming columns like Unit, Station, Neighborhood, Location
    all_data = []
    for i, row in enumerate(rows):
        vals = [str(cell.value).strip() if cell.value is not None else '' for cell in row]
        all_data.append(vals)
        
    with open('election_structure_dump.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print("Dumped all data to election_structure_dump.json")

except Exception as e:
    print(f"Error loading file: {e}")
