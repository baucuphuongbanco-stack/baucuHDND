import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

try:
    with open('analysis_result_final.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Total Failed (Force Addable): {data['failed_count']}")
    print(f"Valid Rows: {data['valid_count']}")
    
    print("\n--- DETAILED FAILED ROWS ---")
    for r in data['failed_rows']:
        # Show specific content to distinguish Junk vs Real
        print(f"Row {r['row']}: {r['reason']}")
        print(f"  Snippet: {r['content'][:50]}...")

except Exception as e:
    print(f"Error: {e}")
