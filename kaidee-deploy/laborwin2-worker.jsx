/* laborwin2-worker.jsx — จอแรงงาน: 2 สวิตช์อิสระ + โหมดเวลา + 3 สถานะ + ค่าคอมงานนอก */
function WkSwitch({on,disabled,color,emoji,title,sub,onToggle}){
  return <div className={'wsw'+(on?' on':'')+(disabled?' dis':'')} style={on?{'--c':color}:{}} onClick={()=>!disabled&&onToggle()}>
    <span className="e">{emoji}</span>
    <div className="tx"><b>{title}</b><span>{sub}</span></div>
    <span className={'knob'+(on?' on':'')} style={on?{background:color}:{}}></span>
  </div>;
}

function TermsModal({rate,onAgree,onClose}){
  const [ck,setCk]=useState(false);
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">เปิดรับงานนอกครั้งแรก</div>
    <p className="mp">งานนอก (open pool) = งานจากร้านทั่วทุกตลาด กดรับเอง <b>ไม่ผ่านหัวคิว</b> · หัวคิวเห็นแค่ยอดรวม ไม่เห็นรายละเอียดงาน/ร้าน/คน</p>
    <div className="tbox"><b>เงื่อนไขค่าคอมหัวหน้าวิน</b><ul>
      <li>ทุกบิลงานนอกหัก <b>{Math.round(rate*100)}%</b> เข้าหัวคิว (ขั้นต่ำ {B(COMM_FLOOR)}/บิล)</li>
      <li>เป็นค่าสังกัดวินคุ้มครอง · หัวคิวไม่เห็นว่าคุณรับงานอะไร ที่ไหน</li>
      <li>ปรับสถานะเป็น “ฟรีแลนซ์ล้วน” = ไม่หัก แต่ไม่มีวินคุ้มครอง</li>
    </ul></div>
    <label className="ckrow"><input type="checkbox" checked={ck} onChange={e=>setCk(e.target.checked)}/> ฉันอ่านและยอมรับเงื่อนไขค่าคอมหัวหน้าวิน</label>
    <button className="btn" disabled={!ck} onClick={onAgree}>ยอมรับ & เปิดงานนอก</button>
    <button className="reset" onClick={onClose}>ยกเลิก</button>
  </div></div>;
}

/* ── คู่มือในแอปสำหรับแรงงาน/ไรเดอร์ (3 ภาษา · ตรงกับระบบจริง: สมัครเองทันที ไม่มีตรวจเอกสาร เงินสดตรงมือ) ── */
const WK_HELP={
  th:{title:'คู่มือใช้งาน',sub:'แตะหัวข้อเพื่อดูวิธีใช้',close:'ปิดคู่มือ',topics:[
    {e:'🚀',h:'เริ่มใช้งาน — สมัครได้เลย ไม่ต้องรออนุมัติ',s:[
      'ไม่ต้องอัปโหลดบัตร/ใบขับขี่ ไม่ต้องรอตรวจเอกสาร — เปิดแอปแล้วรับงานได้เลย',
      'ไปแท็บ “🎚️ สวิตช์” เลือกสถานะของคุณ 1 ใน 3 แบบ (เปลี่ยนทีหลังได้ตลอด)',
      'สังกัดวินอย่างเดียว = รับเฉพาะงานที่หัวคิวส่งให้ · ไม่หักค่าคอมงานนอก',
      'สังกัดวิน + รับงานนอก = รับงานหัวคิวด้วย กดรับงานเองด้วย (งานนอกหัก {comm}% เข้าหัวคิว)',
      'ฟรีแลนซ์ล้วน = ไม่สังกัดใคร ไม่หักอะไรเลย แต่ไม่มีวินคุ้มครอง/ไม่มีงานจากหัวคิว',
    ]},
    {e:'🎚️',h:'2 สวิตช์ — เปิด/ปิดรับงานทีละแบบ',s:[
      '🟢 งานในตลาด = งานที่หัวหน้าวิน/หัวคิวส่งเข้ามาให้คุณ',
      '🔵 งานนอก = งานจากร้านทุกตลาด คุณกดรับเอง ไม่ผ่านหัวคิว',
      'หัวคิวเห็นแค่ว่าคุณ “พร้อม/ไม่พร้อม” งานตลาดเท่านั้น — งานนอกหัวคิวไม่เห็นเลยว่าคุณรับอะไร ที่ไหน',
      'แนะนำติ๊ก “🔒 ล็อกไม่ให้ซ้อน” ไว้ เปิดได้ทีละอย่าง จะได้ไม่รับงาน 2 ที่พร้อมกัน',
    ]},
    {e:'⏰',h:'โหมดเวลา — ให้แอปสลับให้อัตโนมัติ',s:[
      'แท็บ “🎚️ สวิตช์” → เลือก “ออโต้ตามตาราง” แล้วตั้งช่วงเวลางานตลาด (เช่น 04:00–08:00)',
      'ในช่วงเวลานั้น = เปิดงานตลาด/ปิดงานนอก · พ้นช่วง = สลับไปงานนอกให้เอง',
      'ตารางนี้เป็นของส่วนตัว หัวคิวไม่เห็น',
      'อยากคุมเอง เลือก “แมนนวล” แล้วกดสวิตช์เองทุกครั้ง',
    ]},
    {e:'🟢',h:'รับงานในตลาด (จากหัวคิว)',s:[
      'งานจะเด้งขึ้นการ์ดสีเขียวในแท็บ “🧾 งาน” — มีเวลาตอบ 60 วินาที',
      'ดูค่าแรงและค่าคิวที่หักก่อนตัดสินใจ แล้วกด 🟢 รับงาน หรือ 🔴 ไม่รับ (งานจะวิ่งไปหาคนถัดไป)',
      'กดรับแล้วไปที่ล็อก/แผงตามที่ระบุ ถึงแล้วกด “ถึงแล้ว · เริ่มงาน”',
      'ทำเสร็จ แม่ค้าเป็นคนกดจบงานและจ่ายเงินสดให้คุณตรงนั้น',
    ]},
    {e:'🔵',h:'รับงานนอก (open pool)',s:[
      'เปิดสวิตช์ 🔵 งานนอก แล้วกด “📍 แชร์พิกัด” เพื่อให้แอปหางานใกล้ตัวข้ามตลาด',
      'อ่านการ์ดงาน: ประเภทงาน ร้าน ตลาด ค่าแรง และค่าคอมที่หัก (ถ้ามี) แล้วกด “รับงานนี้”',
      'รับได้ทีละงาน — ทำงานที่ค้างให้จบก่อนถึงจะเห็นงานใหม่',
      'ทำเสร็จรับเงินสดจากร้าน/ลูกค้า แล้วกด “รับเงินสด · จบงาน” ในแอป',
    ]},
    {e:'💵',h:'เรื่องเงิน — จ่ายสดตรงมือคุณ',s:[
      'แพลตฟอร์มไม่ถือเงินของคุณเลย ร้าน/ลูกค้าจ่ายสดให้คุณโดยตรงเมื่อจบงาน',
      'ไม่มีค่าสมัคร ไม่มีค่ามัดจำ ใครขอเก็บเงินค่าเข้าระบบ = ไม่ใช่เรา',
      'ถ้าคุณ “สังกัดวิน + รับงานนอก”: งานนอกหัก {comm}% เข้าหัวคิว (ขั้นต่ำ {floor} ต่อบิล)',
      'งานในตลาดหักค่าคิวตามอัตราที่หัวหน้าวินของคุณตั้งไว้ — ตัวเลขโชว์บนการ์ดก่อนกดรับเสมอ',
      '“ฟรีแลนซ์ล้วน” ไม่หักอะไรเลย',
    ]},
    {e:'📅',h:'งานประจำ & ขอเบิกล่วงหน้า',s:[
      'แท็บ “👤 ฉัน” แสดงงานประจำที่หัวหน้าวินจัดให้ล่วงหน้า (วัน เวลา ร้าน) — รู้ก่อน ไม่ต้องเดา',
      'ดูยอดจ่ายสะสม เงินรอรับ และยอดค้างเบิกได้ในหน้าเดียวกัน',
      'ถ้าวินของคุณเปิดให้เบิกล่วงหน้า กด “💵 ขอเบิกล่วงหน้า” ระบุยอด แล้วรอหัวหน้าวินอนุมัติ',
      'ยอดที่เบิกจะถูกหักคืนจากงานถัดๆ ไป และมีเพดานกำหนดไว้',
    ]},
    {e:'⭐',h:'คะแนนดาว & การรักษางาน',s:[
      'ร้านให้ดาวคุณหลังจบงาน — คะแนนเฉลี่ยแสดงในแท็บ “👤 ฉัน”',
      'รับงานแล้วทิ้ง/ไม่ไป ร้านสามารถเลือกไม่ส่งงานให้คุณอีกได้',
      'รับเท่าที่ไปไหว ถ้าไปไม่ได้ให้กด “ไม่รับ” ตั้งแต่แรก งานจะวิ่งไปหาคนอื่นทันที ดีกว่าปล่อยเงียบ',
      'เปลี่ยนภาษาได้ที่ปุ่ม TH / MY / KH มุมขวาบน',
    ]},
  ]},
  my:{title:'အသုံးပြုလမ်းညွှန်',sub:'ခေါင်းစဉ်ကို နှိပ်ပါ',close:'ပိတ်မည်',topics:[
    {e:'🚀',h:'စတင်ရန် — ချက်ချင်း အလုပ်လက်ခံနိုင်',s:[
      'မှတ်ပုံတင်/ယာဉ်မောင်းလိုင်စင် တင်စရာမလို · အတည်ပြုချက် စောင့်စရာမလို',
      '“🎚️ ခလုတ်” တက်ဘ်တွင် အခြေအနေ ၃ မျိုးထဲမှ ရွေးပါ (နောက်မှ ပြောင်းနိုင်)',
      'ဝင်း (ခေါင်းစဉ်) သာ = ခေါင်းစဉ်ပေးသော အလုပ်သာ လက်ခံ · ကော်မရှင် မဖြတ်',
      'ဝင်း + ပြင်ပအလုပ် = နှစ်မျိုးလုံး ရနိုင် (ပြင်ပအလုပ်မှ {comm}% ဖြတ်)',
      'အလွတ်တန်း = မည်သူ့မှ မဆိုင် · မဖြတ် · ဒါပေမယ့် ဝင်း၏ အကာအကွယ် မရ',
    ]},
    {e:'🎚️',h:'ခလုတ် ၂ ခု',s:[
      '🟢 ဈေးအလုပ် = ခေါင်းစဉ်က ပို့ပေးသော အလုပ်',
      '🔵 ပြင်ပအလုပ် = ဈေးအားလုံးမှ အလုပ် · ကိုယ်တိုင် လက်ခံ',
      'ခေါင်းစဉ်သည် ဈေးအလုပ်အတွက် “အသင့်/မအသင့်” ကိုသာ မြင်ရသည် · ပြင်ပအလုပ်ကို လုံးဝ မမြင်ရ',
      '“🔒 မထပ်အောင် သော့ခတ်” ကို အမှန်ခြစ်ထားပါ — တစ်ခုချင်း လက်ခံရန်',
    ]},
    {e:'⏰',h:'အချိန်စနစ်',s:[
      '“အလိုအလျောက်” ရွေးပြီး ဈေးအလုပ်ချိန် သတ်မှတ်ပါ (ဥပမာ ၀၄:၀၀–၀၈:၀၀)',
      'အဲဒီအချိန်တွင် ဈေးအလုပ်ဖွင့် · ကျော်လွန်ပါက ပြင်ပအလုပ် အလိုအလျောက် ပြောင်း',
      'ဤဇယားမှာ ကိုယ်ပိုင် · ခေါင်းစဉ် မမြင်ရ',
      'ကိုယ်တိုင် ထိန်းချုပ်လိုပါက “ကိုယ်တိုင်” ရွေးပါ',
    ]},
    {e:'🟢',h:'ဈေးအလုပ် လက်ခံခြင်း',s:[
      '“🧾 အလုပ်” တက်ဘ်တွင် စိမ်းရောင်ကတ် ပေါ်လာမည် — ၆၀ စက္ကန့်အတွင်း ဖြေပါ',
      'လုပ်ခနှင့် ဖြတ်ငွေကို ကြည့်ပြီး 🟢 လက်ခံ သို့မဟုတ် 🔴 ငြင်း (နောက်လူဆီ သွားမည်)',
      'နေရာသို့ ရောက်လျှင် “ရောက်ပြီ · စတင်” ကို နှိပ်ပါ',
      'ပြီးလျှင် ဈေးသည်က အလုပ်ပြီးကြောင်း နှိပ်ပြီး ငွေသားကို တိုက်ရိုက် ပေးမည်',
    ]},
    {e:'🔵',h:'ပြင်ပအလုပ် လက်ခံခြင်း',s:[
      '🔵 ခလုတ်ဖွင့်ပြီး “📍 တည်နေရာ မျှဝေ” နှိပ်ပါ — အနီးအနားအလုပ်များ ပေါ်လာမည်',
      'အလုပ်အမျိုးအစား၊ ဆိုင်၊ ဈေး၊ လုပ်ခ၊ ဖြတ်ငွေ ကြည့်ပြီး “လက်ခံ” နှိပ်ပါ',
      'တစ်ခါလျှင် တစ်ခုသာ — ရှိပြီးသားအလုပ် ပြီးမှ အသစ် မြင်ရမည်',
      'ပြီးလျှင် ငွေသားယူပြီး “ငွေယူ · ပြီးဆုံး” နှိပ်ပါ',
    ]},
    {e:'💵',h:'ငွေကြေး — လက်ထဲ တိုက်ရိုက်',s:[
      'ပလက်ဖောင်းသည် သင့်ငွေကို လုံးဝ မကိုင်ပါ · ဆိုင်/ဖောက်သည်က တိုက်ရိုက် ပေးသည်',
      'မှတ်ပုံတင်ကြေး မရှိ · စရံ မရှိ · ငွေတောင်းသူ ရှိလျှင် ကျွန်ုပ်တို့ မဟုတ်ပါ',
      '“ဝင်း + ပြင်ပအလုပ်” ဖြစ်ပါက ပြင်ပအလုပ်မှ {comm}% ({floor} အနည်းဆုံး) ဖြတ်မည်',
      'ဈေးအလုပ်မှ ဖြတ်ငွေသည် ခေါင်းစဉ် သတ်မှတ်ချက်အတိုင်း — လက်မခံမီ ကတ်ပေါ်တွင် အမြဲပြသည်',
    ]},
    {e:'📅',h:'ပုံမှန်အလုပ် & ကြိုတင်ထုတ်ငွေ',s:[
      '“👤 ကျွန်ုပ်” တွင် ခေါင်းစဉ်က ကြိုတင် စီစဉ်ထားသော အလုပ်များ (ရက်၊ အချိန်၊ ဆိုင်) ပေါ်သည်',
      'စုစုပေါင်း ရငွေ၊ စောင့်ဆိုင်းငွေ၊ ကြွေးကျန် ကိုလည်း တစ်နေရာတည်းတွင် ကြည့်နိုင်',
      'ဝင်းက ခွင့်ပြုပါက “💵 ကြိုတင်ထုတ်” နှိပ်ပြီး ပမာဏ ရိုက်ကာ ခေါင်းစဉ် အတည်ပြုရန် စောင့်ပါ',
      'ထုတ်ထားသော ငွေကို နောက်အလုပ်များမှ ပြန်ဖြတ်မည် · အမြင့်ဆုံး ကန့်သတ်ချက် ရှိသည်',
    ]},
    {e:'⭐',h:'ကြယ်ပွင့် & အလုပ်ဆက်ရရန်',s:[
      'အလုပ်ပြီးလျှင် ဆိုင်က ကြယ်ပေးသည် — ပျမ်းမျှကို “👤 ကျွန်ုပ်” တွင် ကြည့်ပါ',
      'လက်ခံပြီး မလာပါက ဆိုင်က နောက်ထပ် အလုပ် မပေးတော့နိုင်',
      'မလုပ်နိုင်ပါက အစကတည်းက “ငြင်း” နှိပ်ပါ — အခြားသူဆီ ချက်ချင်း သွားမည်',
      'ဘာသာစကားကို ညာဘက်အပေါ် TH / MY / KH တွင် ပြောင်းနိုင်',
    ]},
  ]},
  kh:{title:'មគ្គុទ្ទេសក៍ប្រើប្រាស់',sub:'ចុចលើប្រធានបទ',close:'បិទ',topics:[
    {e:'🚀',h:'ចាប់ផ្តើម — ទទួលការងារបានភ្លាម',s:[
      'មិនត្រូវការផ្ទុកអត្តសញ្ញាណប័ណ្ណ/បណ្ណបើកបរ · មិនបាច់រង់ចាំការអនុម័ត',
      'ទៅផ្ទាំង “🎚️ ប៊ូតុង” ហើយជ្រើសស្ថានភាព ១ ក្នុងចំណោម ៣ (ប្តូរពេលក្រោយបាន)',
      'ក្នុងក្រុមតែប៉ុណ្ណោះ = ទទួលតែការងារពីប្រធានក្រុម · មិនកាត់កម្រៃ',
      'ក្នុងក្រុម + ការងារក្រៅ = ទទួលបានទាំងពីរ (ការងារក្រៅកាត់ {comm}%)',
      'ឯករាជ្យសុទ្ធ = គ្មានក្រុម · មិនកាត់អ្វីទេ · ប៉ុន្តែគ្មានការការពារពីក្រុម',
    ]},
    {e:'🎚️',h:'ប៊ូតុង ២',s:[
      '🟢 ការងារផ្សារ = ការងារដែលប្រធានក្រុមផ្ញើមក',
      '🔵 ការងារក្រៅ = ការងារពីគ្រប់ផ្សារ · អ្នកចុចទទួលដោយខ្លួនឯង',
      'ប្រធានក្រុមឃើញតែ “រួចរាល់/មិនទាន់” សម្រាប់ការងារផ្សារ · មិនឃើញការងារក្រៅទាល់តែសោះ',
      'គួរធីក “🔒 ចាក់សោមិនឱ្យជាន់គ្នា” — ទទួលម្តងមួយ',
    ]},
    {e:'⏰',h:'របៀបម៉ោង',s:[
      'ជ្រើស “ស្វ័យប្រវត្តិ” រួចកំណត់ម៉ោងការងារផ្សារ (ឧ. ០៤:០០–០៨:០០)',
      'ក្នុងម៉ោងនោះ = បើកការងារផ្សារ · ផុតម៉ោង = ប្តូរទៅការងារក្រៅដោយស្វ័យប្រវត្តិ',
      'តារាងនេះជាឯកជន · ប្រធានក្រុមមិនឃើញ',
      'បើចង់គ្រប់គ្រងខ្លួនឯង ជ្រើស “ដោយដៃ”',
    ]},
    {e:'🟢',h:'ទទួលការងារផ្សារ',s:[
      'កាតពណ៌បៃតងលេចឡើងក្នុងផ្ទាំង “🧾 ការងារ” — ឆ្លើយក្នុង ៦០ វិនាទី',
      'មើលឈ្នួល និងកម្រៃដែលកាត់ រួចចុច 🟢 ទទួល ឬ 🔴 បដិសេធ (បញ្ជូនទៅអ្នកបន្ទាប់)',
      'ទៅដល់កន្លែង រួចចុច “មកដល់ · ចាប់ផ្តើម”',
      'ធ្វើរួច អ្នកលក់ចុចបញ្ចប់ ហើយប្រគល់ប្រាក់សុទ្ធជូនអ្នកនៅនឹងកន្លែង',
    ]},
    {e:'🔵',h:'ទទួលការងារក្រៅ',s:[
      'បើកប៊ូតុង 🔵 រួចចុច “📍 ចែករំលែកទីតាំង” ដើម្បីឃើញការងារជិតៗ',
      'អានប្រភេទការងារ ហាង ផ្សារ ឈ្នួល និងកម្រៃ រួចចុច “ទទួល”',
      'ទទួលបានម្តងមួយ — បញ្ចប់ការងារចាស់សិន ទើបឃើញការងារថ្មី',
      'ធ្វើរួច ទទួលប្រាក់សុទ្ធ រួចចុច “ទទួលប្រាក់ · បញ្ចប់”',
    ]},
    {e:'💵',h:'ប្រាក់ — ទទួលផ្ទាល់ដៃ',s:[
      'ប្រព័ន្ធមិនកាន់ប្រាក់អ្នកទេ · ហាង/អតិថិជនបង់ផ្ទាល់ពេលបញ្ចប់ការងារ',
      'គ្មានថ្លៃចុះឈ្មោះ គ្មានប្រាក់កក់ · បើមានអ្នកសុំលុយ នោះមិនមែនយើងទេ',
      'បើ “ក្នុងក្រុម + ការងារក្រៅ”: ការងារក្រៅកាត់ {comm}% (យ៉ាងតិច {floor} ក្នុងមួយវិក្កយបត្រ)',
      'ការងារផ្សារកាត់តាមអត្រាដែលប្រធានក្រុមកំណត់ — លេខបង្ហាញលើកាតជានិច្ចមុនចុចទទួល',
    ]},
    {e:'📅',h:'ការងារប្រចាំ & សុំប្រាក់មុន',s:[
      'ផ្ទាំង “👤 ខ្ញុំ” បង្ហាញការងារដែលប្រធានក្រុមរៀបចំទុកជាមុន (ថ្ងៃ ម៉ោង ហាង)',
      'មើលប្រាក់បានសរុប ប្រាក់រង់ចាំ និងបំណុលសុំមុន នៅទំព័រតែមួយ',
      'បើក្រុមអនុញ្ញាត ចុច “💵 សុំប្រាក់មុន” បញ្ចូលចំនួន រួចរង់ចាំការអនុម័ត',
      'ប្រាក់ដែលសុំមុននឹងកាត់ពីការងារបន្តបន្ទាប់ · មានកម្រិតកំណត់',
    ]},
    {e:'⭐',h:'ផ្កាយ & រក្សាការងារ',s:[
      'ហាងឱ្យផ្កាយបន្ទាប់ពីបញ្ចប់ការងារ — មើលមធ្យមភាគក្នុងផ្ទាំង “👤 ខ្ញុំ”',
      'ទទួលហើយមិនទៅ ហាងអាចលែងផ្ញើការងារឱ្យអ្នកទៀត',
      'បើទៅមិនបាន ចុច “បដិសេធ” តាំងពីដំបូង — ការងារនឹងទៅអ្នកផ្សេងភ្លាម',
      'ប្តូរភាសាបានត្រង់ TH / MY / KH ជ្រុងខាងស្តាំខាងលើ',
    ]},
  ]},
};

function WorkerHelp({lang,commPct,floorTxt,onClose}){
  const [open,setOpen]=useState(0);
  const H=WK_HELP[lang]||WK_HELP.th;
  const fill=(s)=>s.replace('{comm}',commPct).replace('{floor}',floorTxt);
  return <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mh">📖 {H.title}</div>
    <p className="mp">{H.sub}</p>
    {H.topics.map((tp,i)=>{const on=open===i;
      return <div key={i} className="card" style={{padding:0,overflow:'hidden'}}>
        <div onClick={()=>setOpen(on?-1:i)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 13px',cursor:'pointer'}}>
          <span style={{fontSize:21}}>{tp.e}</span>
          <b style={{flex:1,fontSize:13.5,lineHeight:1.35}}>{fill(tp.h)}</b>
          <span style={{color:'var(--ink-3)',fontSize:13,transform:on?'rotate(90deg)':'none',transition:'transform .2s'}}>›</span>
        </div>
        {on&&<div style={{padding:'0 13px 12px 44px'}}>
          {tp.s.map((st,si)=><div key={si} style={{display:'flex',gap:9,marginBottom:7}}>
            <span style={{flex:'0 0 auto',width:18,height:18,borderRadius:9,background:'var(--brand-soft)',color:'var(--brand)',fontSize:10.5,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{si+1}</span>
            <span style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.5}}>{fill(st)}</span>
          </div>)}
        </div>}
      </div>;})}
    <button className="btn ghost" onClick={onClose}>{H.close}</button>
  </div></div>;
}

/* งานนอก (open pool · GPS · ผูก backend จริงถ้ามี) */
function OutsidePool({w,st,up,flash,t}){
  const [loc,setLoc]=useState(null),[busy,setBusy]=useState(false);
  const mine=st.openPool.find(j=>j.worker===MEW&&j.status!=='done');
  const share=async()=>{ setBusy(true); const l=await lw2geo(); setLoc(l);
    if(window.PLAT_API){try{await PLAT_API.poolWorker({id:MEW,name:w.name,available:true,lat:l.lat,lng:l.lng,lang:w.lang},'pool');}catch(e){}}
    setBusy(false); };
  const take=(j)=>{ up(s=>{const x=s.openPool.find(o=>o.id===j.id);if(x){x.status='accepted';x.worker=MEW;}}); flash('รับงานนอกแล้ว · หัวคิวไม่เห็นงานนี้'); };
  const cash=(j)=>{ up(s=>{const x=s.openPool.find(o=>o.id===j.id);if(x){x.status='done';x.paidAt=Date.now();
    if(w.status==='both'&&w.win_id){ const c=winComm(x.pay,(s.wins.find(v=>v.id===w.win_id)||{}).commRate); x.comm=c; const wn=s.wins.find(v=>v.id===w.win_id); if(wn)wn.gp+=c; }}}); flash('รับเงินแล้ว · หัก'+t.comm); };
  const open=st.openPool.filter(j=>j.status==='open');
  if(mine){ const d=jobDef(mine.type); const c=w.status==='both'?winComm(mine.pay,(st.wins.find(v=>v.id===w.win_id)||{}).commRate):0;
    return <div className="jobc" style={{border:'2px solid var(--blue)'}}>
      <div className="jt"><span className="e">{d.e}</span><div><b>{d.th}</b><div className="my">{mine.shopName}</div></div><span className="tag" style={{marginLeft:'auto',background:'var(--blue-soft)',color:'var(--blue)'}}>{mine.status==='accepted'?t.going:t.working}</span></div>
      <div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.wage}</span><b>{B(mine.pay)}</b></div>
      {c>0&&<div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.comm}</span><span style={{color:'var(--red)'}}>-{B(c)}</span></div>}
      {c>0&&<div className="rowb"><b>{t.net}</b><b style={{color:'var(--brand)'}}>{B(mine.pay-c)}</b></div>}
      <button className="btn" style={{background:'var(--blue)'}} onClick={()=>cash(mine)}>{t.getcash} · จบงาน</button>
    </div>;
  }
  return <>
    <div className="rowb card" style={{borderLeft:'3px solid var(--blue)'}}><b>🔵 {t.outside}</b><span style={{fontSize:11,color:'var(--ink-3)'}}>หัวคิวไม่เห็น 🙈</span></div>
    {!loc&&<button className="btn ghost" onClick={share} disabled={busy}>{busy?'กำลังหาพิกัด…':'📍 แชร์พิกัด · ดูงานทุกตลาดในรัศมี'}</button>}
    {open.length===0&&<Empty>ยังไม่มีงานนอกตอนนี้<br/>ให้ร้าน (แท็บแม่ค้า) กด “ลงงานนอก / open pool”</Empty>}
    {open.map(j=>{const d=jobDef(j.type);const c=w.status==='both'?winComm(j.pay,(st.wins.find(v=>v.id===w.win_id)||{}).commRate):0;const mk=st.markets.find(m=>m.id===j.market_id);
      return <div className="jobc" key={j.id} style={{border:'2px solid var(--blue)'}}>
        <div className="jt"><span className="e">{d.e}</span><div><b>{d.th}</b><div className="my">{j.shopName} · {mk?mk.name:'—'}</div></div></div>
        <div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.wage}</span><b style={{fontSize:19,color:'var(--brand)'}}>{B(j.pay)}</b></div>
        {c>0&&<div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.comm} ({Math.round(((st.wins.find(v=>v.id===w.win_id)||{}).commRate||COMM_DEFAULT)*100)}%)</span><span style={{color:'var(--red)'}}>-{B(c)}</span></div>}
        <button className="btn" style={{background:'var(--blue)'}} onClick={()=>take(j)}>🔵 {t.take}</button>
      </div>;})}
  </>;
}

function Worker({st,up,flash}){
  const w=st.workers.find(x=>x.id===MEW);
  const [lang,setLang]=useState(w.lang||'th');
  const [tab,setTab]=useState('jobs');
  const [terms,setTerms]=useState(false);
  const [help,setHelp]=useState(false);
  const t=WORKER_T[lang];
  const nowStr=HHMM();
  const eff=effSwitches(w,nowStr);
  const win=st.wins.find(v=>v.id===w.win_id);
  const wset=win?winSet(win):DEF_SET;
  const outsideBlocked=win&&!wset.outsideOn&&w.status!=='free';
  if(outsideBlocked)eff.outside=false;
  const disp=win?wset.dispatch:'auto';
  const setW=(patch)=>up(s=>{Object.assign(s.workers.find(x=>x.id===MEW),patch);});
  const toggleMarket=()=>{ if(w.timeMode==='auto')return; setW({marketOn:!w.marketOn, ...(w.lockOverlap&&!w.marketOn?{outsideOn:false}:{})}); };
  const toggleOutside=()=>{ if(w.timeMode==='auto'||w.status==='win'||w.status==='free'||outsideBlocked)return;
    if(!w.outsideOn&&!w.acceptedTerms){ setTerms(true); return; }
    setW({outsideOn:!w.outsideOn, ...(w.lockOverlap&&!w.outsideOn?{marketOn:false}:{})}); };
  const agreeTerms=()=>{ setTerms(false); setW({acceptedTerms:true,outsideOn:true, ...(w.lockOverlap?{marketOn:false}:{})}); flash('เปิดงานนอกแล้ว'); };
  const reqAdvance=()=>{ const s=prompt('ขอเบิกล่วงหน้าเท่าไร? (เพดาน '+B(wset.advanceCap)+' · หนี้เดิม '+B(w.debt)+')'); const amt=Math.round(Number(s)); if(!amt||amt<=0)return; if(w.debt+amt>wset.advanceCap){flash('เกินเพดานเบิก');return;} setW({advanceReq:amt}); flash('ส่งคำขอเบิกให้หัวหน้าวินแล้ว'); };

  /* งานในวิน */
  const bl=Object.values(st.shopPrefs||{}).some(p=>(p.blacklist||[]).includes(MEW));
  const offers=st.winQueue.filter(j=>j.win_id===w.win_id&&j.status==='queued'&&(j.assignTo?j.assignTo===MEW:disp==='auto')&&!(bl&&j.shopName===MESHOP.name));
  const myRoster=st.roster.filter(r=>r.assigned===MEW);
  const myInst=(st.rosterInstances||[]).filter(x=>x.assigned===MEW).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.time<b.time?-1:1));
  const myStars=avgStars(w);
  const headPct=Math.round(headCutOf(win)*100);
  const mineWin=st.winQueue.find(j=>j.worker===MEW&&(j.status==='accepted'||j.status==='working'));
  const accept=(id)=>{ up(s=>{const j=s.winQueue.find(x=>x.id===id);if(j){j.status='accepted';j.worker=MEW;}}); flash('รับงานในตลาดแล้ว'); };
  const reject=(id)=>{ up(s=>{const j=s.winQueue.find(x=>x.id===id);if(j){j.status='queued';j.rejected=true;}}); flash('ส่งงานให้คิวถัดไป'); };
  const arrive=(id)=>{ up(s=>{const j=s.winQueue.find(x=>x.id===id);if(j)j.status='working';}); };

  const langBar=<div className="lang">{['th','my','kh'].map(l=><b key={l} className={lang===l?'on':''} onClick={()=>{setLang(l);setW({lang:l});}}>{l.toUpperCase()}</b>)}<b onClick={()=>setHelp(true)} title={(WK_HELP[lang]||WK_HELP.th).title}>📖</b></div>;
  const helpModal=help&&<WorkerHelp lang={lang} commPct={Math.round(((win&&win.commRate)||COMM_DEFAULT)*100)} floorTxt={B(COMM_FLOOR)} onClose={()=>setHelp(false)}/>;

  if(mineWin){ const d=jobDef(mineWin.type);
    return <><Hd bg="var(--green)" s1={(win?win.dot+' '+win.name:'')+' · '+w.name} s2={mineWin.status==='accepted'?t.going+' '+st.lock:t.working}>{langBar}</Hd>
      <div className="body"><div className="status">
        <div className="big">{mineWin.status==='accepted'?'🗺️':'💪'}</div>
        <div className="t">{d.e} {d.th} · {B(mineWin.price)}</div>
        <div className="card" style={{width:'100%'}}>{t.lock} <b>{st.lock}</b> · แผนที่จำลอง</div>
        {mineWin.status==='accepted'?<button className="btn" style={{background:'var(--green)'}} onClick={()=>arrive(mineWin.id)}>ถึงแล้ว · เริ่มงาน</button>
          :<div className="s">{t.getcash} {B(mineWin.price)} — รอแม่ค้ากดจบงาน</div>}
      </div>{helpModal}</div></>;
  }

  return <><Hd bg="#1f2a24" s1={(win?win.dot+' '+win.name:'ฟรีแลนซ์')+' · '+w.name} s2={WK_STATUS[w.status].th}>{langBar}</Hd>
    <div className="body">
      <Seg items={[['jobs','🧾 งาน'],['sw','🎚️ สวิตช์'],['deals','🎁 ดีล'],['me','👤 ฉัน']]} val={tab} set={setTab}/>
      {tab==='deals'?(window.KDSponsorFeed?<window.KDSponsorFeed mod="labor" limit={6} title="🎁 ดีลใกล้คุณ"/>:<div className="card" style={{fontSize:12.5,color:'var(--ink-3)'}}>ยังไม่มีดีลตอนนี้</div>):tab==='sw'?<>
        <div className="lbl">2 สวิตช์อิสระ (หัวคิวเห็นแค่ “พร้อม/ไม่พร้อม” งานตลาด · งานนอกไม่เห็นเลย)</div>
        <WkSwitch on={eff.market} disabled={w.timeMode==='auto'} color="var(--green)" emoji="🟢" title={t.market} sub={eff.market?t.ready:t.notready} onToggle={toggleMarket}/>
        <WkSwitch on={eff.outside} disabled={w.timeMode==='auto'||w.status==='win'||w.status==='free'||outsideBlocked} color="var(--blue)" emoji="🔵" title={t.outside} sub={outsideBlocked?'หัวหน้าวินปิดงานนอก':w.status==='win'?'ปิด (สังกัดวินอย่างเดียว)':(eff.outside?'เปิด':'ปิด')} onToggle={toggleOutside}/>
        <div className="lbl" style={{marginTop:4}}>โหมดเวลา (ส่วนตัว · หัวคิวไม่เห็น)</div>
        <Seg items={[['auto',t.timeauto],['manual',t.timeman]]} val={w.timeMode} set={(m)=>setW({timeMode:m})}/>
        {w.timeMode==='auto'&&<div className="card" style={{fontSize:13}}>
          <div className="rowb"><span>ช่วงงานตลาด</span><span><input className="tin" type="time" value={w.schedFrom||'04:00'} onChange={e=>setW({schedFrom:e.target.value})}/> – <input className="tin" type="time" value={w.schedTo||'08:00'} onChange={e=>setW({schedTo:e.target.value})}/></span></div>
          <div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:6}}>ในช่วง = งานตลาดเปิด/งานนอกปิด · พ้นช่วง = งานนอกเปิด · ตอนนี้ {nowStr} → {eff.market?'🟢 งานตลาด':'🔵 งานนอก'}</div>
        </div>}
        <label className="ckrow"><input type="checkbox" checked={!!w.lockOverlap} onChange={e=>setW({lockOverlap:e.target.checked})}/> 🔒 ล็อกไม่ให้ซ้อน (เปิดได้ทีละงาน · แนะนำ)</label>
        <div className="lbl" style={{marginTop:4}}>สถานะแรงงาน</div>
        <div className="paysel">{Object.entries(WK_STATUS).map(([k,v])=><div key={k} className={'p'+(w.status===k?' on':'')} onClick={()=>setW({status:k})}>
          <div><b style={{fontSize:13.5}}>{v.th}{v.badge&&<span className="mini">{v.badge}</span>}</b><div style={{fontSize:11.5,color:'var(--ink-3)'}}>{v.s}</div></div><span className="r"></span></div>)}</div>
      </>:tab==='me'?<>
        {/* ประกาศรับสมัครไรเดอร์แพลตฟอร์ม — คนละระบบกับวิน (ไม่ผูกวิน ไม่หักค่าคอม ไม่แชร์ข้อมูลกัน)
            หน้านี้แค่เปิดช่องให้แรงงานเห็นว่ามีงานอีกทางหนึ่งให้สมัคร */}
        <a href="Rider Signup.html" style={{textDecoration:'none',color:'inherit'}}>
          <div className="card" style={{display:'flex',alignItems:'center',gap:11,borderLeft:'3px solid var(--blue)'}}>
            <span style={{fontSize:24}}>🛵</span>
            <div style={{flex:1,minWidth:0}}>
              <b style={{fontSize:14}}>รับสมัครไรเดอร์ :Done KaiDee</b>
              <div style={{fontSize:11.5,color:'var(--ink-3)',lineHeight:1.45,marginTop:2}}>งานส่งอาหารจากร้านบนแพลตฟอร์ม · คนละระบบกับวิน ไม่หักค่าคอมหัวคิว · ต้องส่งเอกสารและรอตรวจ</div>
            </div>
            <span style={{color:'var(--ink-3)',fontSize:16}}>›</span>
          </div>
        </a>
        <div className="card"><div className="rowb"><b>👤 {w.name}</b><span className="mini2">{win?win.dot+' '+win.name:'ฟรีแลนซ์'}</span></div>
          <div className="rowb" style={{marginTop:4}}><span style={{fontSize:12,color:'var(--ink-3)'}}>สถานะ: {WK_STATUS[w.status].th}</span>{myStars>0?<span style={{fontSize:12}}><StarRow v={myStars}/> {myStars.toFixed(1)} <span style={{color:'var(--ink-3)'}}>({(w.ratings||[]).length})</span></span>:<span style={{fontSize:11.5,color:'var(--ink-3)'}}>ยังไม่มีรีวิว</span>}</div></div>
        <div className="lbl">รายได้</div>
        <div className="row">
          <div className="card" style={{flex:1,textAlign:'center'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>จ่ายสะสม</div><b style={{fontSize:17,color:'var(--brand)'}}>{B(w.paidTotal)}</b></div>
          <div className="card" style={{flex:1,textAlign:'center'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>รอรับ</div><b style={{fontSize:17,color:'var(--gold)'}}>{B(w.pending)}</b></div>
          <div className="card" style={{flex:1,textAlign:'center'}}><div style={{fontSize:11,color:'var(--ink-3)'}}>ค้างเบิก</div><b style={{fontSize:17,color:w.debt>0?'var(--red)':'var(--ink-3)'}}>{B(w.debt)}</b></div>
        </div>
        {wset.advanceOn&&w.status!=='free'&&(w.advanceReq>0?<div className="tag q" style={{display:'block',textAlign:'center',padding:'10px'}}>⏳ ขอเบิก {B(w.advanceReq)} — รอหัวหน้าวินอนุมัติ</div>
          :<button className="btn gold" onClick={reqAdvance} disabled={w.debt>=wset.advanceCap}>{w.debt>=wset.advanceCap?'เต็มเพดานเบิกแล้ว':'💵 ขอเบิกล่วงหน้า'}</button>)}
        <div className="lbl" style={{marginTop:4}}>งานประจำของฉัน (รู้ล่วงหน้า)</div>
        {myInst.length>0?myInst.map(r=>{const d=jobDef(r.type);return <div className="jobc" key={r.id} style={{borderLeft:'3px solid var(--green)'}}>
          <div className="jt"><span className="e">{d.e}</span><div><b>{instLabel(r.date)} · {r.time} น.</b><div className="my">{d.th} · {r.shop}</div></div><span className="tag free" style={{marginLeft:'auto'}}>📅 นัดแล้ว</span></div></div>;})
          :myRoster.length===0?<Empty>ยังไม่มีงานประจำที่ถูกมอบหมาย<br/>หัวหน้าวินจัดคนจากตารางร้าน</Empty>
          :myRoster.map(r=>{const d=jobDef(r.type);return <div className="jobc" key={r.id} style={{borderLeft:'3px solid var(--green)'}}>
            <div className="jt"><span className="e">{d.e}</span><div><b>{d.th} · {r.time} น.</b><div className="my">{r.shop} · {r.days.map(i=>DOW[i]).join(' ')}</div></div></div></div>;})}
      </>:<>
        {eff.market&&<>
          <div className="rowb card" style={{borderLeft:'3px solid var(--green)'}}><b>🟢 {t.market}</b><span className="tag free">{t.ready}</span></div>
          {offers.length===0&&<div className="status" style={{padding:'18px 0'}}><div className="big">⏳</div><div className="s">{t.waiting}<br/><span style={{fontSize:12}}>แตะแท็บ “แม่ค้า” เพื่อเรียกงานเข้าคิว</span></div></div>}
          {offers.map(j=>{const d=jobDef(j.type);const c=Math.round(j.price*headCutOf(win));
            return <div className="jobc" key={j.id} style={{border:'2px solid var(--green)'}}>
              <div className="jt"><span className="e">{d.e}</span><div><b>{d.th}</b><div className="my">{d[lang]||d.my}</div></div></div>
              <div className="rowb"><span style={{color:'var(--ink-3)'}}>{t.wage}</span><b style={{fontSize:19,color:'var(--brand)'}}>{B(j.price)}</b></div>
              <div className="rowb"><span style={{color:'var(--ink-3)'}}>ค่าคิววิน {headPct}%</span><span style={{color:'var(--red)'}}>-{B(c)}</span></div>
              <div className="timer">⏱️ {t.answer}</div>
              <div className="btn2"><div className="b" style={{background:'var(--red)'}} onClick={()=>reject(j.id)}>🔴 {t.reject}</div><div className="b" style={{background:'var(--green)'}} onClick={()=>accept(j.id)}>🟢 {t.accept}</div></div>
            </div>;})}
        </>}
        {eff.outside&&<div style={{marginTop:eff.market?6:0}}><OutsidePool w={w} st={st} up={up} flash={flash} t={t}/></div>}
        {!eff.market&&!eff.outside&&<Empty>ปิดรับงานทั้งหมด<br/>ไปแท็บ “สวิตช์/เวลา” เพื่อเปิด</Empty>}
      </>}
      {terms&&<TermsModal rate={(win&&win.commRate)||COMM_DEFAULT} onAgree={agreeTerms} onClose={()=>setTerms(false)}/>}
      {helpModal}
    </div></>;
}
window.Worker=Worker;
