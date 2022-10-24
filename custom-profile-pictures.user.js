// ==UserScript==
// @name        Custom Profile Pictures on JKLM.FUN
// @namespace   mailto:dannyhpy@disroot.org
// @match       https://jklm.fun/
// @grant       unsafeWindow
// @run-at      document-start
// @version     1.0
// @author      Danny Hpy
// @description Custom Profile Pictures on JKLM.FUN
// ==/UserScript==

const customBoxTemplate = document.createElement('template')
customBoxTemplate.innerHTML = `
  <div class="box">
    <b>Custom Profile Pictures</b>
    <p>Try the file uploader below:</p>
    <input id="cpp-file" class="styled" type="file">
    <button id="cpp-confirm-file" class="styled">Use as profile picture</button>
  </div>
`

unsafeWindow.addEventListener('DOMContentLoaded', function () {
  const boxContainer = document.querySelector('.page.auth .main')
  boxContainer.appendChild(customBoxTemplate.content)

  const cppConfirmFile = boxContainer.querySelector('#cpp-confirm-file')
  cppConfirmFile.onclick = () => {
    const fileEl = boxContainer.querySelector('#cpp-file')
    const file = fileEl.files[0]
    if (file == null) return false

    const blobURL = URL.createObjectURL(file)
    fetch(blobURL)
      .then(res => res.arrayBuffer())
      .then(buf => new Uint8Array(buf))
      .then(arr => {
        const encoded = base64EncArr(arr)
        if (encoded.length > 10_000) {
          alert('Sorry. This file is too large. (>10Kb)')
          return
        }

        settings.picture = encoded
        saveSettings()
        alert('Success.')
        location.reload()
      })

    return false
  }
})

// Base64 string to array encoding
// from https://developer.mozilla.org/en-US/docs/Glossary/Base64#solution_1_%E2%80%93_escaping_the_string_before_encoding_it
function uint6ToB64(nUint6) {
  return nUint6 < 26
    ? nUint6 + 65
    : nUint6 < 52
    ? nUint6 + 71
    : nUint6 < 62
    ? nUint6 - 4
    : nUint6 === 62
    ? 43
    : nUint6 === 63
    ? 47
    : 65;
}

function base64EncArr(aBytes) {
  let nMod3 = 2;
  let sB64Enc = "";

  const nLen = aBytes.length;
  let nUint24 = 0;
  for (let nIdx = 0; nIdx < nLen; nIdx++) {
    nMod3 = nIdx % 3;
    nUint24 |= aBytes[nIdx] << ((16 >>> nMod3) & 24);
    if (nMod3 === 2 || aBytes.length - nIdx === 1) {
      sB64Enc += String.fromCodePoint(
        uint6ToB64((nUint24 >>> 18) & 63),
        uint6ToB64((nUint24 >>> 12) & 63),
        uint6ToB64((nUint24 >>> 6) & 63),
        uint6ToB64(nUint24 & 63)
      );
      nUint24 = 0;
    }
  }
  return (
    sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) +
    (nMod3 === 2 ? "" : nMod3 === 1 ? "=" : "==")
  );
}
