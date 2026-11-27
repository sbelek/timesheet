/* © 2026 Sherkhan (github.com/sbelek). All rights reserved. See LICENSE.
   Выбор точки объекта на карте (Google Maps). */
(function () {
  const SM = window.SM; if (!SM) return;
  const $ = s => document.querySelector(s);
  const loadGoogle = SM.loadGoogle;

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
    dlg.innerHTML = `<div class="sh-h"><button class="link" id="mX" type="button" autofocus>Отмена</button><b>${SM.esc(opts.title)}</b><button class="link y" id="mOk" type="button">Готово</button></div>
    <div class="sh-b">
      ${s ? `<label for="mName">Название</label><input id="mName" value="${SM.esc(s.name)}">` : ''}
      <div class="mrow"><input id="mQ" placeholder="Найти адрес на карте" enterkeyhint="search"><button class="sec sm" id="mFind" type="button">Найти</button></div>
      <div id="mapBox"><div class="empty" id="mLoad">Загружаю карту…</div></div>
      <div class="seg2"><button class="sm" id="mStreet" type="button">Схема</button><button class="sec sm" id="mSat" type="button">Спутник</button></div>
      <div class="seg2"><button class="sec sm" id="mMe" type="button">📍 Я здесь</button><span></span></div>
      <p class="addr" id="mHint">Нажмите на своё здание — там появится метка. Метку можно перетащить.</p>
      <label for="mAddr">Адрес</label><input id="mAddr" value="${SM.esc(s ? s.addr || '' : ($('#sAddr')?.value || ''))}" placeholder="Заполнится сам после выбора точки">
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
      $('#mHint').textContent = 'Ищу…';
      const p = await SM.fwdGeocode(q);
      if (!p) { $('#mHint').textContent = 'Адрес не найден. Попробуйте иначе.'; return; }
      map && map.setCenter({ lat: p.lat, lng: p.lon });
      map && map.setZoom(18);
      $('#mHint').textContent = 'Нашёл. Нажмите на нужное здание.';
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
      $('#mHint').textContent = 'Определяю адрес…';
      const a = await SM.geocode(lat, lon);
      if (a) $('#mAddr').value = a;
      $('#mHint').textContent = a
        ? 'Точка выбрана. Проверьте адрес и нажмите «Готово».'
        : 'Точка выбрана. Адрес не определился — впишите сами.';
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
      } catch (e) { SM.toast('Не удалось определить место'); }
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
      if (far) $('#mHint').textContent = `Метка поставлена по адресу (старая точка была в ${Math.round(SM.dist(a, s))} м). Поправьте, если нужно, и нажмите «Готово».`;
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
  addBtn.type = 'button'; addBtn.className = 'sec sm'; addBtn.id = 'sMap'; addBtn.textContent = '🗺 На карте';
  sLoc && sLoc.parentNode.insertBefore(addBtn, sLoc.nextSibling);
  addBtn.onclick = () => open({
    title: 'Точка объекта',
    onDone: r => {
      SM.setPending({ lat: r.lat, lon: r.lon });
      if (r.addr) $('#sAddr').value = r.addr;
      $('#sCoords').textContent = 'Точка выбрана на карте ✓';
    }
  });

  if (sLoc) sLoc.textContent = '📍 Я здесь';

  const hint = document.querySelector('#t-sites > p.addr');
  if (hint) hint.textContent = 'Когда вы ближе 200 м к объекту с координатами, приложение предложит начать смену.';

  const decorate = () => document.querySelectorAll('#siteList [data-site]').forEach(d => {
    if (d.querySelector('.edit-s')) return;
    const e = document.createElement('button');
    e.type = 'button'; e.className = 'edit-s'; e.dataset.edit = d.dataset.site; e.textContent = '✏️ Изменить / на карте';
    d.appendChild(e);
  });
  new MutationObserver(decorate).observe($('#siteList'), { childList: true, subtree: true });
  decorate();

  $('#siteList').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    e.stopPropagation();
    const s = SM.D.sites.find(x => x.id === b.dataset.edit); if (!s) return;
    open({
      title: 'Изменить объект',
      site: s,
      onDone: r => {
        s.lat = r.lat; s.lon = r.lon;
        if (r.addr) s.addr = r.addr;
        if (r.name) s.name = r.name;
        SM.save(); SM.renderSites(); SM.toast('Объект обновлён');
      }
    });
  }, true);
})();
