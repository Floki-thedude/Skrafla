Icelandic dictionary (Skrafl-compatible)
----------------------------------------

Place a newline-separated UTF-8 file with allowed Icelandic words here. For fastest startup in the browser, use a normalized uppercase list.

- words_is.txt  (preferred for speed; normalized uppercase, one word per line)
- ordalisti.full.sorted.txt  (fallback; raw full list from Netskrafl, slower to load)
- islensk.txt

Format:
- One word per line
- Words may be lowercase or mixed; the app normalizes to uppercase
- Include Icelandic letters (Á, É, Í, Ó, Ú, Ý, Þ, Æ, Ö, and Ð)

The app will auto-detect these files (in the order above) and use the first one found.

Generate `words_is.txt` from the full list:

  python3 scripts/make_is_dict.py data/ordalisti.full.sorted.txt data/words_is.txt

This produces a deduplicated NFC-normalized, UPPERCASE word list that loads significantly faster in the browser.

Source suggestion (requires manual download):
- https://github.com/mideind/Netskrafl
  Use the same allowed-word list as in Netskrafl. Normalize to one word per line.

Licensing:
- Ensure you comply with the upstream project’s license when redistributing the list.
