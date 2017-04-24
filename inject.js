/* global chrome, CustomEvent */

'use strict'

const loadLib = url => {
  const script = document.createElement('script')
  script.src = url
  document.getElementsByTagName('head')[0].appendChild(script)
}

loadLib(chrome.extension.getURL('main.js'))

document.addEventListener('CORREOS_REQUEST', ({ detail }) => {
  chrome.runtime.sendMessage({ type: 'CORREOS', payload: detail }, res => {
    document.dispatchEvent(new CustomEvent('CORREOS_RESPONSE', { detail: res }))
  })
})
