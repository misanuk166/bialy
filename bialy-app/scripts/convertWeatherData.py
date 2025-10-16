#!/usr/bin/env python3
import csv
import sys

input_file = sys.argv[1]
output_file = sys.argv[2]

with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
    reader = csv.DictReader(infile)
    writer = csv.writer(outfile)

    # Write header
    writer.writerow(['date', 'numerator', 'denominator'])

    # Process each row
    for row in reader:
        date = row['DATE']
        tmax = row['TMAX']

        # Only include rows where TMAX has a value
        if tmax and tmax.strip():
            writer.writerow([date, tmax, '1'])

print(f"Conversion complete! Saved to {output_file}")
