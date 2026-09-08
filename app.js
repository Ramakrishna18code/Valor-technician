const app = document.querySelector('#app');

const paths = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  briefcase: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 12h16M10 12v2h4v-2"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>', alert: '<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4m0 3h.01"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z"/>', navigation: '<path d="m21 3-7 18-3.5-7.5L3 10l18-7Z"/><path d="m10.5 13.5 4-4"/>', phone: '<path d="M7 3H4c-1 0-2 .8-2 2 0 9.4 7.6 17 17 17 1.2 0 2-.8 2-2v-3l-5-1-1.4 2.2a13 13 0 0 1-8.8-8.8L8 8 7 3Z"/>',
  scan: '<path d="M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><path d="M8 9h3v3H8zM13 9h3M13 13h3v3h-3M8 14h3v2"/>', camera: '<path d="M4 8h3l1.4-2h7.2L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="3"/>',
  report: '<path d="M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5h5M8 12h8M8 16h8"/>', home: '<path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="M9 22v-6h6v6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', map: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
const visitData = [
  ['10:00 AM', 'Sunrise Apartments', 'Banjara Hills, Hyderabad', 'Lift #ELV-102 · AMC Visit', 'Assigned', 'assigned'],
  ['01:30 PM', 'Green Valley Towers', 'Kondapur, Hyderabad', 'Lift #ELV-205 · Door not closing', 'Pending', 'pending'],
  ['04:00 PM', 'Lake View Residency', 'Gachibowli, Hyderabad', 'Lift #ELV-309 · Routine Maintenance', 'Assigned', 'assigned']
];
function notice(text) { const node = document.querySelector('#toast'); node.textContent = text; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 1800); }
function action(label, symbol, tone) { return `<button class="quick-action ${tone}" data-notice="${label}">${icon(symbol)}<span>${label}</span></button>`; }
function render() {
  app.innerHTML = `<main class="app-shell">
    <header class="app-header"><button class="icon-button" data-notice="Menu">${icon('menu')}</button><div class="brand"><b><i>V</i>ALOR LIFTS</b><span>Service · Safety · People</span></div><div class="header-tools"><button class="icon-button notification" data-notice="3 unread notifications">${icon('bell')}<em>3</em></button><button class="avatar" data-notice="Ravi Kumar profile">RK</button></div></header>
    <section class="hero"><div class="hero-copy"><p>Good morning, Ravi</p><h1>Ready to keep<br><strong>lifts moving.</strong></h1><span>Safe lifts. Happier people.</span><button class="availability" data-notice="You are available"><i></i>Available <b>⌄</b></button></div><div class="hero-art" aria-hidden="true"><div class="tower"></div><div class="worker"><div></div></div><small>VALOR<br>LIFTS</small></div></section>
    <section class="screen-content">
      <div class="section-heading"><h2>Today at a glance</h2><button data-notice="Job summary">View jobs</button></div>
      <div class="metrics" aria-label="Job summary"><button class="metric blue" data-notice="4 assigned jobs">${icon('briefcase')}<b>4</b><span>Assigned</span></button><button class="metric amber" data-notice="2 pending jobs">${icon('clock')}<b>2</b><span>Pending</span></button><button class="metric green" data-notice="1 job in progress">${icon('gear')}<b>1</b><span>In progress</span></button><button class="metric purple" data-notice="3 completed jobs">${icon('check')}<b>3</b><span>Completed</span></button><button class="metric red" data-notice="1 emergency job">${icon('alert')}<b>1</b><span>Emergency</span></button></div>
      <section class="card schedule-card"><header><h2>${icon('calendar')}Today's schedule</h2><button data-notice="Full schedule">View all</button></header><div class="visits">${visitData.map((v, index) => `<article class="visit"><div class="visit-time"><i class="${index === 0 ? 'now' : ''}"></i><b>${v[0]}</b></div><div class="visit-detail"><h3>${v[1]}</h3><p>${icon('map')}${v[2]}</p><small>${v[3]}</small></div><span class="pill ${v[5]}">${v[4]}</span></article>`).join('')}</div></section>
      <section class="card quick-card"><header><h2>${icon('bolt')}Quick actions</h2></header><div class="quick-grid">${action('Navigate', 'navigation', 'mint')}${action('Call customer', 'phone', 'sky')}${action('Scan QR', 'scan', 'violet')}${action('Add photos', 'camera', 'rose')}${action('Service report', 'report', 'aqua')}</div></section>
      <section class="card recent-card"><header><h2>${icon('clock')}Recent job</h2><button data-notice="All recent jobs">View all</button></header><article><div class="recent-icon">${icon('briefcase')}</div><div><h3>Maple Heights</h3><p>${icon('map')}Madhapur, Hyderabad</p><small>Lift #ELV-110 · Panel issue</small></div><span class="pill complete">Completed</span></article></section>
    </section>
    <nav class="bottom-nav"><button class="active" data-notice="Home">${icon('home')}<span>Home</span></button><button data-notice="Jobs">${icon('briefcase')}<span>Jobs</span></button><button class="scan-fab" data-notice="Scan QR">${icon('scan')}</button><button data-notice="Schedule">${icon('calendar')}<span>Schedule</span></button><button class="notification" data-notice="Notifications">${icon('bell')}<em>3</em><span>Alerts</span></button><button data-notice="Profile">${icon('user')}<span>Profile</span></button></nav>
  </main>`;
  document.querySelectorAll('[data-notice]').forEach(button => button.addEventListener('click', () => notice(button.dataset.notice)));
}
function jobCard(job) {
  return `<article class="job-card ${job.tone}">
    <div class="job-thumb ${job.building}" aria-hidden="true"><img src="./assets/buildings/${job.building}.jpg" alt="" /></div>
    <div class="job-main"><div class="job-meta"><span>${job.ticket}</span><span class="job-status">${icon(job.icon)}${job.status}</span></div><h2>${job.name}</h2><p>${icon('map')}${job.location}</p><small>${icon('calendar')}${job.lift} <em></em> ${job.issue}</small></div>
    <aside><time>${job.time}</time><button class="chevron" data-notice="${job.name}">›</button><div><button class="call" data-notice="Calling ${job.name}">${icon('phone')}Call</button><button class="details" data-notice="Opening ${job.ticket}">View details</button></div></aside>
  </article>`;
}
function renderAssignedJobs() {
  const jobs = [
    {ticket:'#SR20260906-0015',name:'Sunrise Apartments',location:'Madhapur, Hyderabad',lift:'Lift #ELV-205',issue:'Passenger trapped inside',status:'Emergency',time:'Today, 09:30 AM',tone:'emergency',icon:'alert',building:'sunrise'},
    {ticket:'#SR20260906-0014',name:'Green Valley Towers',location:'Kondapur, Hyderabad',lift:'Lift #ELV-102',issue:'Door not closing properly',status:'Pending',time:'Today, 10:30 AM',tone:'pending',icon:'clock',building:'valley'},
    {ticket:'#SR20260906-0013',name:'Lake View Residency',location:'Gachibowli, Hyderabad',lift:'Lift #ELV-309',issue:'Routine Maintenance',status:'Assigned',time:'Today, 01:30 PM',tone:'assigned',icon:'briefcase',building:'lake'},
    {ticket:'#SR20260906-0012',name:'Maple Heights',location:'Nallagandla, Hyderabad',lift:'Lift #ELV-110',issue:'Panel issue',status:'In Progress',time:'Today, 03:00 PM',tone:'progress',icon:'gear',building:'maple'},
    {ticket:'#SR20260906-0011',name:'Sri Sai Enclave',location:'Miyapur, Hyderabad',lift:'Lift #ELV-008',issue:'AMC Visit',status:'Completed',time:'Today, 08:45 AM',tone:'completed',icon:'check',building:'sai'},
    {ticket:'#SR20260906-0010',name:'Vertex Corporate Park',location:'Hitech City, Hyderabad',lift:'Lift #ELV-501',issue:'Lift not starting',status:'Assigned',time:'Today, 05:00 PM',tone:'assigned',icon:'user',building:'vertex'}
  ];
  app.innerHTML = `<main class="jobs-screen"><header class="jobs-header"><div class="jobs-brand"><b><i>V</i>ALOR LIFTS</b><span>Service&nbsp; · &nbsp;Safety&nbsp; · &nbsp;People</span></div><div class="jobs-title"><h1>Assigned Jobs</h1><p>Your service requests</p></div><div class="jobs-tools"><button data-notice="Search jobs">${icon('clock')}</button><button data-notice="Filter jobs">${icon('alert')}</button></div></header><nav class="job-tabs" aria-label="Job filters"><button class="active" data-filter="All">All (8)</button><button>Pending (2)</button><button>Accepted (3)</button><button>In Progress (1)</button><button>Completed (2)</button></nav><section class="job-controls"><label>${icon('clock')}<input aria-label="Search jobs" placeholder="Search by ticket number, customer name or location..." /></label><button data-notice="Today’s jobs">${icon('calendar')}Today <b>⌄</b></button></section><section class="job-list">${jobs.map(jobCard).join('')}</section><nav class="jobs-bottom"><button data-notice="Home">${icon('home')}<span>Home</span></button><button class="active" data-notice="Jobs">${icon('briefcase')}<span>Jobs</span></button><button data-notice="Schedule">${icon('calendar')}<span>Schedule</span></button><button class="job-notification" data-notice="3 notifications">${icon('bell')}<i>3</i><span>Notifications</span></button><button data-notice="Profile">${icon('user')}<span>Profile</span></button></nav></main>`;
  document.querySelectorAll('[data-notice]').forEach(button => button.addEventListener('click', () => notice(button.dataset.notice)));
  document.querySelectorAll('.job-tabs button').forEach(tab => tab.addEventListener('click', () => { document.querySelector('.job-tabs .active').classList.remove('active'); tab.classList.add('active'); notice(`${tab.textContent} jobs`); }));
}
renderAssignedJobs();
