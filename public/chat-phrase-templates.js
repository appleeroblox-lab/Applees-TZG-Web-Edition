// Authored, constrained sentence patterns. No word-by-word guessing or remote translator.
const actions=[
['launch the ship','ယာဉ်ကို လွှတ်တင်','faire décoller le vaisseau','宇宙船の発射','ปล่อยยาน'],
['land the ship','ယာဉ်ကို ဆင်းသက်','faire atterrir le vaisseau','宇宙船の着陸','ลงจอดยาน'],
['fly','ပျံသန်း','voler','飛行','บิน'],
['warp','ဝပ်ခရီး သွား','faire un saut spatial','ワープ','วาร์ป'],
['mine','သတ္တု တူး','miner','採掘','ขุดแร่'],
['open the inventory','ပစ္စည်းအိတ်ကို ဖွင့်','ouvrir l’inventaire','持ち物の表示','เปิดกระเป๋า'],
['save the game','ဂိမ်းကို သိမ်း','enregistrer le jeu','ゲームの保存','บันทึกเกม'],
['join a group','အဖွဲ့ကို ဝင်','rejoindre un groupe','グループへの参加','เข้าร่วมกลุ่ม'],
['create a group','အဖွဲ့ ဖွဲ့','créer un groupe','グループの作成','สร้างกลุ่ม'],
['add a friend','သူငယ်ချင်း ထည့်','ajouter un ami','フレンドの追加','เพิ่มเพื่อน'],
['send a message','စာ ပို့','envoyer un message','メッセージの送信','ส่งข้อความ'],
['send an image','ပုံ ပို့','envoyer une image','画像の送信','ส่งรูปภาพ'],
['send a gif','GIF ပို့','envoyer un GIF','GIFの送信','ส่ง GIF'],
['change my username','အသုံးပြုသူအမည် ပြောင်း','changer mon pseudo','ユーザー名の変更','เปลี่ยนชื่อผู้ใช้'],
['change my profile picture','ကိုယ်ရေးပုံ ပြောင်း','changer ma photo de profil','プロフィール画像の変更','เปลี่ยนรูปโปรไฟล์'],
['change the language','ဘာသာစကား ပြောင်း','changer la langue','言語の変更','เปลี่ยนภาษา'],
['buy items','ပစ္စည်း ဝယ်','acheter des objets','アイテムの購入','ซื้อไอเทม'],
['sell items','ပစ္စည်း ရောင်း','vendre des objets','アイテムの売却','ขายไอเทม'],
['use the map','မြေပုံကို သုံး','utiliser la carte','マップの使用','ใช้แผนที่'],
['take a screenshot','မျက်နှာပြင်ပုံ ရိုက်','prendre une capture d’écran','スクリーンショットの撮影','ถ่ายภาพหน้าจอ'],
['record a voice message','အသံစာ သွင်း','enregistrer un message vocal','音声メッセージの録音','บันทึกข้อความเสียง'],
['build','အဆောက်အအုံ ဆောက်','construire','建築','สร้างสิ่งก่อสร้าง']
];
export function gamingPhraseRows(){const result=[];for(const[e,m,f,j,t]of actions){for(const prefix of ['how do i ','how can i '])result.push([prefix+e,m+'ဖို့ ဘယ်လိုလုပ်ရမလဲ။','Comment '+f+' ? ',j+'のやり方を教えて。',t+'อย่างไร']);for(const prefix of ["i can't ",'i cannot '])result.push([prefix+e,m+'လို့ မရဘူး။','Je n’arrive pas à '+f+'.',j+'ができません。','ฉัน'+t+'ไม่ได้']);result.push(['please help me '+e,m+'ဖို့ ကူညီပေးပါ။','Aide-moi à '+f+', s’il te plaît.',j+'を手伝ってください。','ช่วยฉัน'+t+'หน่อย'])}return result}
const bodies=new Map(['Earth','Moon','Mars','Mercury','Venus','Jupiter','Saturn','Uranus','Neptune','Pluto','Ceres','Eris','Haumea','Makemake','Europa','Titan','Triton','Proxima b','Proxima c','Proxima d','Sun'].map(name=>[name.toLowerCase(),name]));
export function gamingSentence(text,target){const index=['en','my','fr','ja','th'].indexOf(target);if(index<0)return null;const patterns=[
 [/^(?:i am|i'm|im) (?:going|flying) to (.+)$/i,body=>['I am going to '+body,'ငါ '+body+' ကို သွားနေတယ်။','Je vais vers '+body+'.',body+'に向かっています。','ฉันกำลังไป'+body]],
 [/^(?:let us|let's|lets) go to (.+)$/i,body=>["Let's go to "+body,body+' ကို သွားကြမယ်။','Allons vers '+body+'.',body+'に行こう。','ไป'+body+'กันเถอะ']],
 [/^(?:i am|i'm|im) (?:on|at) (?:the )?(.+)$/i,body=>['I am on '+body,'ငါ '+body+' ပေါ်မှာ ရှိတယ်။','Je suis sur '+body+'.',body+'にいます。','ฉันอยู่บน'+body]],
 [/^(?:can we|could we) go to (.+)$/i,body=>['Can we go to '+body,body+' ကို သွားလို့ ရမလား။','On peut aller vers '+body+' ?',body+'に行ってもいい？','เราไป'+body+'ได้ไหม']]
 ];for(const[pattern,make]of patterns){const match=text.match(pattern),body=match&&bodies.get(match[1].trim().toLowerCase());if(body)return make(body)[index]}return null}
