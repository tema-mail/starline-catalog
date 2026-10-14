import re,sys,json,html,os,ssl,time,urllib.request,urllib.parse,http.cookiejar
# Снимает карточки товаров (фото, цена, конфигуратор, функции, комплектация) по data/raw/catalog.json.
# Запуск: python3 -I scripts/scrape_cards.py data/raw  (HTML страниц кладёт в data/raw/pages, в git не идёт)
D=sys.argv[1]
UA="Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/126 Safari/537.36"
ctx=ssl.create_default_context(cafile="/etc/ssl/cert.pem")
cj=http.cookiejar.CookieJar()
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj),urllib.request.HTTPSHandler(context=ctx))
op.addheaders=[('User-Agent',UA)]
B='https://store.starline.ru'
def get(u):
    return op.open(urllib.parse.quote(B+u,safe=':/?=&%')).read().decode()
cat=json.load(open(D+'/catalog.json'))
os.makedirs(D+'/pages',exist_ok=True)
urls=[i['url'] for i in cat['items']]
seen=set(urls); queue=list(urls)
def txt(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
out={}
while queue:
    u=queue.pop(0)
    slug=u.strip('/').split('/')[-1]
    fn=f'{D}/pages/{slug}.html'
    if not os.path.exists(fn):
        try: s=get(u)
        except Exception as e: print('ERR',u,e); continue
        open(fn,'w').write(s); time.sleep(0.3)
    s=open(fn).read()
    p={'url':u,'slug':slug,'inCatalog':u in urls}
    m=re.search(r'id="item-id" value="(\d+)"',s); p['id']=m.group(1) if m else None
    m=re.search(r'<h1>(.*?)</h1>',s,re.S); p['name']=txt(m.group(1)) if m else slug
    m=re.search(r'<h2 itemprop="name">\s*<em>(.*?)</em></br>(.*?)</h2>',s,re.S); p['type']=txt(m.group(2)) if m else ''
    m=re.search(r'<p class="item-description" itemprop="description">(.*?)</p>',s,re.S); p['lead']=txt(m.group(1)) if m else ''
    m=re.search(r'<meta itemprop="price" content="(\d+)"',s); p['price']=int(m.group(1)) if m else None
    m=re.search(r'<div class="stock">(.*?)</div>',s,re.S); p['stock']=txt(m.group(1)) if m else ''
    g=s[s.find('id="lightSlider"'):s.find('</ul>',s.find('id="lightSlider"'))]
    p['gallery']=re.findall(r'<li data-thumb="([^"]+)"',g)
    i=s.find('<div class="title">Комплектация</div>')
    conf=[]
    if i>0:
        blk=s[i:s.find('</div>',s.find('<div class="d-flex mt-3',i)+10)]
        for a in re.finditer(r'<a (.*?)>([^<]*)</a>',blk,re.S):
            at=a.group(1)
            h=re.search(r'href=([^\s>]+)',at)
            dc=re.search(r'data-content="([^"]*)"',at)
            conf.append({'label':a.group(2).strip(),'href':h.group(1).strip('"') if h else None,'active':'conf active' in at,'hint':txt(dc.group(1)) if dc else ''})
    p['conf']=conf
    for c in conf:
        if c['href'] and c['href'].startswith('/catalog/') and c['href'] not in seen:
            seen.add(c['href']); queue.append(c['href'])
    # characteristics
    ci=s.find('id="tab-characteristics"'); ce=s.find('id="tab-equipment"')
    if ce<0: ce=s.find('id="tab-telematics"')
    ch=s[ci:ce] if ci>0 else ''
    groups=[]
    for gm in re.finditer(r'<div class="title-underlined[^"]*"><span>(.*?)</span></div>(.*?)(?=<div class="title-underlined|$)',ch,re.S):
        feats=[]
        for fm in re.finditer(r'data-src="([^"]+)".*?<p class="text-uppercase[^"]*">(.*?)</p>\s*<p>(.*?)</p>',gm.group(2),re.S):
            feats.append({'icon':fm.group(1),'title':txt(fm.group(2)),'text':txt(fm.group(3))})
        groups.append({'title':txt(gm.group(1)),'items':feats})
    p['features']=groups
    ei=s.find('id="tab-equipment"')
    eq=[]
    if ei>0:
        eb=s[ei:s.find('</ol>',ei) if s.find('</ol>',ei)>0 else ei+20000]
        for em in re.finditer(r'<div class="carousel-item[^"]*">\s*<img alt="([^"]*)"[^>]*data-src="([^"]+)"',eb,re.S):
            eq.append({'title':txt(em.group(1)),'img':em.group(2)})
    p['equipment']=eq
    ii=s.find('id="tab-instructions"')
    p['docs']=[{'href':a,'title':txt(t)} for a,t in re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>',s[ii:s.find('</div>',ii)])] if ii>0 else []
    wi=s.find('id="tab-warranty"')
    p['warranty']=txt(s[wi:s.find('</div>',wi)]).replace('Гарантийный срок','',1).strip() if wi>0 else ''
    out[slug]=p
json.dump(out,open(D+'/products.json','w'),ensure_ascii=False,indent=1)
print(len(out),'pages;',sum(1 for p in out.values() if p['inCatalog']),'in catalog')
for p in out.values(): print(('*' if p['inCatalog'] else ' '),p['slug'],p['price'],len(p['gallery']),len(p['conf']),sum(len(g['items']) for g in p['features']),len(p['equipment']),p['stock'])
