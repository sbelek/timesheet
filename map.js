/* © 2026 Sherkhan (github.com/sbelek). All rights reserved. See LICENSE.
   Выбор точки объекта на карте (OpenStreetMap / спутник Esri). */
(function () {
  const SM = window.SM; if (!SM) return;
  const $ = s => document.querySelector(s);
  const LCSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  const LJS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  let leafletP = null;
  const loadLeaflet = () => leafletP || (leafletP = new Promise((ok, no) => {
    if (window.L) return ok(window.L);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LCSS; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = LJS; s.onload = () => ok(window.L);
    s.onerror = () => { leafletP = null; no(new Error('Карта не загрузилась — нужен интернет')) }; document.head.appendChild(s);
  }));

  const css = document.createElement('style');
  css.textContent = `
  #mapBox{height:52dvh;min-height:300px;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#16181a}
  .mrow{display:flex;gap:8px;margin:8px 0}.mrow input{flex:1}.mrow button{flex:none}
  .seg2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
  .pinI{width:30px;height:30px;margin:-30px 0 0 -15px;position:relative}
  .pinI:before{content:"";position:absolute;left:3px;top:0;width:24px;height:24px;border-radius:50% 50% 50% 0;background:#ffc400;border:3px solid #1d1f21;transform:rotate(-45deg);box-shadow:0 2px 6px #0008}
  .edit-s{background:none;color:var(--mute);font-size:15px;min-height:40px;padding:0;margin-left:14px}
  .leaflet-container{font:13px Barlow,system-ui,sans-serif}`;
  document.head.appendChild(css);

  const dlg = document.createElement('dialog'); dlg.id = 'mdlg'; dlg.className = 'sheet'; document.body.appendChild(dlg);
  let map = null, marker = null, picked = null, layers = null;

  function open(opts) {
    // opts: {title, site?, onDone(result)}
    const s = opts.site;
    dlg.innerHTML = `<div class="sh-h"><button class="link" id="mX" type="button" autofocus>Отмена</button><b>${SM.esc(opts.title)}</b><button class="link y" id="mOk" type="button">Готово</button></div>
    <div class="sh-b">
      ${s ? `<label for="mName">Название</label><input id="mName" value="${SM.esc(s.name)}">` : ''}
      <div class="mrow"><input id="mQ" placeholder="Найти адрес на карте" enterkeyhint="search"><button class="sec sm" id="mFind" type="button">Найти</button></div>
      <div id="mapBox"><div class="empty" id="mLoad">Загружаю карту…</div></div>
      <div class="seg2"><button class="sm" id="mStreet" type="button">Схема</button><button class="sec sm" id="mSat" type="button">Спутник</button></div>
      <div class="seg2"><button class="sec sm" id="mMe" type="button">📍 Я здесь</button><span></span></div>
      <p class="addr" id="mHint">Нажмите на своё здание — там появится жёлтая метка. Метку можно перетащить.</p>
      <label for="mAddr">Адрес</label><input id="mAddr" value="${SM.esc(s ? s.addr || '' : $('#sAddr').value)}" placeholder="Заполнится сам после выбора точки">
    </div>`;
    picked = s && s.lat != null ? { lat: s.lat, lon: s.lon } : null;
    dlg.showModal();
    $('#mX').onclick = () => dlg.close();
    $('#mOk').onclick = () => {
      if (!picked) return SM.toast('Сначала отметьте точку на карте');
      const r = { lat: picked.lat, lon: picked.lon, addr: $('#mAddr').value.trim() };
      if (s) r.name = ($('#mName').value || '').trim() || s.name;
      dlg.close(); opts.onDone(r);
    };
    const find = async () => {
      const q = $('#mQ').value.trim(); if (!q) return;
      $('#mHint').textContent = 'Ищу…'; const p = await SM.fwdGeocode(q);
      if (!p) { $('#mHint').textContent = 'Адрес не найден. Попробуйте иначе или найдите здание на карте вручную.'; return }
      map && map.setView([p.lat, p.lon], 18); $('#mHint').textContent = 'Нашёл. Теперь нажмите на нужное здание.';
    };
    $('#mFind').onclick = find; $('#mQ').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); find() } };
    loadLeaflet().then(L => init(L, s)).catch(e => { $('#mLoad').textContent = e.message });
  }

  async function setPoint(L, lat, lon, fill) {
    picked = { lat, lon };
    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true, icon: L.divIcon({ className: '', html: '<div class="pinI"></div>', iconSize: [0, 0] }) }).addTo(map);
      marker.on('dragend', () => { const p = marker.getLatLng(); setPoint(L, p.lat, p.lng, true) });
    } else marker.setLatLng([lat, lon]);
    if (fill) {
      $('#mHint').textContent = 'Определяю адрес…';
      const a = await SM.geocode(lat, lon);
      if (a) $('#mAddr').value = a;
      $('#mHint').textContent = a ? 'Точка выбрана. Проверьте адрес и нажмите «Готово».' : 'Точка выбрана. Адрес не определился — впишите его сами.';
    }
  }

  async function init(L, s) {
    $('#mLoad') && $('#mLoad').remove();
    if (map) { map.remove(); map = null; marker = null }
    map = L.map('mapBox', { zoomControl: true, attributionControl: true });
    layers = {
      street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
      sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Maxar' })
    };
    layers.street.addTo(map);
    const setLayer = k => { Object.values(layers).forEach(l => map.removeLayer(l)); layers[k].addTo(map); $('#mStreet').className = k === 'street' ? 'sm' : 'sec sm'; $('#mSat').className = k === 'sat' ? 'sm' : 'sec sm' };
    $('#mStreet').onclick = () => setLayer('street'); $('#mSat').onclick = () => setLayer('sat');
    map.on('click', e => setPoint(L, e.latlng.lat, e.latlng.lng, true));
    $('#mMe').onclick = async () => { try { const p = await SM.getPos(); map.setView([p.lat, p.lon], 18) } catch (e) { SM.toast('Не удалось определить место') } };
    if (picked) { map.setView([picked.lat, picked.lon], 18); setPoint(L, picked.lat, picked.lon, false) }
    else {
      map.setView([43.70, -79.42], 11);
      const q = s ? s.addr : $('#sAddr').value.trim();
      if (q) { const p = await SM.fwdGeocode(q); if (p && map) map.setView([p.lat, p.lon], 18) }
      else SM.getPos().then(p => map && map.setView([p.lat, p.lon], 18)).catch(() => {});
    }
    setTimeout(() => map && map.invalidateSize(), 150);
  }

  // Кнопка в форме нового объекта
  const addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.className = 'sec sm'; addBtn.id = 'sMap'; addBtn.textContent = '🗺 На карте';
  const sLoc = $('#sLoc'); sLoc && sLoc.parentNode.insertBefore(addBtn, sLoc.nextSibling);
  addBtn.onclick = () => open({ title: 'Точка объекта', onDone: r => { SM.setPending({ lat: r.lat, lon: r.lon }); if (r.addr) $('#sAddr').value = r.addr; $('#sCoords').textContent = 'Точка выбрана на карте ✓'; } });

  if (sLoc) sLoc.textContent = '📍 Я здесь';
  const hint = document.querySelector('#t-sites > p.addr');
  if (hint) hint.textContent = 'Когда вы ближе 300 м к объекту с координатами, приложение предложит начать смену на нём. Точку объекта лучше всего отметить кнопкой «🗺 На карте» или «✏️ Изменить / на карте» — на спутнике видно своё здание.';

  // Кнопка «Изменить» у каждого объекта
  const decorate = () => document.querySelectorAll('#siteList [data-pin]').forEach(b => {
    if (b.nextElementSibling && b.nextElementSibling.classList.contains('edit-s')) return;
    const e = document.createElement('button'); e.type = 'button'; e.className = 'edit-s'; e.dataset.edit = b.dataset.pin; e.textContent = '✏️ Изменить / на карте';
    b.after(e);
  });
  new MutationObserver(decorate).observe($('#siteList'), { childList: true, subtree: true }); decorate();
  $('#siteList').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    e.stopPropagation();
    const s = SM.D.sites.find(x => x.id === b.dataset.edit); if (!s) return;
    open({ title: 'Изменить объект', site: s, onDone: r => { s.lat = r.lat; s.lon = r.lon; if (r.addr) s.addr = r.addr; if (r.name) s.name = r.name; SM.save(); SM.renderSites(); SM.toast('Объект обновлён') } });
  }, true);
})();
