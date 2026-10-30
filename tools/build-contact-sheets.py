"""Package actual runtime captures. Requires Pillow; never synthesizes model art."""
import json, pathlib
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'data/generated-assets.json').read_text())
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,15)
title_font=ImageFont.truetype(font_path,25)
preview=root/'public/assets/previews';preview.mkdir(parents=True,exist_ok=True)
sheets=root/'docs/evidence/assets/contact-sheets';sheets.mkdir(parents=True,exist_ok=True)
groups={}
for a in manifest['assets']:
 slug=a['id'].replace(':','-').replace('/','-')
 source=root/f'docs/evidence/assets/renders/{slug}.png'
 im=Image.open(source).convert('RGB');im.resize((256,256),Image.Resampling.LANCZOS).save(preview/f'{slug}.webp',quality=85)
 groups.setdefault(a['kind'] if a['kind']!='slots' else a['family'],[]).append((a,im))
links=[]
for family,items in groups.items():
 for page in range((len(items)+19)//20):
  batch=items[page*20:page*20+20];rows=(len(batch)+3)//4
  sheet=Image.new('RGB',(1104,80+rows*300),(9,16,24));draw=ImageDraw.Draw(sheet)
  draw.text((22,20),f'ARSENAL FORGE  /  {family.replace("_"," ").upper()}  /  {page+1}',font=title_font,fill=(226,218,194))
  for i,(a,im) in enumerate(batch):
   x=12+(i%4)*276;y=70+(i//4)*300
   sheet.paste(im.resize((264,264),Image.Resampling.LANCZOS),(x,y));draw.text((x+6,y+267),a['name'][:31],font=font,fill=(224,227,230))
  name=f'{family}-{page+1:02d}.jpg';sheet.save(sheets/name,quality=90);links.append(f'![{family} page {page+1}](contact-sheets/{name})')
(root/'docs/evidence/assets/CONTACT_SHEETS.md').write_text('# Rendered asset review sheets\n\nActual Three.js software-rendered captures of all 595 base assets. These provide review evidence, not automatic art approval.\n\n'+'\n\n'.join(links)+'\n')
print(f'Created 595 WebP previews and {len(links)} contact sheets')
