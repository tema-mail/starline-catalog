import re,sys,json,urllib.request,urllib.parse,http.cookiejar
# Снимает список охранных комплексов и привязку товаров к функциям фильтра store.starline.ru.
# Запуск: python3 -I scripts/scrape_catalog.py data/raw
UA="Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126 Safari/537.36"
cj=http.cookiejar.CookieJar()
import ssl
ctx=ssl.create_default_context(cafile="/etc/ssl/cert.pem")
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj),urllib.request.HTTPSHandler(context=ctx))
op.addheaders=[('User-Agent',UA)]
page=op.open('https://store.starline.ru/catalog/avtosignalizatsii/').read().decode()
sess=re.search(r"'bitrix_sessid':'([0-9a-f]+)'",page).group(1)
feats=re.findall(r'name="(FILTER_[A-Z_]+)" class="function-filter\s+filter-checkbox" value="(\d+)">\s*<s></s>([^<]+)',page)
purp=re.findall(r'name="ITEM_PURPOSE_LIST" class="filter-checkbox" value="(\d+)"><s></s>([^<]+)',page)
def q(features=None,purpose=None):
    d=[('URL','/local/ajax/catalog/store/catalogList.php'),('SECTION_CODE','avtosignalizatsii'),('sessid',sess),
       ('FILTER_PARAMS[SECTION_CODE]','avtosignalizatsii'),('FILTER_PARAMS[PAGE_ELEMENT_COUNT]','200'),
       ('FILTER_PARAMS[SORT_BY]','sort'),('FILTER_PARAMS[SORT_ORDER]','asc')]
    if features: d.append((f'FILTER_PARAMS[ITEM_FEATURES][{features[0]}]',features[1]))
    if purpose: d.append(('FILTER_PARAMS[ITEM_PURPOSE_LIST][0]',purpose))
    r=urllib.request.Request('https://store.starline.ru/local/ajax/catalog/store/catalogList.php',data=urllib.parse.urlencode(d).encode(),headers={'X-Requested-With':'XMLHttpRequest'})
    return op.open(r).read().decode()
def items(h):
    out=[]
    for m in re.finditer(r'<a href="(/catalog/avtosignalizatsii/[^"]+/)"[^>]*>\s*<h5[^>]*>([^<]+)</h5>\s*(?:<img data-src="([^"]+)")?',h):
        out.append(dict(url=m.group(1),name=m.group(2).strip(),img=m.group(3)))
    return out
allh=q()
open(sys.argv[1]+'/all.html','w').write(allh)
base=items(allh)
res={'features':[dict(name=n,val=v,title=t.strip()) for n,v,t in feats],'purpose':purp,'items':base,'map':{},'pmap':{}}
for n,v,t in feats:
    res['map'][n]=[i['url'] for i in items(q((n,v)))]
for v,t in purp:
    res['pmap'][v]=[i['url'] for i in items(q(purpose=v))]
json.dump(res,open(sys.argv[1]+'/catalog.json','w'),ensure_ascii=False,indent=1)
print(len(base)); print({k:len(v) for k,v in res['map'].items()}); print({k:len(v) for k,v in res['pmap'].items()})
