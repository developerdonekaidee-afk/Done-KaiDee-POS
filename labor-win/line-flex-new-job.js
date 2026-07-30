/* ============================================================
 *  LABOR WIN — LINE Flex Message: แจ้งงานใหม่ให้แรงงาน
 *  พม่า (คู่) ไทย · ปุ่ม 🟢 รับงาน / 🔴 ไม่รับ
 *  ------------------------------------------------------------
 *  export ฟังก์ชันสร้าง bubble จากข้อมูลงาน (ใช้ใน labor-win-api.js)
 *  ตัวอย่าง JSON ที่ส่งออกจริงอยู่ท้ายไฟล์ (STATIC_SAMPLE)
 * ============================================================ */

const JOB_LABELS = {
  // job_type : [ไทย, พม่า, เขมร]
  unload: ['ยกของลงรถ', 'ကုန်ချ', 'ដឹកចុះ'],
  carry:  ['แบกของ', 'ကုန်သယ်', 'លីទំនិញ'],
  pack:   ['แพ็คของ', 'ထုပ်ပိုး', 'ខ្ចប់'],
};
const money = (satang) => '฿' + (satang / 100).toLocaleString('en-US');

/**
 * @param {object} job     row จากตาราง jobs (มี standard_price/commission_rate/job_type ...)
 * @param {object} worker  row จากตาราง workers (มี lang, wallet_balance ...)
 * @returns LINE Flex message object พร้อม push
 */
module.exports = function newJobFlex(job, worker) {
  const [th, my, km] = JOB_LABELS[job.job_type] || [job.job_type, job.job_type, job.job_type];
  const commission = Math.round(job.standard_price * job.commission_rate);
  const lang = worker.lang || 'my';
  const secondLine = lang === 'km' ? km : my;           // ภาษาที่ 2 ตามสัญชาติแรงงาน

  return {
    type: 'flex',
    altText: `งานใหม่ ${th} ${money(job.standard_price)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      // แถบหัว: เลขล็อกแผงใหญ่ + สีวิน (แรงงานอ่านเลขได้แม้ไม่คล่องภาษา)
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#F4900C',
        contents: [
          { type: 'text', text: '🔔 งานใหม่ / အလုပ်အသစ်', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'ล็อก ' + (job.stall_no || '—'), color: '#ffffff', size: 'xxl', weight: 'bold', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '18px',
        contents: [
          // ชนิดงาน 2 ภาษา + ไอคอนใหญ่
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '📦', size: 'xxl', flex: 0 },
            { type: 'box', layout: 'vertical', margin: 'md', contents: [
              { type: 'text', text: th, weight: 'bold', size: 'xl', color: '#1A1A1A' },
              { type: 'text', text: secondLine, size: 'lg', color: '#666666' },
            ]},
          ]},
          { type: 'separator', margin: 'lg' },
          // ราคากลาง (จ่ายสด) — ตัวเลขใหญ่ อ่านง่าย
          { type: 'box', layout: 'horizontal', margin: 'lg', contents: [
            { type: 'text', text: 'ค่าแรง / လုပ်ခ', size: 'md', color: '#888888', flex: 3, gravity: 'center' },
            { type: 'text', text: money(job.standard_price), size: 'xxl', weight: 'bold', color: '#0E9C6B', align: 'end', flex: 4 },
          ]},
          // ค่าหัวคิวที่จะถูกหักจาก wallet (โปร่งใส)
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'หักค่าคิว / ကော်မရှင်', size: 'sm', color: '#B0B0B0', flex: 3, gravity: 'center' },
            { type: 'text', text: '-' + money(commission), size: 'md', color: '#C0392B', align: 'end', flex: 4 },
          ]},
          { type: 'text', text: '⏱️ ตอบใน 60 วิ / ၆၀ စက္ကန့်', size: 'xs', color: '#F4900C', align: 'center', margin: 'lg', weight: 'bold' },
        ],
      },
      // ปุ่มเขียว รับ / แดง ไม่รับ (postback ไป webhook → /accept , /decline)
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '14px',
        contents: [
          { type: 'button', style: 'primary', color: '#C0392B', height: 'md',
            action: { type: 'postback', label: '🔴 ไม่รับ',
              data: `action=decline&job=${job.job_id}&worker=${worker.worker_id}`,
              displayText: 'ไม่รับงาน' } },
          { type: 'button', style: 'primary', color: '#1DB954', height: 'md',
            action: { type: 'postback', label: '🟢 รับงาน',
              data: `action=accept&job=${job.job_id}&worker=${worker.worker_id}`,
              displayText: 'รับงาน' } },
        ],
      },
    },
  };
};

/* ---- ตัวอย่าง JSON ที่ push จริง (สำหรับ copy ไปทดสอบใน LINE Flex Simulator) ----
{
  "type": "flex",
  "altText": "งานใหม่ ยกของลงรถ ฿120",
  "contents": {
    "type": "bubble", "size": "mega",
    "header": { "type": "box", "layout": "vertical", "paddingAll": "16px", "backgroundColor": "#F4900C",
      "contents": [
        { "type": "text", "text": "🔔 งานใหม่ / အလုပ်အသစ်", "color": "#ffffff", "weight": "bold", "size": "lg" },
        { "type": "text", "text": "ล็อก A-12", "color": "#ffffff", "size": "xxl", "weight": "bold", "margin": "sm" }
      ] },
    "body": { "type": "box", "layout": "vertical", "spacing": "md", "paddingAll": "18px",
      "contents": [
        { "type": "box", "layout": "horizontal", "contents": [
          { "type": "text", "text": "📦", "size": "xxl", "flex": 0 },
          { "type": "box", "layout": "vertical", "margin": "md", "contents": [
            { "type": "text", "text": "ยกของลงรถ", "weight": "bold", "size": "xl", "color": "#1A1A1A" },
            { "type": "text", "text": "ကုန်ချ", "size": "lg", "color": "#666666" }
          ] }
        ] },
        { "type": "separator", "margin": "lg" },
        { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
          { "type": "text", "text": "ค่าแรง / လုပ်ခ", "size": "md", "color": "#888888", "flex": 3, "gravity": "center" },
          { "type": "text", "text": "฿120", "size": "xxl", "weight": "bold", "color": "#0E9C6B", "align": "end", "flex": 4 }
        ] },
        { "type": "box", "layout": "horizontal", "contents": [
          { "type": "text", "text": "หักค่าคิว / ကော်မရှင်", "size": "sm", "color": "#B0B0B0", "flex": 3, "gravity": "center" },
          { "type": "text", "text": "-฿12", "size": "md", "color": "#C0392B", "align": "end", "flex": 4 }
        ] },
        { "type": "text", "text": "⏱️ ตอบใน 60 วิ / ၆၀ စက္ကန့်", "size": "xs", "color": "#F4900C", "align": "center", "margin": "lg", "weight": "bold" }
      ] },
    "footer": { "type": "box", "layout": "horizontal", "spacing": "md", "paddingAll": "14px",
      "contents": [
        { "type": "button", "style": "primary", "color": "#C0392B", "height": "md",
          "action": { "type": "postback", "label": "🔴 ไม่รับ", "data": "action=decline&job=JOB_9f2a&worker=WKR_31c", "displayText": "ไม่รับงาน" } },
        { "type": "button", "style": "primary", "color": "#1DB954", "height": "md",
          "action": { "type": "postback", "label": "🟢 รับงาน", "data": "action=accept&job=JOB_9f2a&worker=WKR_31c", "displayText": "รับงาน" } }
      ] }
  }
}
---------------------------------------------------------------- */
