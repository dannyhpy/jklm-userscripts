// ==UserScript==
// @name        JKLM.FUN Command Palette
// @namespace   mailto:dannyhpy@disroot.org
// @match       https://jklm.fun/*
// @grant       GM_addStyle
// @run-at      document-start
// @version     1.0
// @author      Danny Hpy
// @description JKLM.FUN Command Palette
// ==/UserScript==

const boomEmoji = '💥'
const defaultPlaceholder = 'Hit Escape to exit.'

const reply = function (r) {
  if (typeof appendToChat !== 'undefined') {
    appendToChat(null, r)
  } else alert(r)
}

const commands = []
;(function addCommands () {
  commands.push({
    name: 'Copy 💥 emoji',
    tags: ['boom', 'explosion', 'skip'],
    async exec () {
      await navigator.clipboard.writeText(boomEmoji)
      if (typeof appendToChat !== 'undefined') appendToChat(null, '💥')
    }
  })

  if (location.pathname.length === 5) {
    commands.push({
      name: '🤖 Summon bot: 🎉 LeisureBot',
      tags: ['bot'],
      async exec () {
        if (typeof roomCode !== 'undefined') {
          const res = await fetch(`https://jklm-leisurebot.fly.dev/joinroom?roomCode=${roomCode}`, {
            mode: 'no-cors'
          })
          reply(`Task "${this.name}" has been executed.`)
        } else {
          reply('Room code is unknown.')
        }
      }
    })
  }
})()

const commandPaletteTemplate = document.createElement('template')
commandPaletteTemplate.innerHTML = `
  <div class="command-palette" hidden>
    <div class="command-and-input-container">
      <div class="command-suggestions"></div>
      <hr>
      <input placeholder="Hit Escape to exit." type="text">
    </div>
  </div>
`

GM_addStyle(`
  :root {
    --command-palette-bg: #7855c7;
  }

  .command-palette {
    position: fixed;
    height: 100%;
    width: 100%;
    background: rgb(0 0 0 / 50%);
  }

  .command-palette .command-and-input-container {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 50%;
    transform: translate(-50%, -50%);
    font-size: 3rem;
  }

  .command-palette .command-and-input-container .command-suggestions {
    display: flex;
    flex-direction: column;
    background: var(--command-palette-bg);
    border-radius: 0.25rem;
  }

  .command-palette .command-and-input-container .command-suggestions .entry {
    margin: 0.25rem;
    padding: 0.25rem;
    background: rgb(33 33 33 / 50%);
    color: white;
    border-radius: 0.25rem;
  }

  .command-palette .command-and-input-container .command-suggestions .entry.selected {
    background: rgb(200 200 200 / 50%);
    color: black;
    text-shadow: 0.25rem 0.25rem #0000007a;
  }

  .command-palette .command-and-input-container hr {
    margin: 0.5rem;
    border-color: black;
  }

  .command-palette .command-and-input-container input {
    padding: 0.5rem;
    background: black;
    color: white;
    width: 100%;
  }
`)

function showCommandPalette () {
  window.commandPaletteEl.hidden = false
  window.commandPaletteInputEl.focus()
  window.commandPaletteInputEl.placeholder = defaultPlaceholder
}

function hideCommandPalette () {
  window.commandPaletteInputEl.value = ''
  window.commandPaletteEl.hidden = true
  window.chatInputEl?.focus()
}

function updateSelectionOnDOM () {
  for (let i = 0; i < window.currentSuggestions.length; i++) {
    const suggEl = window.commandSuggestionsEl.children[i]
    suggEl.classList.remove('selected')
    if (i === window.currentlySelectedIdx) suggEl.classList.add('selected')
  }
}

function main () {
  window.commandPaletteEl = commandPaletteTemplate.content.querySelector('.command-palette')
  window.commandPaletteInputEl = commandPaletteEl.querySelector('input')
  window.commandSuggestionsEl = commandPaletteEl.querySelector('.command-suggestions')
  window.currentSuggestions = []
  window.currentlySelectedIdx = 0

  window.document.addEventListener('keydown', function (e) {
    if (!window.commandPaletteEl.hidden) {
      if (['Escape', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) e.preventDefault()

      switch (e.key) {
        case 'Escape':
          hideCommandPalette()
          break
        case 'ArrowUp':
          if (window.currentlySelectedIdx === 0) return
          window.currentlySelectedIdx--
          updateSelectionOnDOM()
          break
        case 'ArrowDown':
          if (window.currentlySelectedIdx === window.currentSuggestions.length - 1) return
          window.currentlySelectedIdx++
          updateSelectionOnDOM()
          break
        case 'Enter':
          const selectedIdx = window.currentlySelectedIdx
          const selectedCmd = window.currentSuggestions[selectedIdx]
          if (selectedCmd == null) return hideCommandPalette()

          window.commandPaletteInputEl.value = ''
          window.commandPaletteInputEl.placeholder = `Executing "${selectedCmd.name}"...`
          selectedCmd.exec()
            .then(hideCommandPalette)
            .catch((err) => {
              reply(`An error occured: ${err.toString()}`)
              console.error(err)
            })
          break
      }
    }
  })

  window.commandPaletteInputEl.addEventListener('input', function (e) {
    if (this.placeholder !== defaultPlaceholder) this.placeholder = defaultPlaceholder

    if (this.value.length >= 2) {
      const splitValue = this.value
        .trim()
        .split(' ')
        .filter(x => x.length > 0)

      const commandNames = commands.map(x => x.name)
      const commandScores = []

      for (let i = 0; i < commandNames.length; i++) {
        commandScores[i] = 0
        const commandNameLower = commandNames[i].toLowerCase()
        for (const inputWord of splitValue) {
          if (commandNameLower.includes(inputWord)) commandScores[i]++

          if (Array.isArray(commands[i].tags)) {
            for (const tag of commands[i].tags) {
              if (tag.includes(inputWord)) commandScores[i]++
            }
          }
        }
      }

      window.currentSuggestions = [...commands]
        .filter((_x, idx) => commandScores[idx] > 0)
        .sort((a, b) => {
          const aIdx = commands.indexOf(a)
          const bIdx = commands.indexOf(b)
          return commandScores[bIdx] - commandScores[aIdx]
        })
        .slice(0, 3)

      window.currentlySelectedIdx = 0
      window.commandSuggestionsEl.innerHTML = ''
      for (let i = 0; i < window.currentSuggestions.length; i++) {
        const sugg = window.currentSuggestions[i]
        const suggEl = document.createElement('div')
        suggEl.classList.add('entry')
        if (i === 0) suggEl.classList.add('selected')
        suggEl.dataset.idx = i.toString()
        suggEl.textContent = sugg.name
        window.commandSuggestionsEl.appendChild(suggEl)
      }
    } else {
      window.currentSuggestions = []
      window.commandSuggestionsEl.innerHTML = ''
    }
  })

  window.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(commandPaletteTemplate.content)

    window.chatInputEl = document.querySelector('.chat .input textarea')

    if (window.chatInputEl != null) {
      window.chatInputEl.addEventListener('beforeinput', function (e) {
        if (this.value !== '') return
        if (e.data !== '/') return

        e.preventDefault()
        showCommandPalette()
      })

      window.chatInputEl.addEventListener('input', function (e) {
        if (this.value !== '/') return

        this.value = ''
        showCommandPalette()
      })

      // In case the chat is disabled.
      window.chatInputEl.addEventListener('click', function (e) {
        if (!this.disabled) return

        e.preventDefault()
        showCommandPalette()
      })
    } else {
      document.addEventListener('keyup', function (e) {
        if (e.key !== '/') return

        e.preventDefault()
        showCommandPalette()
      })
    }
  })
}

main()
