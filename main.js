/* global CustomEvent */
'use strict'

const INFO_URL = 'https://ilogisticsaddress.aliexpress.com/ajax_logistics_track.htm'
const CORREOS_URL = 'http://www.correos.cl/SitePages/seguimiento/seguimiento.aspx'

// https://gist.github.com/gf3/132080/110d1b68d7328d7bfe7e36617f7df85679a08968
const jsonp = (() => {
  let unique = 0
  return url => new Promise((resolve, reject) => {
    const name = `_jsonp_${++unique}`

    if (url.match(/\?/)) {
      url += `&callback=${name}`
    } else {
      url += `?callback=${name}`
    }

    let script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = url

    const head = document.getElementsByTagName('head')[0]

    window[name] = data => {
      resolve(data)
      head.removeChild(script)
      script = null
      delete window[name]
    }

    head.appendChild(script)
  })
})()

const getDataFromCorreos = orderId => new Promise((resolve, reject) => {
  jsonp(`${INFO_URL}?orderId=${orderId}`)
    .then(data => {
      const sinotrans = data.tracking.some(s =>
        s.officialUrl.includes('sinoair') ||
        s.officialUrl.includes('sinotrans')
      )

      if (!sinotrans) {
        return reject({
          code: 400,
          error: 'El envío no es de Sinotrans'
        })
      }

      const nums = data.tracking.map(track => track.mailNo)

      const event = new CustomEvent('CORREOS_REQUEST', { detail: nums })
      document.dispatchEvent(event)

      const timeout = setTimeout(() => {
        reject({
          code: 500,
          error: 'Tiempo de respuesta agotado'
        })
      }, 10000)

      document.addEventListener('CORREOS_RESPONSE', res => {
        if (res.detail.error === 404) {
          reject({
            code: 404,
            error: 'El envío no existe'
          })
          return
        }

        resolve({
          detail: res.detail,
          trackingNumbers: nums
        })

        clearTimeout(timeout)
        document.removeEventListener('CORREOS_RESPONSE', () => {})
      })
    })
})

const cumulativeOffset = elem => {
  let top = 0
  let left = 0
  do {
    top += elem.offsetTop || 0
    left += elem.offsetLeft || 0
    elem = elem.offsetParent
  } while (elem)

  return { top, left }
}

const createButton = () => {
  const button = document.createElement('a')
  button.textContent = 'Localizar (correos.cl)'
  button.classList.add('ui-button')
  button.classList.add('ui-button-normal')
  button.classList.add('button-logisticsTracking')

  return button
}

const createBalloon = (position = { top: 0, left: 0 }, promise) => {
  const balloon = document.createElement('div')
  balloon.classList.add('ui-balloon')
  balloon.classList.add('ui-balloon-tr')

  balloon.style.zIndex = 99
  balloon.style.left = `${position.left}px`
  balloon.style.top = `${position.top}px`
  balloon.style.pointerEvents = 'none'
  balloon.style.transform = 'translateX(-40%) translateY(2.2rem)'
  balloon.style.minWidth = '12rem'

  const message = document.createTextNode('Cargando...')
  balloon.appendChild(message)

  const list = document.createElement('div')

  const shippingCode = document.createElement('div')
  shippingCode.classList.add('bold-text-remind')
  shippingCode.style.paddingBottom = '12px'

  promise.then(({ detail }) => {
    balloon.removeChild(message)

    shippingCode.textContent = `Número de envío: ${detail.shippingCode}`
    balloon.appendChild(shippingCode)

    detail.steps.forEach(step => {
      const item = document.createElement('div')

      item.innerHTML = `
        <b class="event-line-key">${step.office}</b>
        <p class="event-line-desc">${step.status}</p>
        <p class="event-line-time">${step.fromNow}</p>
      `

      list.appendChild(item)
    })

    balloon.appendChild(list)
  }).catch(e => {
    if (e.code) {
      message.textContent = e.error
    }
  })

  const arrow = document.createElement('a')
  arrow.classList.add('ui-balloon-arrow')

  balloon.appendChild(arrow)

  document.body.appendChild(balloon)

  return balloon
}

// --------------------
// Init
// --------------------
;(() => {
  const actions = document.querySelectorAll('td.order-action')

  actions.forEach(action => {
    const orderId = action.getAttribute('orderid')
    const button = createButton()

    let balloon = null

    button.addEventListener('mouseover', () => {
      const promise = getDataFromCorreos(orderId)

      promise.then(data => {
        if (data.trackingNumbers && data.trackingNumbers.length) {
          const number = data.trackingNumbers[0]
          button.href = `${CORREOS_URL}?envio=${number.substr(number.length - 15, 12)}`
        }
      })

      if (!balloon) {
        balloon = createBalloon(cumulativeOffset(button), promise)
      }
    })

    button.addEventListener('mouseleave', () => {
      if (balloon) {
        balloon.parentNode.removeChild(balloon)
        balloon = null
      }
    })

    action.prepend(button)
  })
})()
