import json
from collections import defaultdict

with open(r"data/organized/v1/timeseries.json", encoding="utf-8") as f:
    new = json.load(f)
with open(r"dashboard/public/v1/timeseries.json", encoding="utf-8") as f:
    old = json.load(f)

null_to_value = defaultdict(int)
value_to_null = defaultdict(int)
value_changed  = defaultdict(int)

examples_gained = {}
examples_lost   = {}
examples_changed = {}

all_indicators = set()
for iso in new:
    all_indicators |= set(new[iso].keys())

for iso in sorted(set(new) & set(old)):
    for ind in all_indicators:
        old_arr = old.get(iso, {}).get(ind, [])
        new_arr = new.get(iso, {}).get(ind, [])
        for i, (o, n) in enumerate(zip(old_arr, new_arr)):
            if o is None and n is not None:
                null_to_value[ind] += 1
                if ind not in examples_gained:
                    examples_gained[ind] = (iso, i, o, n)
            elif o is not None and n is None:
                value_to_null[ind] += 1
                if ind not in examples_lost:
                    examples_lost[ind] = (iso, i, o, n)
            elif o is not None and n is not None and abs(o - n) > 0.05:
                value_changed[ind] += 1
                if ind not in examples_changed:
                    examples_changed[ind] = (iso, i, o, n)

print("=== GAINED (null -> value) by indicator ===")
for ind, count in sorted(null_to_value.items(), key=lambda x: -x[1]):
    ex = examples_gained[ind]
    print(f"  {ind}: +{count} cells  | e.g. {ex[0]} yr[{ex[1]}]: None -> {ex[3]:.1f}")

print("\n=== LOST (value -> null) by indicator ===")
for ind, count in sorted(value_to_null.items(), key=lambda x: -x[1]):
    ex = examples_lost[ind]
    print(f"  {ind}: -{count} cells  | e.g. {ex[0]} yr[{ex[1]}]: {ex[2]:.1f} -> None")

print("\n=== VALUE CHANGED (both non-null, diff > 0.05) ===")
for ind, count in sorted(value_changed.items(), key=lambda x: -x[1]):
    ex = examples_changed[ind]
    print(f"  {ind}: {count} cells  | e.g. {ex[0]} yr[{ex[1]}]: {ex[2]:.1f} -> {ex[3]:.1f}")

print(f"\nTotal gained: {sum(null_to_value.values())}")
print(f"Total lost:   {sum(value_to_null.values())}")
print(f"Total changed: {sum(value_changed.values())}")
