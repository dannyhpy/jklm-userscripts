// ==UserScript==
// @name        Custom JKLM.FUN Chat
// @namespace   mailto:dannyhpy@disroot.org
// @match       https://jklm.fun/*
// @run-at      document-start
// @grant       GM_addStyle
// @version     1.0
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

  .customChat.author .left-container .service {
    position: relative;
    top: -1rem;
    left: -0.25rem;
    width: 1rem;
    height: 1rem;
    border: 0.125rem solid white;
    border-radius: 50%;
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
    flex: 1;
    color: white;
  }

  .customChat.author .right-container .name-and-datetime-container .datetime {
    text-align: right;
    color: gray;
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
    const picture = await getPeerPicture(profile.peerId)
    authorFragment.querySelector('.picture').src = picture ?? '/images/auth/guest.png'
    if (profile.auth != null) {
      const serviceEl = authorFragment.querySelector('.service')
      serviceEl.hidden = false
      serviceEl.src = `/images/auth/${profile.auth.service}.png`
    }
    authorFragment.querySelector('.name').textContent = profile.nickname
    const now = new Date()
    const toTwoDigits = i => i < 10 ? `0${i}` : i.toString()
    authorFragment.querySelector('.datetime').textContent = `${toTwoDigits(now.getHours())}:${toTwoDigits(now.getMinutes())}`
  }

  if (lastMessageContent !== message) {
    messageFragment = messageTemplate.content.cloneNode(true)
    messageFragment.querySelector('.content').textContent = message
    lastMessageEl = messageFragment.querySelector('.message')
    lastMessageContent = message
    repetitionCount = 0
    ;(authorFragment ?? lastAuthorEl).querySelector('.messages').appendChild(messageFragment)
  } else {
    lastMessageEl.querySelector('.repetitionCount').textContent = `(x${++repetitionCount + 1})`
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
}

if (location.pathname.length === 5) {
  main()
}
