// ==UserScript==
// @name        Custom JKLM.FUN Chat
// @namespace   mailto:dannyhpy@disroot.org
// @match       https://jklm.fun/*
// @run-at      document-start
// @grant       GM_addStyle
// @version     1.1
// @author      Danny Hpy
// @description Custom JKLM.FUN Chat
// ==/UserScript==

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForRef (name, retryAfter = 1_000) {
  try {
    return Function(`return ${name}`)()
  } catch (err) {
    if (!(err instanceof ReferenceError)) throw err
    await sleep(retryAfter)
    return waitForRef(name, retryAfter)
  }
}

function createTemplate (source) {
  const el = document.createElement('template')
  el.innerHTML = source
  return el
}

const authorTemplate = createTemplate(`
  <div class="customChat author">
    <div class="left-container">
      <img class="picture">
      <img class="service" hidden>
    </div>
    <div class="right-container">
      <div class="name-and-datetime-container">
        <b class="name"></b>
        <div class="badge-container"></div>
        <span class="datetime"></span>
      </div>

      <div class="messages"></div>
    </div>
  </div>
`)

const authorStyle = `
  .customChat.author {
    display: flex;
  }

  .customChat.author .left-container {
    width: 2rem;
    height: 2rem;
    margin-right: 0.5rem;
  }

  .customChat.author .left-container .picture {
    height: 2rem;
    background: black;
    border: 0.125rem solid white;
    border-radius: 50%;
  }

  .customChat.author.banned .left-container .picture {
    border-color: red;
  }

  .customChat.author .left-container .service {
    position: relative;
    top: -1rem;
    left: -0.25rem;
    width: 1rem;
    height: 1rem;
    border: 0.125rem solid white;
    border-radius: 50%;
  }

  .customChat.author.banned .left-container .service {
    border-color: red;
  }

  .customChat.author .right-container {
    display: flex;
    width: 100%;
    flex-direction: column;
  }

  .customChat.author .right-container .name-and-datetime-container {
    display: flex;
    width: 100%;
  }

  .customChat.author .right-container .name-and-datetime-container .name {
    color: white;
    margin-right: 0.5rem;
  }

  .customChat.author.banned .right-container .name-and-datetime-container .name {
    color: red;
  }

  .customChat.author.banned .right-container .name-and-datetime-container .name:after {
    content: ' (banned)';
    font-size: 0.5rem;
  }

  .customChat.author .right-container .name-and-datetime-container .badge-container .badge {
    border: 0.125rem solid white;
    border-radius: 50%;
  }

  .customChat.author.banned .right-container .name-and-datetime-container .badge-container {
    display: none;
  }

  .customChat.author .right-container .name-and-datetime-container .datetime {
    flex: 1;
    text-align: right;
    color: gray;
  }

  .customChat.author.banned .messages {
    display: none;
  }

  .customChat.author .messages .message .content {
    white-space: pre-line;
    margin-bottom: 0;
  }

  .customChat.author .messages .message .repetitionCount {
    color: gray;
  }
`
GM_addStyle(authorStyle)

const messageTemplate = createTemplate(`
  <div class="message">
    <span class="content"></span>
    <span class="repetitionCount"></span>
  </div>
`)

let socket = null
let pictureURLMap = new Map()
let defaultChatCallback = null
let lastAuthorPeerId = null
let lastAuthorEl = null
let lastMessageContent = null
let lastMessageEl = null
let repetitionCount = 0

function getPeerPicture (peerId) {
  return new Promise((resolve, reject) => {
    if (pictureURLMap.has(peerId)) return resolve(pictureURLMap.get(peerId))

    socket.emit('getChatterProfile', peerId, async function (profile) {
      if (profile.picture == null) {
        pictureURLMap.set(peerId, null)
        return resolve(null)
      }
      const res = await fetch(`data:image/webp;base64,${profile.picture}`)
      const blob = await res.blob()
      const blobURL = URL.createObjectURL(blob)
      pictureURLMap.set(peerId, blobURL)
      return resolve(blobURL)
    })
  })
}

async function customChatCallback (profile, message) {
  if (profile == null || profile.isBroadcast) {
    lastAuthorPeerId = null
    lastMessageContent = null
    return defaultChatCallback(...arguments)
  }

  let authorFragment, messageFragment

  if (lastAuthorPeerId !== profile.peerId) {
    authorFragment = authorTemplate.content.cloneNode(true)
    authorFragment.querySelector('.author').dataset.peerId = profile.peerId
    const picture = await getPeerPicture(profile.peerId)
    authorFragment.querySelector('.picture').src = picture ?? '/images/auth/guest.png'
    if (profile.auth != null) {
      const serviceEl = authorFragment.querySelector('.service')
      serviceEl.hidden = false
      serviceEl.src = `/images/auth/${profile.auth.service}.png`
    }
    authorFragment.querySelector('.name').textContent = profile.nickname
    authorFragment.querySelector('.name').onclick = authorFragment.querySelector('.picture').onclick = () => {
      showUserProfile(profile.peerId)
      return false;
    }
    const badgeContainerEl = authorFragment.querySelector('.badge-container')
    for (const role of profile.roles) {
      const emoji = badgesByRole[role].icon
      const badgeEl = document.createElement('span')
      badgeEl.classList.add('badge')
      badgeEl.textContent = emoji
      badgeContainerEl.appendChild(badgeEl)
    }
    const now = new Date()
    const toTwoDigits = i => i < 10 ? `0${i}` : i.toString()
    authorFragment.querySelector('.datetime').textContent = `${toTwoDigits(now.getHours())}:${toTwoDigits(now.getMinutes())}`
  }

  if (lastAuthorPeerId === profile.peerId && lastMessageContent === message) {
    lastMessageEl.querySelector('.repetitionCount').textContent = `(x${++repetitionCount + 1})`
  } else {
    messageFragment = messageTemplate.content.cloneNode(true)
    messageFragment.querySelector('.content').textContent = message
    lastMessageEl = messageFragment.querySelector('.message')
    lastMessageContent = message
    repetitionCount = 0
    ;(authorFragment ?? lastAuthorEl).querySelector('.messages').appendChild(messageFragment)
  }

  const chatLog = document.querySelector('.chat > .log')

  if (lastAuthorPeerId !== profile.peerId) {
    lastAuthorEl = authorFragment.querySelector('.author')
    lastAuthorPeerId = profile.peerId
    chatLog.appendChild(authorFragment)
  }

  chatLog.scrollTo(0, chatLog.scrollHeight)
}

async function main () {
  socket = await waitForRef('socket')

  defaultChatCallback = socket._callbacks['$chat'][0]
  socket._callbacks['$chat'][0] = async function onChat () {
    try {
      await customChatCallback(...arguments)
    } catch (err) {
      console.error(err)
      defaultChatCallback(...arguments)
    }
  }

  socket.on('userBanned', async function onPeerBan ({ peerId }) {
    const chatLog = document.querySelector('.chat > .log')
    const elements = chatLog.querySelectorAll(`.author[data-peer-id="${peerId}"]`)
    for (const el of elements) {
      el.classList.add('banned')
    }
  })

  socket.on('chatterAdded', async function onPeerJoin () {
    lastAuthorPeerId = null
    lastMessageContent = null
  })

  socket.on('chatterRemoved', async function onPeerLeave () {
    lastAuthorPeerId = null
    lastMessageContent = null
  })
}

if (location.pathname.length === 5) {
  main()
}
