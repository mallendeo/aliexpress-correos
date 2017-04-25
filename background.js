/* global moment, chrome, fetch, DOMParser, FormData */
'use strict'

const CORREOS_URL = 'http://seguimientoweb.correos.cl/ConEnvCorreos.aspx'

moment.lang('es')

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== 'CORREOS' || !request.payload.length) return

  const str = request.payload[0]
  const trackingNum = str.substr(str.length - 15, 12)

  const formData = new FormData()
  formData.append('obj_env', trackingNum)
  formData.append('obj_key', 'Cor398-cc')

  fetch(CORREOS_URL, { method: 'POST', body: formData })
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const notFound = doc.querySelector('.envio_no_existe')
      if (notFound) {
        sendResponse({ error: 404 })
        return
      }

      const table = doc.querySelector('.tracking')
      const rows = table.querySelectorAll('tr:nth-child(n+2)')
      const text = n => n.textContent.trim()
      const shippingCode = doc
        .querySelector('.datosgenerales td:nth-child(2)')
        .textContent
        .trim()

      const steps = []

      rows.forEach(row => {
        const columns = row.querySelectorAll('td')
        const date = moment(text(columns[1]), 'DD/MM/YYYY HH:mm')
        steps.push({
          status: text(columns[0]),
          date: date.valueOf(),
          fromNow: date.fromNow(),
          office: text(columns[2])
        })
      })

      sendResponse({ shippingCode, steps })
    })

  return true
})
