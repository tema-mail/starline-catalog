import re,sys,json,html,ssl,urllib.request,urllib.parse,http.cookiejar
# Кладёт все товары в сравнение на store.starline.ru и снимает матрицу параметров в data/raw/compare.json.
# Запуск: python3 -I scripts/scrape_compare.py data/raw
D=sys.argv[1]
UA="Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126 Safari/537.36"
ctx=ssl.create_default_context(cafile="/etc/ssl/cert.pem")
cj=http.cookiejar.CookieJar()
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj),urllib.request.HTTPSHandler(context=ctx))
op.addheaders=[('User-Agent',UA)]
P=json.load(open(D+'/products.json'))
page=op.open('https://store.starline.ru/catalog/avtosignalizatsii/').read().decode()
sess=re.search(r"'bitrix_sessid':'([0-9a-f]+)'",page).group(1)
for p in P.values():
    d=urllib.parse.urlencode({'URL':'/local/ajax/catalog/add2CompareList.php','PRODUCT_ID':p['id'],'sessid':sess}).encode()
    r=op.open(urllib.request.Request('https://store.starline.ru/local/ajax/catalog/add2CompareList.php',data=d,headers={'X-Requested-With':'XMLHttpRequest'})).read().decode()
print('last',r)
s=op.open('https://store.starline.ru/catalog/compare/').read().decode()
open(D+'/compare_all.html','w').write(s)
def txt(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
body=s[s.find('compare-table__body'):]
sections=[]
for sm in re.finditer(r'<span class="section__title">(.*?)</span>(.*?)(?=<span class="section__title">|$)',body,re.S):
    props=[]
    for pm in re.finditer(r'<div class="property">(.*?)(?=<div class="property">|$)',sm.group(2),re.S):
        b=pm.group(1)
        ic=re.search(r"data-src='([^']+)'",b)
        tm=re.search(r'title="([^"]*)"',b)
        dm=re.search(r'<small class="text-muted">(.*?)</small>',b,re.S)
        vals={}
        for cm in re.finditer(r'<div class="compare-table__cell property-value" data-id="(\d+)">(.*?)</div>',b,re.S):
            c=cm.group(2)
            if 'property-value_true' in c: v=True
            else:
                t=txt(c)
                v=t if t else False
            vals[cm.group(1)]=v
        props.append({'title':html.unescape(tm.group(1)) if tm else '','desc':txt(dm.group(1)) if dm else '','icon':ic.group(1) if ic else None,'values':vals})
    sections.append({'title':txt(sm.group(1)),'props':props})
json.dump(sections,open(D+'/compare.json','w'),ensure_ascii=False,indent=1)
for sct in sections:
    print('##',sct['title'],len(sct['props']))
    for pr in sct['props']:
        from collections import Counter
        print('   ',pr['title'][:45],len(pr['values']),dict(Counter(str(v) for v in pr['values'].values()).most_common(4)))
