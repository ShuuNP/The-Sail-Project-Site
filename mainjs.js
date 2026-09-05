const pages = document.querySelectorAll('.page');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const dotsWrap = document.getElementById('dots');
const stepLabel = document.getElementById('stepLabel');
const boxContent = document.querySelector('.box-content');
const boatWrap = document.querySelector('.boat-wrap');
const formError = document.getElementById('formError');
let current = 0;
const total = pages.length;
const APPLICATION_PAGE_INDEX = 3; // "Tell me about your song" page

// ⚠️ Paste your Discord webhook URL here (Server Settings → Integrations → Webhooks)
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1545684094644518984/eut_E-IU2B4d9An2tuhscA4ZUqeupzOApVMvwkF53CX8bHxqftqqXbtR-AAw25apUloa';

// ⚠️ EmailJS fallback — only used if the Discord webhook call fails.
// Sign up free at emailjs.com → Add an Email Service → Create a Template → get these 3 values from your dashboard.
const EMAILJS_PUBLIC_KEY  = 's-97b-AsdGChM--t3';
const EMAILJS_SERVICE_ID  = 'service_3r34mfs';
const EMAILJS_TEMPLATE_ID = 'template_ofk0wxs';

if(typeof emailjs !== 'undefined' && !EMAILJS_PUBLIC_KEY.includes('PASTE_YOUR')){
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

// Left→right sailing positions across the pages (in vw), keeping clear of the box edges
const boatPositions = [6, 24, 42, 60, 78];

for(let i=0;i<total;i++){
  const d = document.createElement('div');
  d.className = 'dot' + (i===0 ? ' active' : '');
  dotsWrap.appendChild(d);
}
const dots = document.querySelectorAll('.dot');

function updateUI(){
  pages.forEach((p,i)=> p.classList.toggle('active', i===current));
  dots.forEach((d,i)=> d.classList.toggle('active', i===current));
  backBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = current === total - 1 ? 'Send it off' : 'Next';
  stepLabel.textContent = `${current+1} / ${total}`;
  boxContent.scrollTop = 0;

  // Day → night palette shift, one stage per page
  document.body.className = `stage-${current}`;

  // Sail the boat further right as the pages progress
  boatWrap.style.left = boatPositions[current] + 'vw';
}

function goTo(index){
  if(index < 0 || index > total-1 || index === current) return;
  current = index;
  updateUI();
}

function validateForm(){
  const name = document.getElementById('name').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const idea = document.getElementById('idea').value.trim();
  const agree = document.getElementById('agree').checked;
  const valid = name && contact && idea && agree;
  formError.style.display = valid ? 'none' : 'block';
  return valid;
}

function gatherFormData(){
  return {
    name: document.getElementById('name').value.trim(),
    contact: document.getElementById('contact').value.trim(),
    concept: document.getElementById('concept').value.trim(),
    motivation: document.getElementById('motivation').value.trim(),
    idea: document.getElementById('idea').value.trim(),
    helpType: document.getElementById('help').value,
    agreedToTerms: document.getElementById('agree').checked,
    submittedAt: new Date().toISOString()
  };
}

async function sendToDiscord(data){
  if(!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('PASTE_YOUR')){
    console.warn('Discord webhook URL not set — skipping send.');
    return false;
  }
  const payload = {
    content: '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    embeds: [{
      title: `New application from ${data.name}` ,
      color: 0xE8622C,
      fields: [
        { name: 'Creator / Account', value: data.name || '—', inline: true },
        { name: 'Contact', value: data.contact || '—', inline: true },
        { name: 'Help needed', value: data.helpType || '—', inline: false },
        { name: 'Concept', value: (data.concept || '—').slice(0, 1000) },
        { name: 'Motivation', value: (data.motivation || '—').slice(0, 1000) },
        { name: 'Song idea', value: (data.idea || '—').slice(0, 1000) }
      ],
      timestamp: data.submittedAt
    }]
  };
  try{
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok; // Discord returns 204 on success — a bad webhook URL/permissions gives 4xx, not a thrown error
  }catch(err){
    console.error('Discord webhook send failed:', err);
    return false;
  }
}

async function sendFallbackEmail(data){
  if(typeof emailjs === 'undefined' || EMAILJS_PUBLIC_KEY.includes('PASTE_YOUR')){
    console.warn('EmailJS not configured — cannot send fallback email. Application data:', data);
    return false;
  }
  try{
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      name: data.name,
      contact: data.contact,
      concept: data.concept,
      motivation: data.motivation,
      idea: data.idea,
      helpType: data.helpType,
      agreedToTerms: data.agreedToTerms ? 'Yes' : 'No',
      submittedAt: data.submittedAt,
      raw_json: JSON.stringify(data, null, 2)
    });
    return true;
  }catch(err){
    console.error('EmailJS fallback send failed:', err);
    return false;
  }
}

nextBtn.addEventListener('click', async ()=>{
  if(current === APPLICATION_PAGE_INDEX && !validateForm()){
    return; // stop here, show the inline error, don't advance
  }

  if(current === total - 1){
    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending…';
    const data = gatherFormData();
    const discordOk = await sendToDiscord(data);
    if(!discordOk){
      await sendFallbackEmail(data); // Discord failed — fall back to email
    }
    nextBtn.textContent = 'Sent — thank you!';
    boatWrap.classList.add('is-hidden'); // the boat has sailed off
    setTimeout(()=>{ window.location.href = 'thankyoupage.html'; }, 3000);
    return;
  }
  goTo(current + 1);
});
backBtn.addEventListener('click', ()=> goTo(current - 1));

updateUI();