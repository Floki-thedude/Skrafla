#!/usr/bin/env python3
import sys, unicodedata

def main(src, out):
    seen = set()
    keep = []
    with open(src, 'r', encoding='utf-8') as f:
        for line in f:
            w = line.strip()
            if not w:
                continue
            w = unicodedata.normalize('NFC', w).upper()
            if not all(ch.isalpha() for ch in w):
                continue
            if w in seen:
                continue
            seen.add(w)
            keep.append(w)
    with open(out, 'w', encoding='utf-8') as g:
        g.write('\n'.join(keep))

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: make_is_dict.py <src> <out>')
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
