import {token_prices} from './App.js'

const US_PERCENT = Intl.NumberFormat('en-US', {
  style: "percent",
  minimumFractionDigits: 2
});
const US_ACCOUNTING = Intl.NumberFormat('en-US', {
  style: "currency",
  currency: "USD",
  currencySign: "accounting"
});

export async function get_token_price_in_usd(ticker) {
  ticker = ticker.replace('.e','').replace('W','')
  if (ticker in token_prices) {
  } else {
    if (ticker !== 'USDT') {
      if (ticker !== 'XSUSHI') {
        token_prices[ticker] = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}USDT`)
          .then(response => response.json())
          .catch(error => -1)
          .then(data => {
            if (data.hasOwnProperty("price")) return parseFloat(data.price)
            console.log('fetched from binance: ', ticker, token_prices[ticker])
            return -1
          })
      } else { //xsushi
        token_prices[ticker] = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`)
        .then(response => response.json())
        .catch(error => -1)
        .then(data => {
          if (data.hasOwnProperty(ticker.toLowerCase())) return parseFloat(data[ticker.toLowerCase()]['usd'])
          console.log('fetched from coingecko: ', ticker, token_prices[ticker])
          return -1
        })
      }
    } else {
      return 1.0
    }
  }
  return token_prices[ticker]
}

export async function get_token_price_in_eth(ticker) {
  let token_in_usdt = await get_token_price_in_usd(ticker)
  let eth_in_usdt = await get_token_price_in_usd('ETH')
  console.log('eth price of ', ticker, eth_in_usdt)
  return token_in_usdt / eth_in_usdt
}

export function formatAsPercent(decimal) {
  return US_PERCENT.format(decimal)
}

export function formatAsUSD(decimal) {
  return US_ACCOUNTING.format(decimal)
}