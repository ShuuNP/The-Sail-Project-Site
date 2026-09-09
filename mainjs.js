const pages = document.querySelectorAll('.page');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const dotsWrap = document.getElementById('dots');
const stepLabel = document.getElementById('stepLabel');
const boxContent = document.querySelector('.box-content');
const boatWrap = document.querySelector('.boat-wrap');
const formError = document.getElementById('formError');
const boxTabs = document.querySelectorAll('.box-tab');
let current = 0;
const total = pages.length;
const APPLICATION_PAGE_INDEX = 3; // "Tell me about your song" page

// Fields required before the application can be sent, each with the wrapper
// element (.field / .checkline) that gets the invalid highlight.
const requiredFields = [
  { input: () => document.getElementById('name'), wrap: () => document.getElementById('name').closest('.field') },
  { input: () => document.getElementById('contact'), wrap: () => document.getElementById('contact').closest('.field') },
  { input: () => document.getElementById('idea'), wrap: () => document.getElementById('idea').closest('.field') },
  { input: () => document.getElementById('agree'), wrap: () => document.getElementById('agree').closest('.checkline'), isCheckbox: true }
];

// Your Cloudflare Worker — it receives the application data and forwards it
// (to Discord, email, wherever you wired it up on the worker side).
const API_URL = 'https://sail-project-api.alostlamb01.workers.dev';

// ⚠️ EmailJS fallback — only used if the worker call fails.
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
  boxTabs.forEach((t)=> t.classList.toggle('active', Number(t.dataset.pageIndex) === current));
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

function clearFieldError(field){
  const wrap = field.wrap();
  if(wrap) wrap.classList.remove('invalid');
}

function validateForm(){
  let firstInvalid = null;
  let allValid = true;

  requiredFields.forEach((field)=>{
    const el = field.input();
    const wrap = field.wrap();
    const filled = field.isCheckbox ? el.checked : el.value.trim().length > 0;

    if(wrap) wrap.classList.toggle('invalid', !filled);
    if(!filled){
      allValid = false;
      if(!firstInvalid) firstInvalid = el;
    }
  });

  formError.style.display = allValid ? 'none' : 'block';

  if(firstInvalid){
    firstInvalid.focus({ preventScroll: false });
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return allValid;
}

// Clear a field's highlight as soon as the person fixes it — no need to
// resubmit before finding out it's okay now.
requiredFields.forEach((field)=>{
  const el = field.input();
  const evt = field.isCheckbox ? 'change' : 'input';
  el.addEventListener(evt, ()=>{
    const filled = field.isCheckbox ? el.checked : el.value.trim().length > 0;
    if(filled) clearFieldError(field);
  });
});

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

async function sendToApi(data){
  if(!API_URL || API_URL.includes('PASTE_YOUR')){
    console.warn('API URL not set — skipping send.');
    return false;
  }
  try{
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.ok; // a bad worker route/error gives non-2xx, not a thrown error
  }catch(err){
    console.error('Worker API send failed:', err);
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



nextBtn.addEventListener('click', async () => {

  // If this is the final/application page
  if(current === total - 1){

    // Validate before doing anything else
    if(!validateForm()){

      // Make absolutely sure we're back on the application page
      goTo(APPLICATION_PAGE_INDEX);

      return;
    }

    // Only disable AFTER validation succeeds
    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending…';

    const data = gatherFormData();

    const apiOk = await sendToApi(data);

    if(!apiOk){
      await sendFallbackEmail(data);
    }

    nextBtn.textContent = 'Sent — thank you!';

    boatWrap.classList.add('is-hidden');

    setTimeout(() => {
      window.location.href = 'thankyoupage.html';
    }, 3000);

    return;
  }

  // Normal navigation
  goTo(current + 1);
});



backBtn.addEventListener('click', ()=> goTo(current - 1));

// Tabs are always clickable — jumping around isn't gated by form validation,
// so no one gets stuck on a single page.
boxTabs.forEach((tab)=>{
  tab.addEventListener('click', ()=> goTo(Number(tab.dataset.pageIndex)));
});

updateUI();