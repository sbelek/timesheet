/* © 2026 Sherkhan (github.com/sbelek). All rights reserved. See LICENSE.
   Выбор точки объекта на карте (Google Maps). */
(function () {
  const SM = window.SM; if (!SM) return;
  const $ = s => document.querySelector(s);
  const loadGoogle = SM.loadGoogle;
  const T = SM.T;

  const css = document.createElement('style');
  css.textContent = `
  #mapBox{height:52dvh;min-height:300px;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#16181a}
  .mrow{display:flex;gap:8px;margin:8px 0}.mrow input{flex:1}.mrow button{flex:none}
  .seg2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
  .edit-s{background:none;color:var(--mute);font-size:15px;min-height:40px;padding:0;margin-left:14px}`;
  document.head.appendChild(css);

  const dlg = document.createElement('dialog');
  dlg.id = 'mdlg'; dlg.className = 'sheet'; document.body.appendChild(dlg);
  let map = null, marker = null, picked = null;

  function open(opts) {
    const s = opts.site;
    dlg.innerHTML = `<div class="sh-h"><button class="link" id="mX" type="button" autofocus>${T('Cancel', 'Отмена')}</button><b>${SM.esc(opts.title)}</b><button class="link y" id="mOk" type="button">${T('Done', 'Готово')}</button></div>
    <div class="sh-b">
      ${s ? `<label for="mName">${T('Name', 'Название')}</label><input id="mName" value="${SM.esc(s.name)}">` : ''}
      <div class="mrow"><input id="mQ" placeholder="${T('Find an address on the map', 'Найти адрес на карте')}" enterkeyhint="search"><button class="sec sm" id="mFind" type="button">${T('Find', 'Найти')}</button></div>
      <div id="mapBox"><div class="empty" id="mLoad">${T('Loading map…', 'Загружаю карту…')}</div></div>
      <div class="seg2"><button class="sm" id="mStreet" type="button">${T('Map', 'Схема')}</button><button class="sec sm" id="mSat" type="button">${T('Satellite', 'Спутник')}</button></div>
      <div class="seg2"><button class="sec sm" id="mMe" type="button">${T("📍 I'm here", '📍 Я здесь')}</button><span></span></div>
      <p class="addr" id="mHint">${T('Tap your building — a marker will appear there. You can drag the marker.', 'Нажмите на своё здание — там появится метка. Метку можно перетащить.')}</p>
      <label for="mAddr">${T('Address', 'Адрес')}</label><input id="mAddr" value="${SM.esc(s ? s.addr || '' : ($('#sAddr')?.value || ''))}" placeholder="${T('Fills in automatically after you pick a point', 'Заполнится сам после выбора точки')}">
    </div>`;
    picked = s && s.lat != null ? { lat: s.lat, lon: s.lon } : null;
    dlg.showModal();

    $('#mX').onclick = () => dlg.close();
    $('#mOk').onclick = () => {
      if (!picked) return SM.toast(T('Mark a point on the map first', 'Сначала отметьте точку на карте'));
      const r = { lat: picked.lat, lon: picked.lon, addr: $('#mAddr').value.trim() };
      if (s) r.name = ($('#mName').value || '').trim() || s.name;
      dlg.close(); opts.onDone(r);
    };

    const find = async () => {
      const q = $('#mQ').value.trim();
      if (!q) { $('#mHint').textContent = T('Type an address in the search box.', 'Введите адрес в поле поиска.'); $('#mQ').focus(); return; }
      if (!map || !window.google?.maps) { $('#mHint').textContent = T('The map is still loading, please wait…', 'Карта ещё загружается, подождите…'); return; }
      $('#mHint').textContent = T('Searching…', 'Ищу…');
      const p = await SM.fwdGeocode(q);
      if (!p) { $('#mHint').textContent = T('Address not found. Try wording it differently.', 'Адрес не найден. Попробуйте иначе.'); return; }
      map.setCenter({ lat: p.lat, lng: p.lon });
      map.setZoom(18);
      setPoint(window.google.maps, p.lat, p.lon, false);
      if (p.addr) $('#mAddr').value = p.addr;
      $('#mHint').textContent = T('Found — the marker is on the address. Adjust it if needed and tap “Done”.', 'Нашёл — метка на адресе. Поправьте, если нужно, и нажмите «Готово».');
    };
    $('#mFind').onclick = find;
    $('#mQ').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); find(); } };

    loadGoogle().then(g => init(g, s)).catch(e => {
      const el = $('#mLoad'); if (el) el.textContent = e.message;
    });
  }

  async function setPoint(g, lat, lon, fill) {
    picked = { lat, lon };
    if (!marker) {
      marker = new g.Marker({
        position: { lat, lng: lon },
        map,
        draggable: true,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#ffc400',
          fillOpacity: 1,
          strokeColor: '#1d1f21',
          strokeWeight: 3
        }
      });
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        setPoint(g, p.lat(), p.lng(), true);
      });
    } else {
      marker.setPosition({ lat, lng: lon });
    }
    if (fill) {
      $('#mHint').textContent = T('Looking up the address…', 'Определяю адрес…');
      const a = await SM.geocode(lat, lon);
      if (a) $('#mAddr').value = a;
      $('#mHint').textContent = a
        ? T('Point selected. Check the address and tap “Done”.', 'Точка выбрана. Проверьте адрес и нажмите «Готово».')
        : T('Point selected. Address not found — type it yourself.', 'Точка выбрана. Адрес не определился — впишите сами.');
    }
  }

  async function init(g, s) {
    const loadEl = $('#mLoad'); if (loadEl) loadEl.remove();
    if (map) { if (marker) { marker.setMap(null); marker = null; } }

    map = new g.Map(document.getElementById('mapBox'), {
      zoom: 11,
      center: { lat: 43.70, lng: -79.42 },
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy'
    });

    const setMapType = t => {
      map.setMapTypeId(t);
      $('#mStreet').className = t === 'roadmap' ? 'sm' : 'sec sm';
      $('#mSat').className = t === 'satellite' ? 'sm' : 'sec sm';
    };
    $('#mStreet').onclick = () => setMapType('roadmap');
    $('#mSat').onclick = () => setMapType('satellite');

    map.addListener('click', e => setPoint(g, e.latLng.lat(), e.latLng.lng(), true));

    $('#mMe').onclick = async () => {
      try {
        const p = await SM.getPos();
        map.setCenter({ lat: p.lat, lng: p.lon });
        map.setZoom(18);
      } catch (e) { SM.toast(T('Could not get your location', 'Не удалось определить место')); }
    };

    const q = s ? (s.addr || '').trim() : ($('#sAddr')?.value.trim() || '');
    // Адрес главнее: если сохранённая точка далеко от адреса (например, привязана «Я здесь»), ставим метку по адресу
    if (picked && q) {
      const a = await SM.fwdGeocode(q);
      if (!map) return;
      const far = a && SM.dist(a, picked) > 300;
      const p = far ? a : picked;
      map.setCenter({ lat: p.lat, lng: p.lon });
      map.setZoom(18);
      setPoint(g, p.lat, p.lon, false);
      if (far) { const d = Math.round(SM.dist(a, s)); $('#mHint').textContent = T(`Marker placed by the address (the old point was ${d} m away). Adjust it if needed and tap “Done”.`, `Метка поставлена по адресу (старая точка была в ${d} м). Поправьте, если нужно, и нажмите «Готово».`); }
    } else if (picked) {
      map.setCenter({ lat: picked.lat, lng: picked.lon });
      map.setZoom(18);
      setPoint(g, picked.lat, picked.lon, false);
    } else {
      if (q) {
        const p = await SM.fwdGeocode(q);
        if (p && map) { map.setCenter({ lat: p.lat, lng: p.lon }); map.setZoom(18); }
      } else {
        SM.getPos().then(p => { if (map) { map.setCenter({ lat: p.lat, lng: p.lon }); map.setZoom(17); } }).catch(() => {});
      }
    }
  }

  const sLoc = $('#sLoc');
  const addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.className = 'sec sm'; addBtn.id = 'sMap';
  sLoc && sLoc.parentNode.insertBefore(addBtn, sLoc.nextSibling);
  addBtn.onclick = () => open({
    title: T('Site point', 'Точка объекта'),
    onDone: r => {
      SM.setPending({ lat: r.lat, lon: r.lon });
      if (r.addr) $('#sAddr').value = r.addr;
      $('#sCoords').textContent = T('Point selected on the map ✓', 'Точка выбрана на карте ✓');
    }
  });

  const editLabel = () => T('✏️ Edit / on map', '✏️ Изменить / на карте');
  const decorate = () => document.querySelectorAll('#siteList [data-site]').forEach(d => {
    if (d.querySelector('.edit-s')) return;
    const e = document.createElement('button');
    e.type = 'button'; e.className = 'edit-s'; e.dataset.edit = d.dataset.site; e.textContent = editLabel();
    d.appendChild(e);
  });
  new MutationObserver(decorate).observe($('#siteList'), { childList: true, subtree: true });
  const setTexts = () => {
    addBtn.textContent = T('🗺 On map', '🗺 На карте');
    document.querySelectorAll('#siteList .edit-s').forEach(e => { e.textContent = editLabel(); });
  };
  document.addEventListener('langchange', setTexts);
  setTexts();
  decorate();

  $('#siteList').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    e.stopPropagation();
    const s = SM.D.sites.find(x => x.id === b.dataset.edit); if (!s) return;
    open({
      title: T('Edit site', 'Изменить объект'),
      site: s,
      onDone: r => {
        s.lat = r.lat; s.lon = r.lon;
        if (r.addr) s.addr = r.addr;
        if (r.name) s.name = r.name;
        SM.save(); SM.renderSites(); SM.toast(T('Site updated', 'Объект обновлён'));
      }
    });
  }, true);
})();
