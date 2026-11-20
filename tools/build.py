#!/usr/bin/env python3
"""Baut data/cards.json aus data/src/*.txt.

Quellformat pro Karte:
  === id
  cat: geschichte|geografie|natur|kunst|politik
  title: …
  teaser: …
  meta: …
  cover: <de-Wikipedia-Artikel> | <Bildunterschrift>     (oder file:<Commons-Datei> | …)
  ## Zwischenüberschrift
  Absatztext (HTML erlaubt)
  img: <de-Wikipedia-Artikel> | <Bildunterschrift>
  - Zusammenfassungspunkt

Bilder: Das Hauptbild (og:image) des Wikipedia-Artikels wird ermittelt und in
tools/image-cache.json gespeichert. Nur Commons-Dateien werden verwendet.
Aufruf: python3 tools/build.py [--fetch [--retry-empty]]
"""
import json, re, sys, time, glob, os, urllib.parse, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', 'image-cache.json')
UA = 'GoKnowledgeApp/1.0 (https://github.com/pktsdh58w9-rgb/allgemeinwissen_app)'
CATS = {'geschichte', 'geografie', 'natur', 'kunst', 'politik'}

def parse(path):
    cards = []
    text = open(path, encoding='utf-8').read()
    for block in re.split(r'^=== ', text, flags=re.M)[1:]:
        lines = block.strip('\n').split('\n')
        c = {'id': lines[0].strip(), 'sections': [], 'summary': []}
        sec = None
        for ln in lines[1:]:
            s = ln.strip()
            if not s:
                continue
            m = re.match(r'^(cat|title|teaser|meta|cover):\s*(.*)$', s)
            if m and sec is None:
                k, v = m.groups()
                if k == 'cover':
                    w, _, cap = v.partition('|')
                    c['cover'] = {'wiki': w.strip(), 'caption': cap.strip()}
                else:
                    c[k] = v
            elif s.startswith('## '):
                sec = {'h': s[3:].strip(), 'p': ''}
                c['sections'].append(sec)
            elif s.startswith('img:'):
                w, _, cap = s[4:].partition('|')
                sec['img'] = {'wiki': w.strip(), 'caption': cap.strip()}
            elif s.startswith('- '):
                c['summary'].append(s[2:].strip())
            else:
                sec['p'] = (sec['p'] + ' ' + s).strip()
        assert c.get('cat') in CATS, (path, c['id'], c.get('cat'))
        for k in ('title', 'teaser', 'cover'):
            assert k in c, (path, c['id'], k)
        cards.append(c)
    return cards

def og_image(title):
    url = 'https://de.wikipedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_'))
    for attempt in range(4):
        r = subprocess.run(['curl', '-s', '-L', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True, text=True)
        body, _, code = r.stdout.rpartition('\n')
        if code == '429':
            time.sleep(15 * (attempt + 1)); continue
        if code == '404' and '/wiki/' in url:
            # Fallback: Wikipedia-Suche, die bei eindeutigem Treffer direkt zum Artikel weiterleitet
            url = 'https://de.wikipedia.org/w/index.php?go=Artikel&search=' + urllib.parse.quote(title)
            continue
        if code != '200':
            return None
        m = re.search(r'<meta property="og:image" content="([^"]+)"', body)
        if not m:
            # Fallback: erstes ausreichend großes Commons-Bild im Artikeltext
            skip = re.compile(r'(?i)(flag|flagge|icon|logo|wappen|coat_of_arms|symbol|disambig|question|wiktionary|commons-|edit-|ambox|portal|karte_|locator|pictogram|signature|unterschrift)')
            for im in re.finditer(r'<img [^>]*?src="//(?:upload|thumb)\.wikimedia\.org/wikipedia/commons/thumb/[0-9a-f]/[0-9a-f]{2}/([^/"]+)/[^"]*"[^>]*?width="(\d+)"', body):
                name, w = urllib.parse.unquote(im.group(1)), int(im.group(2))
                if w >= 180 and not skip.search(name):
                    return name.replace('_', ' ')
            return ''
        u = m.group(1).split('?')[0]
        m2 = re.match(r'https://(?:upload|thumb)\.wikimedia\.org/wikipedia/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)', u)
        return urllib.parse.unquote(m2.group(1)).replace('_', ' ') if m2 else ''
    return None

def main():
    fetch = '--fetch' in sys.argv
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    cards = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'src', '*.txt'))):
        cards += parse(p)
    ids = [c['id'] for c in cards]
    dup = {i for i in ids if ids.count(i) > 1}
    assert not dup, dup
    if fetch:
        titles = []
        for c in cards:
            titles.append(c['cover']['wiki'])
            titles += [s['img']['wiki'] for s in c['sections'] if 'img' in s]
        retry = '--retry-empty' in sys.argv
        todo = [t for t in dict.fromkeys(titles) if not t.startswith('file:') and (cache.get(t) is None or (retry and cache.get(t) == ''))]
        print(f'{len(todo)} Bilder zu ermitteln', flush=True)
        for i, t in enumerate(todo):
            cache[t] = og_image(t)
            print(i + 1, t, '->', cache[t], flush=True)
            if (i + 1) % 20 == 0:
                json.dump(cache, open(CACHE, 'w'), ensure_ascii=False, indent=0)
            time.sleep(2.0)
        json.dump(cache, open(CACHE, 'w'), ensure_ascii=False, indent=0)

    gpath = os.path.join(ROOT, 'tools', 'image-generic.json')
    generic = set(json.load(open(gpath))) if os.path.exists(gpath) else set()

    def resolve(img):
        w = img['wiki']
        f = w[5:] if w.startswith('file:') else cache.get(w)
        if not f:
            return None
        # Bilder aus dem Artikeltext (nicht das Hauptbild): neutrale Bildunterschrift
        cap = re.sub(r'\s*\(.*\)$', '', w) if w in generic else img['caption']
        return {'file': f, 'caption': cap}

    out, noimg = [], []
    used = set()
    for c in cards:
        cov = resolve(c['cover'])
        secs = []
        for s in c['sections']:
            s2 = {'h': s['h'], 'p': s['p']}
            if 'img' in s:
                r = resolve(s['img'])
                if r and (not cov or r['file'] != cov['file']):
                    s2['img'] = r
            secs.append(s2)
        if not cov:  # Ersatz: erstes Abschnittsbild als Titelbild
            for s2 in secs:
                if 'img' in s2:
                    cov = s2.pop('img'); break
        if not cov:
            noimg.append(c['id'])
        o = {'id': c['id'], 'cat': c['cat'], 'title': c['title'], 'teaser': c['teaser']}
        if c.get('meta'): o['meta'] = c['meta']
        o['cover'] = cov or {'file': '', 'caption': ''}
        o['sections'] = secs
        o['summary'] = c['summary']
        out.append(o)

    base = json.load(open(os.path.join(ROOT, 'data', 'base-cards.json')))['cards']
    base_ids = {c['id'] for c in base}
    clash = base_ids & {c['id'] for c in out}
    assert not clash, clash
    allc = base + out
    json.dump({'cards': allc}, open(os.path.join(ROOT, 'data', 'cards.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print('Karten gesamt:', len(allc), dict(Counter(c['cat'] for c in allc)))
    print('ohne Bild:', len(noimg), noimg)

if __name__ == '__main__':
    main()
