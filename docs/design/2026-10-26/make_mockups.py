from pathlib import Path

OUT = Path(__file__).parent
paths = {
 'home':'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
 'search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'settings':'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
 'folder':'<path d="M3 6h7l2 3h9v11H3Z"/>',
 'wallet':'<path d="M3 5h16v4H3v11h18V9h-4v6h4M3 9V5"/>',
 'book':'<path d="M12 5v15M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1Z"/>',
 'work':'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
 'life':'<path d="M12 21V9M12 13C4 13 3 7 3 4c7 0 9 4 9 9ZM12 17c0-6 4-9 9-9 0 6-3 9-9 9Z"/>',
 'back':'<path d="m15 5-7 7 7 7"/>',
 'right':'<path d="m9 5 7 7-7 7"/>',
 'more':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 'image':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-3 5 5"/>',
 'link':'<path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 0) scale(.83 1)"/>',
 'tag':'<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7" cy="7" r="1"/>',
 'check':'<path d="m5 12 4 4L19 6"/>',
 'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 'upload':'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
}
def icon(name):
 return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg>'

def button(text, name, extra=''):
 return f'<div class="action {extra}">{icon(name)}<span>{text}</span></div>'

def nav(active='home'):
 return '<nav>'+''.join(button(t,i,('active' if i==active else '')+(' create' if i=='plus' else '')) for i,t in [('home','ホーム'),('search','検索'),('plus','新規作成'),('settings','設定')])+'</nav>'

def row(title, body, meta, time='今日'):
 return f'<div class="note"><div class="rowtitle"><strong>{title}</strong><small>{time}</small></div><p>{body}</p><small>{meta}</small></div>'

def frame(name, body, *, dark=False, editor=False, active='home'):
 return f'<section class="screen {"dark" if dark else ""}"><div class="status"><b>9:41</b><span>▮▮▮ &nbsp; Wi-Fi &nbsp; ▰</span></div>{body}{"" if editor else nav(active)}<div class="home-indicator"></div></section>'

def home(dark=False):
 cats=''.join(f'<div class="category"><span class="category-icon {c}">{icon(i)}</span><strong>{t}</strong><small>{n}件</small></div>' for t,i,c,n in [('お金','wallet','green',8),('勉強','book','blue',12),('仕事','work','violet',6),('生活','life','ochre',16)])
 body=f'''<main><div class="heading"><h1>My Memo</h1><span class="quiet">42 メモ</span></div><div class="searchbar">{icon('search')}<span>メモ、タグ、リンクを検索</span></div><div class="section-title"><h2>カテゴリー</h2></div><div class="categories">{cats}</div><div class="section-title"><h2>最近のメモ</h2><span class="accent">すべて見る</span></div>{row('週末の小さな旅','海の見える町へ。気になるお店と持ち物。','生活 / 旅行　 #週末','14:32')}{row('読書で残しておきたいこと','「続ける」ために、まず小さく始める。','勉強 / 読書　 #読書','昨日')}{row('今月のお金の見直し','固定費を整理して、旅行の積立を増やす。','お金 / 貯金','10/24')}</main>'''
 return frame('ホーム',body,dark=dark)

editor=frame('メモ編集',f'''<div class="edit-header"><span class="accent">{icon('back')}戻る</span><span class="save">{icon('check')}保存済み</span><span>{icon('more')}</span></div><main class="edit-main"><div class="location">{icon('folder')} 生活 / 旅行 {icon('right')}</div><h1 class="note-title">週末の小さな旅</h1><div class="quiet timestamp">10月26日 14:32 更新</div><div class="bodycopy"><p>海の見える町へ。<br>予定を詰めすぎず、歩く時間を<br>ゆっくり楽しむ。</p><p>朝は駅前のパン屋に寄って、<br>お昼は港の近くでごはん。<br>帰りに、本屋を一軒のぞいてみる。</p><p>持っていくもの<br>カメラ、薄手の上着、読みかけの本。</p></div><div class="tags"><span>#週末</span><span>#旅のメモ</span></div><div class="attachment"><span>{icon('link')}</span><div><b>海辺の町の散歩ガイド</b><small>example.com</small></div>{icon('right')}</div></main><div class="edit-tools">{button('画像','image')}{button('リンク','link')}{button('タグ','tag')}</div>''',editor=True)

search=frame('検索',f'''<main><div class="heading"><h1>検索</h1></div><div class="searchbar filled">{icon('search')}<b>読書</b><span class="clear">×</span></div><p class="search-help">タイトル・本文・タグ・リンクを検索</p><div class="section-title"><h2>検索結果</h2><span class="quiet">3件</span></div>{row('読書で残しておきたいこと','「続ける」ために、まず小さく始める。','勉強 / 読書　 #読書','昨日')}{row('読みたい本','次の休日に図書館で探す本をまとめる。','勉強 / 読書','10/23')}{row('夜の時間の使い方','寝る前の20分を読書の時間にする。','生活 / 日記','10/20')}</main>''',active='search')

folders=frame('フォルダ',f'''<main><div class="backline">{icon('back')}ホーム</div><div class="heading"><h1>生活</h1><span class="quiet">16 メモ</span></div><div class="section-title"><h2>フォルダ</h2><span class="accent">＋ 追加</span></div><div class="folder-list">'''+''.join(f'<div class="folder-row {"selected" if t=="旅行" else ""}">{icon("folder")}<b>{t}</b><small>{n}</small>{icon("more")}</div>' for t,n in [('日記',8),('旅行',3),('筋トレ',2),('趣味',3)])+f'''</div><div class="section-title"><h2>旅行</h2><span class="quiet">3 メモ</span></div>{row('週末の小さな旅','海の見える町へ。気になるお店と持ち物。','#週末　#旅のメモ','14:32')}{row('行ってみたい場所','次の旅先の候補を少しずつ集める。','#旅のメモ','10/22')}{row('旅の持ち物','充電器、折りたたみ傘、常備薬。','#準備','10/18')}</main>''')

def setting(title,sub='',i=None):
 return f'<div class="setting-row">{icon(i) if i else ""}<div><b>{title}</b>{f"<small>{sub}</small>" if sub else ""}</div>{icon("right")}</div>'

settings=frame('設定',f'''<main><div class="heading"><h1>設定</h1></div><div class="section-title"><h2>表示</h2></div><div class="segmented"><span>ライト</span><span>ダーク</span><b>端末に合わせる</b></div><div class="section-title"><h2>データとバックアップ</h2></div><p class="explanation">メモと画像は、この端末に保存されます。<br>大切なメモは定期的にバックアップ。</p>{setting('バックアップを保存','メモ・画像・注釈をJSONで保存','download')}{setting('バックアップを復元','確認後、現在のデータを置き換え','upload')}{setting('永続保存を要求','ブラウザへ保存領域の保持を申請') }<div class="section-title"><h2>オフラインと更新</h2></div><div class="ready">{icon('check')}オフライン利用の準備ができています</div>{setting('準備・更新を確認')}<p class="footnote">外部リンク先の閲覧には通信が必要です。</p></main>''',active='settings')

css='''
*{box-sizing:border-box}body{margin:0;background:#eeede8;color:#242925;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans CJK JP",sans-serif;-webkit-font-smoothing:antialiased}svg{width:22px;height:22px;flex:none;vertical-align:middle}h1,h2,p{margin:0}h1{font-size:30px;letter-spacing:-.7px;font-weight:700}h2{font-size:17px;font-weight:650}small{font-size:12px;color:var(--muted)}.board{padding:32px 34px 26px;width:1286px}.boardhead{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:22px}.boardhead h1{font-size:25px}.boardhead span{font-size:13px;color:#60665f}.grid{display:grid;grid-template-columns:repeat(3,390px);gap:24px}.label{font-size:14px;margin-bottom:12px;display:flex;gap:10px;align-items:center}.label b{font-size:12px;color:#476b5b;font-weight:600}.screen{--bg:#fbfaf7;--ink:#252a27;--muted:#687168;--accent:#345f4c;--line:#e1e3dc;--subtle:#edf1ea;position:relative;background:var(--bg);color:var(--ink);height:844px;width:390px;border:1px solid #d8dbd3;border-radius:24px;overflow:hidden}.dark{--bg:#1b1f1c;--ink:#eceee8;--muted:#b2b9ae;--accent:#a6c7ae;--line:#363e36;--subtle:#29332b;border-color:#333a33}.status{height:48px;padding:14px 24px 0;display:flex;justify-content:space-between;font-size:14px}.status span{font-size:11px}main{padding:6px 24px 105px}.heading{display:flex;align-items:center;justify-content:space-between;margin:6px 0 22px}.quiet{color:var(--muted);font-size:13px}.accent{color:var(--accent);font-size:14px}.searchbar{height:48px;display:flex;gap:10px;align-items:center;border-radius:10px;background:var(--subtle);color:var(--muted);padding:0 13px;font-size:14px}.section-title{display:flex;align-items:center;justify-content:space-between;margin:26px 0 12px}.categories{display:grid;grid-template-columns:1fr 1fr;gap:10px}.category{border:1px solid var(--line);border-radius:12px;height:88px;padding:12px 13px;display:grid;grid-template-columns:28px 1fr;gap:2px 9px;align-content:center}.category-icon{grid-row:span 2;align-self:center}.category strong{font-size:16px;font-weight:600}.green{color:#47705b}.blue{color:#4c6c83}.violet{color:#776682}.ochre{color:#886d3e}.dark .green{color:#98b6a0}.dark .blue{color:#a2bbce}.dark .violet{color:#c5afce}.dark .ochre{color:#ceb98e}.note{border-bottom:1px solid var(--line);padding:13px 0 15px}.rowtitle{display:flex;align-items:center;gap:8px;justify-content:space-between}.rowtitle strong{font-size:17px;font-weight:600;letter-spacing:-.3px}.rowtitle small{white-space:nowrap}.note p{font-size:14px;line-height:1.7;margin:5px 0 6px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.note small{font-size:12px}.note:last-child{border-bottom:0}nav{position:absolute;left:0;right:0;bottom:0;height:94px;border-top:1px solid var(--line);background:var(--bg);display:grid;grid-template-columns:repeat(4,1fr);padding:8px 14px 28px}.action{height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--muted);font-size:10px}.action.active{color:var(--accent);font-weight:700}.create svg{background:var(--accent);color:var(--bg);border-radius:10px;width:34px;height:30px;padding:4px}.create{color:var(--accent)}.home-indicator{height:5px;width:128px;border-radius:4px;position:absolute;bottom:8px;left:130px;background:var(--ink)}.edit-header{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 19px;font-size:15px}.edit-header>span{display:flex;align-items:center;gap:5px;min-height:44px}.save{font-size:12px;color:var(--muted)}.save svg{width:16px}.edit-main{padding-top:12px}.location{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;min-height:44px}.location svg{width:17px}.location svg:last-child{width:12px}.note-title{font-size:27px;line-height:1.5;letter-spacing:-.7px;margin:8px 0}.timestamp{font-size:12px}.bodycopy{font-size:17px;line-height:1.9;margin-top:29px;letter-spacing:.05px}.bodycopy p{margin-bottom:22px}.tags{display:flex;gap:8px;margin:8px 0 24px}.tags span{font-size:12px;background:var(--subtle);border-radius:6px;padding:6px 10px;color:var(--accent)}.attachment{display:flex;align-items:center;gap:12px;padding:15px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.attachment div{flex:1}.attachment b{font-size:14px;font-weight:550}.attachment small{display:block;margin-top:4px}.attachment svg:last-child{width:16px;color:var(--muted)}.edit-tools{position:absolute;bottom:0;left:0;right:0;height:94px;display:flex;justify-content:space-around;border-top:1px solid var(--line);background:var(--bg);padding:8px 32px 28px}.edit-tools .action{min-width:70px;font-size:11px;color:var(--accent)}.filled{color:var(--ink);font-size:16px}.filled b{font-weight:500}.clear{margin-left:auto;font-size:25px;color:var(--muted)}.search-help{font-size:12px;color:var(--muted);margin:14px 0 28px}.backline{display:flex;align-items:center;color:var(--accent);font-size:15px;height:44px;margin-left:-8px}.backline+.heading{margin:8px 0 24px}.folder-row{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);height:55px;padding:0 8px}.folder-row b{font-size:16px;font-weight:500;flex:1}.folder-row svg{color:var(--muted)}.folder-row svg:last-child{margin-left:8px}.folder-row.selected{background:var(--subtle);border-radius:8px;border-color:transparent}.folder-row.selected b,.folder-row.selected svg{color:var(--accent)}.segmented{display:flex;background:var(--subtle);border-radius:9px;padding:4px;gap:2px;font-size:13px}.segmented>*{padding:10px 8px;flex:1;text-align:center;white-space:nowrap;font-weight:500}.segmented b{background:var(--bg);border:1px solid var(--line);border-radius:6px;flex:1.6}.explanation{font-size:13px;line-height:1.85;color:var(--muted);margin-bottom:12px}.setting-row{display:flex;gap:13px;align-items:center;min-height:67px;border-bottom:1px solid var(--line)}.setting-row div{flex:1}.setting-row b{font-size:15px;font-weight:500}.setting-row small{display:block;margin-top:4px;font-size:11px}.setting-row>svg{color:var(--accent);width:20px}.setting-row>svg:last-child{width:14px;color:var(--muted)}.ready{font-size:12px;display:flex;align-items:center;gap:6px;color:var(--accent);margin:20px 0 4px}.ready svg{width:16px}.footnote{font-size:11px;color:var(--muted);margin-top:15px}.caption{font-size:12px;line-height:1.8;color:#60665f;margin:14px 0 0}.footer{margin:20px 0 0;font-size:12px;color:#60665f}@media(max-width:600px){.board{width:auto;padding:22px 12px}.grid{grid-template-columns:390px}.boardhead{display:block}.boardhead span{display:block;margin-top:8px}}
'''

boards=[('01','書く、見返す。必要なものを近くに。',[
 ('01','ホーム',home(),'大きな紹介文を省き、カテゴリーと最近のメモを上へ。'),
 ('02','メモ編集',editor,'本文を主役に。保存状態を上に、画像・リンク・タグを下に。'),
 ('03','検索',search,'検索欄と結果に集中。一致箇所の強調は第1段階で追加。')]),
 ('02','整理も、設定も。同じリズムで。',[
 ('04','フォルダ',folders,'行の高さと操作位置を統一。名称変更・並び替えは行末から。'),
 ('05','設定',settings,'表示、バックアップ、オフラインの順にまとめる。'),
 ('06','ダークモード',home(True),'情報の位置を変えず、背景と文字の明るさを調整する。')])]
for num,title,items in boards:
 content=''.join(f'<article><div class="label"><b>{i}</b>{label}</div>{screen}<p class="caption">{caption}</p></article>' for i,label,screen,caption in items)
 html=f'<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Memo デザイン提案 {num}</title><style>{css}</style><body><div class="board"><div class="boardhead"><h1>{title}</h1><span>My Memo / 第0段階・承認前の静的デザイン案</span></div><div class="grid">{content}</div><p class="footer">表示内容は架空のサンプルです。保存・検索等の動作はありません。Canva連携を使わず作成した画面設計です。</p></div></body></html>'
 (OUT/f'proposal-{num}.html').write_text(html)
